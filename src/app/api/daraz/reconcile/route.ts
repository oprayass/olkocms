import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    let created = 0;
    let skipped = 0;

    // 1. Outbound scans जसको trackingNo DarazClaim मा छैन
    const outboundScans = await prisma.darazScan.findMany({
      where: { scanType: "outbound", trackingNo: { not: null } },
    });

    for (const scan of outboundScans) {
      const tracking = scan.trackingNo!;
      const claim = await prisma.darazClaim.findFirst({
        where: { trackingNo: tracking },
      });
      if (!claim) {
        const existing = await prisma.darazAlert.findFirst({
          where: { alertType: "outbound_not_in_daraz", notes: { contains: tracking } },
        });
        if (existing) { skipped++; continue; }
        await prisma.darazAlert.create({
          data: {
            darazOrderId: scan.darazOrderId ?? "unknown",
            productName: scan.itemName ?? scan.productName ?? "Unknown Item",
            alertType: "outbound_not_in_daraz",
            status: "unresolved",
            notes: `Tracking: ${tracking} — outbound scan गरियो तर DarazClaim मा record छैन। Scanned by: ${scan.scannedBy ?? "unknown"} at ${scan.createdAt.toISOString()}`,
          },
        });
        created++;
      } else { skipped++; }
    }

    // 2. DarazClaims जसको inbound scan छैन
    const claims = await prisma.darazClaim.findMany({
      where: { trackingNo: { not: null } },
    });

    for (const claim of claims) {
      const tracking = claim.trackingNo;
      const inbound = await prisma.darazScan.findFirst({
        where: { scanType: "inbound", trackingNo: tracking },
      });
      if (!inbound) {
        const existing = await prisma.darazAlert.findFirst({
          where: { alertType: "daraz_return_not_scanned", notes: { contains: tracking } },
        });
        if (existing) { skipped++; continue; }
        await prisma.darazAlert.create({
          data: {
            darazOrderId: claim.darazOrderId ?? "unknown",
            productName: claim.itemName ?? "Unknown Item",
            alertType: "daraz_return_not_scanned",
            status: "unresolved",
            notes: `Tracking: ${tracking} — DarazClaim छ तर inbound scan भएन। Store: ${claim.storeId ?? "unknown"}`,
          },
        });
        created++;
      } else { skipped++; }
    }

    // 3. Wrong-store inbound scans
    const wrongStoreScans = await prisma.darazScan.findMany({
      where: { scanType: "inbound", wrongStore: true },
    });

    for (const scan of wrongStoreScans) {
      const tracking = scan.trackingNo ?? scan.id;
      const existing = await prisma.darazAlert.findFirst({
        where: { alertType: "wrong_store", notes: { contains: tracking } },
      });
      if (existing) { skipped++; continue; }
      await prisma.darazAlert.create({
        data: {
          darazOrderId: scan.darazOrderId ?? "unknown",
          productName: scan.itemName ?? scan.productName ?? "Unknown Item",
          alertType: "wrong_store",
          status: "unresolved",
          notes: `Tracking: ${tracking} — गलत store मा inbound scan भयो। Scanned by: ${scan.scannedBy ?? "unknown"}`,
        },
      });
      created++;
    }

    return NextResponse.json({ created, skipped });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}