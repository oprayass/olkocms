import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const claims = await prisma.darazClaim.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(claims);
  } catch {
    return NextResponse.json({ error: "Failed to fetch claims" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, claimStatus, claimResult } = await req.json();
    const claim = await prisma.darazClaim.update({
      where: { id },
      data: {
        claimStatus,
        claimResult,
        resolvedAt: claimStatus === "approved" || claimStatus === "rejected" ? new Date() : null,
      },
    });
    return NextResponse.json(claim);
  } catch {
    return NextResponse.json({ error: "Failed to update claim" }, { status: 500 });
  }
}
