import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    let updated = 0;
    let skipped = 0;
    let noTracking = 0;

    // trackingNo null भएका outbound scans जसमा darazOrderId छ
    const scans = await prisma.darazScan.findMany({
      where: {
        scanType: "outbound",
        trackingNo: null,
        darazOrderId: { not: null },
      },
      select: { id: true, darazOrderId: true },
    });

    for (const scan of scans) {
      const order = await prisma.darazOrder.findFirst({
        where: { darazOrderId: scan.darazOrderId! },
        select: { trackingNo: true, product: true, storeId: true },
      });

      if (!order?.trackingNo) { noTracking++; continue; }

      await prisma.darazScan.update({
        where: { id: scan.id },
        data: {
          trackingNo: order.trackingNo,
          itemName: order.product ?? undefined,
          storeId: order.storeId ?? undefined,
        },
      });
      updated++;
    }

    // inbound scans पनि fix गरौं
    const inboundScans = await prisma.darazScan.findMany({
      where: {
        scanType: "inbound",
        trackingNo: null,
        darazOrderId: { not: null },
      },
      select: { id: true, darazOrderId: true },
    });

    for (const scan of inboundScans) {
      const order = await prisma.darazOrder.findFirst({
        where: { darazOrderId: scan.darazOrderId! },
        select: { trackingNo: true, product: true, storeId: true },
      });

      if (!order?.trackingNo) { noTracking++; continue; }

      await prisma.darazScan.update({
        where: { id: scan.id },
        data: {
          trackingNo: order.trackingNo,
          itemName: order.product ?? undefined,
          storeId: order.storeId ?? undefined,
        },
      });
      updated++;
    }

    return NextResponse.json({ updated, skipped, noTracking, totalScans: scans.length + inboundScans.length });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}