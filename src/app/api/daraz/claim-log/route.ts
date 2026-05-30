export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const claimId = req.nextUrl.searchParams.get("claimId");
    if (!claimId) return NextResponse.json({ error: "claimId required" }, { status: 400 });
    const logs = await prisma.darazClaimLog.findMany({
      where: { claimId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 150) }, { status: 500 });
  }
}