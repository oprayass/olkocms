export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Diagnostic: understand the outbound scans that turn into "unknown" alerts.
export async function GET() {
  try {
    const total = await prisma.darazScan.count({
      where: { deleted: false, scanType: "outbound" },
    });
    const withTracking = await prisma.darazScan.count({
      where: { deleted: false, scanType: "outbound", trackingNo: { not: null } },
    });
    const withOrderId = await prisma.darazScan.count({
      where: { deleted: false, scanType: "outbound", darazOrderId: { not: null } },
    });
    const noTrackingNoOrder = await prisma.darazScan.count({
      where: { deleted: false, scanType: "outbound", trackingNo: null, darazOrderId: null },
    });

    // Date spread
    const oldest = await prisma.darazScan.findFirst({
      where: { deleted: false, scanType: "outbound" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, trackingNo: true },
    });
    const newest = await prisma.darazScan.findFirst({
      where: { deleted: false, scanType: "outbound" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, trackingNo: true },
    });

    // Take a sample of 20 outbound scans and check if each matches central DB.
    const sample = await prisma.darazScan.findMany({
      where: { deleted: false, scanType: "outbound", trackingNo: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { trackingNo: true, darazOrderId: true, createdAt: true, itemName: true },
    });

    let matchInOrderItem = 0;
    let matchInOrder = 0;
    let matchNothing = 0;
    const sampleDetail: any[] = [];
    for (const s of sample) {
      const inItem = s.trackingNo
        ? await prisma.darazOrderItem.findFirst({ where: { trackingNo: s.trackingNo }, select: { darazOrderId: true, status: true } })
        : null;
      const inOrder = s.trackingNo
        ? await prisma.darazOrder.findFirst({ where: { trackingNo: s.trackingNo }, select: { darazOrderId: true, status: true } })
        : null;
      if (inItem) matchInOrderItem++;
      else if (inOrder) matchInOrder++;
      else matchNothing++;
      sampleDetail.push({
        tracking: s.trackingNo,
        scanDate: s.createdAt,
        inOrderItem: inItem ? `${inItem.darazOrderId}/${inItem.status}` : null,
        inOrder: inOrder ? `${inOrder.darazOrderId}/${inOrder.status}` : null,
      });
    }

    return NextResponse.json({
      counts: { total, withTracking, withOrderId, noTrackingNoOrder },
      dateRange: { oldest, newest },
      sampleMatch: { matchInOrderItem, matchInOrder, matchNothing, sampleSize: sample.length },
      sampleDetail,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}