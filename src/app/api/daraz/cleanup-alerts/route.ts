import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const deleted = await prisma.darazAlert.deleteMany({
      where: { alertType: "outbound_not_in_daraz" },
    });
    return NextResponse.json({ deleted: deleted.count });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}