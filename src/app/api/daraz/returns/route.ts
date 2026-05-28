import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { trackingNo, quantity, returnType, notes } = await req.json();
    if (!trackingNo) return NextResponse.json({ error: "Tracking number required" }, { status: 400 });

    const scan = await prisma.darazScan.create({
      data: {
        trackingNo,
        scanType: "return",
        quantity: quantity || 1,
        returnType,
        notes,
        scannedBy: session?.user?.name || "unknown",
      },
    });
    return NextResponse.json(scan);
  } catch (error) {
    return NextResponse.json({ error: "Failed to save return" }, { status: 500 });
  }
}
