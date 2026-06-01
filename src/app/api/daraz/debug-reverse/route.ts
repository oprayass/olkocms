export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tracking = searchParams.get("tracking");
    const orderId = searchParams.get("order_id");

    const totalItems = await prisma.darazOrderItem.count();
    const withTracking = await prisma.darazOrderItem.count({ where: { trackingNo: { not: null } } });

    let match: any = null;
    if (tracking) {
      match = await prisma.darazOrderItem.findMany({ where: { trackingNo: tracking } });
    } else if (orderId) {
      match = await prisma.darazOrderItem.findMany({ where: { darazOrderId: orderId } });
    }

    const nullTracking = await prisma.darazOrderItem.groupBy({ by: ["status"], where: { trackingNo: null }, _count: { _all: true } });
    const withTrackingByStatus = await prisma.darazOrderItem.groupBy({ by: ["status"], where: { trackingNo: { not: null } }, _count: { _all: true } });
    return NextResponse.json({ totalItems, withTracking, nullTrackingByStatus: nullTracking, withTrackingByStatus, query: tracking || orderId || null, match });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}