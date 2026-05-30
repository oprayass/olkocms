import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // outbound_not_delivered alerts जसको order DarazOrder मा छैन (Unknown)
    const alerts = await prisma.darazAlert.findMany({
      where: { alertType: "outbound_not_delivered" },
      select: { id: true, darazOrderId: true },
    });

    let deleted = 0;
    let kept = 0;

    for (const alert of alerts) {
      // darazOrderId "unknown" वा DarazOrder मा छैन → delete
      if (!alert.darazOrderId || alert.darazOrderId === "unknown") {
        await prisma.darazAlert.delete({ where: { id: alert.id } });
        deleted++;
        continue;
      }
      const order = await prisma.darazOrder.findFirst({
        where: { darazOrderId: alert.darazOrderId },
        select: { id: true },
      });
      if (!order) {
        await prisma.darazAlert.delete({ where: { id: alert.id } });
        deleted++;
      } else {
        kept++;
      }
    }

    return NextResponse.json({ deleted, kept });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}