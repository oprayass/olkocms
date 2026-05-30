import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = parseInt(body?.offset ?? "0") || 0;
    const limit = 200;

    let created = 0;
    let skipped = 0;
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // 1. Outbound scans — last 10 days मात्र
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const outboundScans = await prisma.darazScan.findMany({
      where: {
        scanType: "outbound",
        createdAt: { gte: tenDaysAgo },
        OR: [
          { trackingNo: { not: null } },
          { darazOrderId: { not: null } },
        ],
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    for (const scan of outboundScans) {
      // DarazOrder मा match — trackingNo वा darazOrderId
      const order = await prisma.darazOrder.findFirst({
        where: {
          OR: [
            scan.trackingNo ? { trackingNo: scan.trackingNo } : {},
            scan.darazOrderId ? { darazOrderId: scan.darazOrderId } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });

      const shouldAlert =
        !order ||
        order.status === "ready_to_ship" ||
        order.status === "pending";

      if (!shouldAlert) { skipped++; continue; }

      // Duplicate alert check
      const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
      const existing = await prisma.darazAlert.findFirst({
        where: {
          alertType: "outbound_not_delivered",
          notes: { contains: alertKey },
          status: { not: "resolved" },
        },
      });
      if (existing) { skipped++; continue; }

      const isLost = scan.createdAt < twoMonthsAgo;
      await prisma.darazAlert.create({
        data: {
          darazOrderId: scan.darazOrderId ?? order?.darazOrderId ?? "unknown",
          productName: scan.itemName ?? scan.productName ?? order?.product ?? "Unknown Item",
          alertType: "outbound_not_delivered",
          status: isLost ? "lost" : "unresolved",
          notes: `Order: ${scan.darazOrderId ?? "unknown"} | Tracking: ${scan.trackingNo ?? "none"} — outbound scan भयो तर Daraz मा delivery update भएन। Status: ${order?.status ?? "not found"}। Scanned by: ${scan.scannedBy ?? "unknown"} on ${scan.createdAt.toLocaleDateString()}`,
        },
      });
      created++;
    }

    const totalOutbound = await prisma.darazScan.count({
      where: {
        scanType: "outbound",
        OR: [
          { trackingNo: { not: null } },
          { darazOrderId: { not: null } },
        ],
      },
    });

    // 2. Return orders — offset 0 मा मात्र
    if (offset === 0) {
      const returnOrders = await prisma.darazOrder.findMany({
        where: {
          status: { in: ["returned", "failed_delivery", "shipped_back", "shipped_back_success"] },
        },
      });

      for (const order of returnOrders) {
        // inbound scan — trackingNo वा darazOrderId बाट match
        const inbound = await prisma.darazScan.findFirst({
          where: {
            scanType: "inbound",
            OR: [
              order.trackingNo ? { trackingNo: order.trackingNo } : {},
              { darazOrderId: order.darazOrderId },
            ].filter((o) => Object.keys(o).length > 0),
          },
        });
        if (inbound) { skipped++; continue; }

        const alertKey = order.trackingNo ?? order.darazOrderId;
        const existing = await prisma.darazAlert.findFirst({
          where: {
            alertType: "return_not_received",
            notes: { contains: alertKey },
            status: { not: "resolved" },
          },
        });
        if (existing) { skipped++; continue; }

        await prisma.darazAlert.create({
          data: {
            darazOrderId: order.darazOrderId,
            productName: order.product,
            alertType: "return_not_received",
            status: "unresolved",
            notes: `Order: ${order.darazOrderId} | Tracking: ${order.trackingNo ?? "none"} — Daraz मा status "${order.status}" छ तर store मा inbound scan भएन। Store: ${order.storeId ?? "unknown"}`,
          },
        });
        created++;
      }

      // 3. Wrong store
      const wrongStoreScans = await prisma.darazScan.findMany({
        where: { scanType: "inbound", wrongStore: true },
      });
      for (const scan of wrongStoreScans) {
        const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
        const existing = await prisma.darazAlert.findFirst({
          where: {
            alertType: "wrong_store",
            notes: { contains: alertKey },
            status: { not: "resolved" },
          },
        });
        if (existing) { skipped++; continue; }
        await prisma.darazAlert.create({
          data: {
            darazOrderId: scan.darazOrderId ?? "unknown",
            productName: scan.itemName ?? scan.productName ?? "Unknown Item",
            alertType: "wrong_store",
            status: "unresolved",
            notes: `Order: ${scan.darazOrderId ?? "unknown"} | Tracking: ${scan.trackingNo ?? "none"} — गलत store मा inbound scan भयो। Scanned by: ${scan.scannedBy ?? "unknown"}`,
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