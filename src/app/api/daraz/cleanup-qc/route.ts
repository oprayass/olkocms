export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // shipment provider वाला qcComment खोज्ने (Drop-off / Delivery / NP- भएको)
    const claims = await prisma.darazClaim.findMany({
      where: {
        qcComment: { not: null },
      },
      select: { id: true, qcComment: true },
    });

    let cleared = 0;
    for (const c of claims) {
      const v = c.qcComment || "";
      if (v.includes("Drop-off") || v.includes("Delivery:") || v.includes("NP-DEX") || v.includes("Pickup")) {
        await prisma.darazClaim.update({
          where: { id: c.id },
          data: { qcComment: null },
        });
        cleared++;
      }
    }

    return NextResponse.json({ success: true, checked: claims.length, cleared });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}