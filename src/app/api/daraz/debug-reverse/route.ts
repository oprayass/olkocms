export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tracking = searchParams.get("tracking");

    const totalItems = await prisma.darazOrderItem.count();
    const withTracking = await prisma.darazOrderItem.count({ where: { trackingNo: { not: null } } });
    const withReturnTracking = await prisma.darazOrderItem.count({ where: { returnTrackingNo: { not: null } } });
    const withReverseId = await prisma.darazOrderItem.count({ where: { reverseOrderId: { not: null } } });
    const whqcMerchant = await prisma.darazOrderItem.count({ where: { whqcDecision: "return_to_merchant" } });
    const whqcCustomer = await prisma.darazOrderItem.count({ where: { whqcDecision: "return_to_customer" } });

    let match: any = null;
    if (tracking) {
      match = await prisma.darazOrderItem.findMany({ where: { OR: [{ trackingNo: tracking }, { returnTrackingNo: tracking }] } });
    }

    return NextResponse.json({ totalItems, withTracking, withReturnTracking, withReverseId, whqcMerchant, whqcCustomer, match });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}