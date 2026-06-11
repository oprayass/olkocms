export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";

// INBOUND MATCH RULE (from DARAZ_SCANS_CLAIMS findings):
// A scanned tracking matches a DarazOrderItem where EITHER
//   (a) returnTrackingNo == scan AND whqcDecision == "return_to_merchant"  (customer return, expected inbound)
//   (b) trackingNo == scan AND status IN (shipped_back, failed_delivery, returned)  (failed delivery reuses outbound tracking)
// return_to_customer items are NOT expected inbound and must NOT match.

const FAILED_STATUSES = ["shipped_back", "failed_delivery", "returned"];

async function matchTracking(trackingNo: string) {
  // Rule (a): customer return coming back to merchant.
  const byReturn = await prisma.darazOrderItem.findFirst({
    where: {
      returnTrackingNo: trackingNo,
      whqcDecision: "return_to_merchant",
    },
  });
  if (byReturn) return { item: byReturn, matchType: "return_to_merchant" };

  // Rule (b): failed delivery reusing the outbound tracking.
  const byOutbound = await prisma.darazOrderItem.findFirst({
    where: {
      trackingNo,
      status: { in: FAILED_STATUSES },
    },
  });
  if (byOutbound) return { item: byOutbound, matchType: "failed_delivery" };

  return null;
}

export const POST = withTenant(async () => {
  try {
    // Unresolved inbound-type scans: no darazOrderId yet, or flagged wrongStore.
    // Only non-deleted, only scans that carry a tracking to match on.
    const scans = await prisma.darazScan.findMany({
      where: {
        deleted: false,
        trackingNo: { not: null },
        scanType: { in: ["inbound", "return", "failed"] },
        OR: [{ darazOrderId: null }, { wrongStore: true }],
      },
      orderBy: { createdAt: "desc" },
    });

    let matched = 0;
    let stillUnmatched = 0;
    const details: any[] = [];

    for (const scan of scans) {
      const tracking = scan.trackingNo as string;
      const found = await matchTracking(tracking);

      if (!found) {
        stillUnmatched += 1;
        continue;
      }

      const item = found.item;

      // customerName lives on DarazOrder, not DarazOrderItem -> join by darazOrderId.
      let customerName: string | null = null;
      if (item.darazOrderId) {
        const ord = await prisma.darazOrder.findUnique({
          where: { darazOrderId: item.darazOrderId },
          select: { customerName: true },
        });
        customerName = ord?.customerName ?? null;
      }

      // Attach real data to the scan; clear the wrongStore flag.
      const data: Record<string, unknown> = { wrongStore: false };
      if (item.darazOrderId) data.darazOrderId = item.darazOrderId;
      if (item.itemName) data.itemName = item.itemName;
      if (item.itemName) data.productName = item.itemName;
      if (item.price != null) data.price = item.price;
      if (item.storeId) data.storeId = item.storeId;
      if (customerName) data.customerName = customerName;

      await prisma.darazScan.update({
        where: { id: scan.id },
        data,
      });

      matched += 1;
      details.push({
        scanId: scan.id,
        trackingNo: tracking,
        matchType: found.matchType,
        darazOrderId: item.darazOrderId,
        storeId: item.storeId,
      });
    }

    return NextResponse.json({
      success: true,
      scanned: scans.length,
      matched,
      stillUnmatched,
      details,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
});