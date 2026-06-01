export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tracking = searchParams.get("tracking");
    const orderId = searchParams.get("order_id");

    const totalItems = await prisma.darazOrderItem.count();
    const withReturnTracking = await prisma.darazOrderItem.count({ where: { returnTrackingNo: { not: null } } });
    const withReverseId = await prisma.darazOrderItem.count({ where: { reverseOrderId: { not: null } } });

    let match: any = null;
    if (tracking) {
      match = await prisma.darazOrderItem.findMany({
        where: { OR: [{ trackingNo: tracking }, { returnTrackingNo: tracking }] },
      });
    } else if (orderId) {
      match = await prisma.darazOrderItem.findMany({ where: { darazOrderId: orderId } });
    }

    return NextResponse.json({ totalItems, withReturnTracking, withReverseId, query: tracking || orderId || null, match });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}