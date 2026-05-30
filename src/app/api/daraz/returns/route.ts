export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const claims = await prisma.darazClaim.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(claims);
  } catch (error) {
    return NextResponse.json({ error: "Failed to load returns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { trackingNo, quantity, returnType, notes } = await req.json();
    if (!trackingNo) return NextResponse.json({ error: "Tracking number required" }, { status: 400 });
    const claim = await prisma.darazClaim.create({
      data: {
        trackingNo,
        quantity: quantity || 1,
        returnType,
        staffClaim: notes,
        claimStatus: "pending",
        scannedBy: session?.user?.name || "unknown",
      },
    });
    return NextResponse.json(claim);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save return" }, { status: 500 });
  }
}
