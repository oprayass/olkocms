import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Central-DB-first reconciliation. Runs AFTER resolve-scans (which attaches real
// order data to scans and clears wrongStore on matched inbound scans).
// Derives three DarazAlert types purely from central DarazOrderItem + DarazScan:
//   A) outbound_not_delivered : outbound scan exists, but central shows no delivery progress.
//   B) return_not_received     : central expects an inbound (customer return OR failed delivery), but no inbound scan.
//   C) wrong_store             : inbound scan still flagged wrongStore (resolve-scans could not match).
// All DarazScan reads filter deleted:false.

const FAILED_STATUSES = ["shipped_back", "failed_delivery", "returned", "shipped_back_success"];
const DELIVERED_OR_DONE = [
  "delivered",
  "shipped",
  "transit_to_ship",
  "shipped_back",
  "returned",
  "canceled",
  "cancelled",
];

async function alertExists(alertType: string, alertKey: string) {
  const existing = await prisma.darazAlert.findFirst({
    where: {
      alertType,
      notes: { contains: alertKey },
      status: { not: "resolved" },
    },
  });
  return !!existing;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = parseInt(body?.offset ?? "0") || 0;
    const limit = 200;

    let created = 0;
    let skipped = 0;

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const CUTOFF = new Date("2026-05-01T00:00:00+05:45"); // only alert on outbound scanned on/after 1 May 2026


    // offset 0: clear stale outbound alerts whose order is now delivered/done.
    if (offset === 0) {
      const stale = await prisma.darazAlert.findMany({
        where: { alertType: "outbound_not_delivered" },
        select: { id: true, darazOrderId: true },
      });
      for (const a of stale) {
        if (!a.darazOrderId || a.darazOrderId === "unknown") {
          await prisma.darazAlert.delete({ where: { id: a.id } });
          continue;
        }
        const ord = await prisma.darazOrder.findFirst({
          where: { darazOrderId: a.darazOrderId },
          select: { status: true },
        });
        if (ord && DELIVERED_OR_DONE.includes((ord.status ?? "").toLowerCase())) {
          await prisma.darazAlert.delete({ where: { id: a.id } });
        }
      }
    }

    // ---------- A) outbound_not_delivered (paginated) ----------
    const outboundScans = await prisma.darazScan.findMany({
      where: {
        deleted: false,
        scanType: "outbound",
        createdAt: { gte: CUTOFF },
        OR: [{ trackingNo: { not: null } }, { darazOrderId: { not: null } }],
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    for (const scan of outboundScans) {
      // Look up the order status in central DarazOrder (by tracking or orderId).
      const order = await prisma.darazOrder.findFirst({
        where: {
          OR: [
            scan.trackingNo ? { trackingNo: scan.trackingNo } : {},
            scan.darazOrderId ? { darazOrderId: scan.darazOrderId } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });

      const status = (order?.status ?? "").toLowerCase();
      const shouldAlert =
        !order || !DELIVERED_OR_DONE.includes(status);
      if (!shouldAlert) {
        skipped++;
        continue;
      }

      const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
      if (await alertExists("outbound_not_delivered", alertKey)) {
        skipped++;
        continue;
      }

      const isLost = scan.createdAt < twoMonthsAgo;
      await prisma.darazAlert.create({
        data: {
          darazOrderId: scan.darazOrderId ?? order?.darazOrderId ?? "unknown",
          productName: scan.itemName ?? scan.productName ?? order?.product ?? "Unknown Item",
          alertType: "outbound_not_delivered",
          status: isLost ? "lost" : "unresolved",
          notes: `Tracking: ${scan.trackingNo ?? "none"} | Order: ${scan.darazOrderId ?? "unknown"} - outbound scanned but no delivery progress in central DB. Status: ${order?.status ?? "not found"}. Scanned by: ${scan.scannedBy ?? "unknown"} on ${scan.createdAt.toLocaleDateString()}`,
        },
      });
      created++;
    }

    const totalOutbound = await prisma.darazScan.count({
      where: {
        deleted: false,
        scanType: "outbound",
        OR: [{ trackingNo: { not: null } }, { darazOrderId: { not: null } }],
      },
    });

    // ---------- B) return_not_received + C) wrong_store (offset 0 only) ----------
    if (offset === 0) {
      // Expected inbound from central DarazOrderItem:
      //   (b1) customer return: whqcDecision return_to_merchant, has returnTrackingNo
      //   (b2) failed delivery: status in FAILED_STATUSES, has trackingNo
      const expectedReturns = await prisma.darazOrderItem.findMany({
        where: {
          OR: [
            { whqcDecision: "return_to_merchant", returnTrackingNo: { not: null } },
            { status: { in: FAILED_STATUSES }, trackingNo: { not: null } },
          ],
        },
      });

      for (const item of expectedReturns) {
        // The tracking the warehouse would scan on inbound:
        //   customer return -> returnTrackingNo ; failed delivery -> trackingNo
        const isMerchantReturn = item.whqcDecision === "return_to_merchant" && !!item.returnTrackingNo;
        const inboundTracking = isMerchantReturn ? item.returnTrackingNo : item.trackingNo;
        if (!inboundTracking) {
          skipped++;
          continue;
        }

        // Was it inbound-scanned? (deleted:false; match by the inbound tracking, or by orderId.)
        const inbound = await prisma.darazScan.findFirst({
          where: {
            deleted: false,
            scanType: "inbound",
            OR: [
              { trackingNo: inboundTracking },
              item.darazOrderId ? { darazOrderId: item.darazOrderId } : {},
            ].filter((o) => Object.keys(o).length > 0),
          },
        });
        if (inbound) {
          skipped++;
          continue;
        }

        const alertKey = inboundTracking;
        if (await alertExists("return_not_received", alertKey)) {
          skipped++;
          continue;
        }

        const kind = isMerchantReturn ? "customer return" : "failed delivery";
        await prisma.darazAlert.create({
          data: {
            darazOrderId: item.darazOrderId ?? "unknown",
            productName: item.itemName ?? "Unknown Item",
            alertType: "return_not_received",
            status: "unresolved",
            notes: `Tracking: ${inboundTracking} | Order: ${item.darazOrderId ?? "unknown"} - central DB shows ${kind} (status ${item.status ?? item.whqcDecision ?? "?"}) but no inbound scan. Store: ${item.storeId ?? "unknown"}`,
          },
        });
        created++;
      }

      // C) wrong_store: inbound scans resolve-scans could not match.
      const wrongStoreScans = await prisma.darazScan.findMany({
        where: { deleted: false, scanType: "inbound", wrongStore: true },
      });
      for (const scan of wrongStoreScans) {
        const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
        if (await alertExists("wrong_store", alertKey)) {
          skipped++;
          continue;
        }
        await prisma.darazAlert.create({
          data: {
            darazOrderId: scan.darazOrderId ?? "unknown",
            productName: scan.itemName ?? scan.productName ?? "Unknown Item",
            alertType: "wrong_store",
            status: "unresolved",
            notes: `Tracking: ${scan.trackingNo ?? "none"} | Order: ${scan.darazOrderId ?? "unknown"} - inbound scanned but tracking not found in central DB (wrong/unknown store). Scanned by: ${scan.scannedBy ?? "unknown"}`,
          },
        });
        created++;
      }
    }

    const nextOffset = offset + limit;
    const hasMore = nextOffset < totalOutbound;

    return NextResponse.json({
      created,
      skipped,
      offset,
      nextOffset: hasMore ? nextOffset : null,
      total: totalOutbound,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}