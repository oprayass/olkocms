import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    let created = 0;
    let skipped = 0;

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    // 1. Outbound scans — DarazOrder मा status ready_to_ship नै छ वा order नै छैन
    const outboundScans = await prisma.darazScan.findMany({
      where: { scanType: "outbound", trackingNo: { not: null } },
    });

    for (const scan of outboundScans) {
      const tracking = scan.trackingNo!;

      const order = await prisma.darazOrder.findFirst({
        where: { trackingNo: tracking },
      });

      const shouldAlert =
        !order || order.status === "ready_to_ship" || order.status === "pending";

      if (!shouldAlert) { skipped++; continue; }

      const existing = await prisma.darazAlert.findFirst({
        where: {
          alertType: "outbound_not_delivered",
          notes: { contains: tracking },
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
          notes: `Tracking: ${tracking} — outbound scan भयो तर Daraz मा delivery update भएन। Order status: ${order?.status ?? "not found"}। Scanned by: ${scan.scannedBy ?? "unknown"} on ${scan.createdAt.toLocaleDateString()}`,
        },
      });
      created++;
    }

    // 2. DarazOrders मा return/failed — inbound scan छैन
    const returnOrders = await prisma.darazOrder.findMany({
      where: {
        status: { in: ["returned", "failed_delivery", "shipped_back", "shipped_back_success"] },
        trackingNo: { not: null },
      },
    });

    for (const order of returnOrders) {
      const tracking = order.trackingNo!;

      const inbound = await prisma.darazScan.findFirst({
        where: { scanType: "inbound", trackingNo: tracking },
      });
      if (inbound) { skipped++; continue; }

      const existing = await prisma.darazAlert.findFirst({
        where: {
          alertType: "return_not_received",
          notes: { contains: tracking },
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
          notes: `Tracking: ${tracking} — Daraz मा status "${order.status}" छ तर store मा inbound scan भएन। Store: ${order.storeId ?? "unknown"}। Order date: ${order.orderDate?.toLocaleDateString() ?? "unknown"}`,
        },
      });
      created++;
    }

    // 3. Wrong-store inbound scans
    const wrongStoreScans = await prisma.darazScan.findMany({
      where: { scanType: "inbound", wrongStore: true },
    });

    for (const scan of wrongStoreScans) {
      const tracking = scan.trackingNo ?? scan.id;
      const existing = await prisma.darazAlert.findFirst({
        where: {
          alertType: "wrong_store",
          notes: { contains: tracking },
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
          notes: `Tracking: ${tracking} — गलत store मा inbound scan भयो। Scanned by: ${scan.scannedBy ?? "unknown"} on ${scan.createdAt.toLocaleDateString()}`,
        },
      });
      created++;
    }

    return NextResponse.json({ created, skipped });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}