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

// Update claim financial / status details
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Claim id required" }, { status: 400 });

    const data: any = {};
    // only set fields that were provided
    if ("qcComment" in body) data.qcComment = body.qcComment;
    if ("claimDecision" in body) data.claimDecision = body.claimDecision;
    if ("itemCondition" in body) data.itemCondition = body.itemCondition;
    if ("claimReason" in body) data.claimReason = body.claimReason;
    if ("claimType" in body) data.claimType = body.claimType;
    if ("claimedAmount" in body) data.claimedAmount = body.claimedAmount === "" || body.claimedAmount == null ? null : parseFloat(body.claimedAmount);
    if ("receivedAmount" in body) data.receivedAmount = body.receivedAmount === "" || body.receivedAmount == null ? null : parseFloat(body.receivedAmount);
    if ("claimStatus" in body) data.claimStatus = body.claimStatus;
    if ("claimNote" in body) data.claimNote = body.claimNote;
    if ("claimDate" in body) data.claimDate = body.claimDate ? new Date(body.claimDate) : null;

    // status approved/rejected भए resolvedAt set
    if (body.claimStatus === "approved" || body.claimStatus === "rejected") {
      data.resolvedAt = new Date();
    }
    data.scannedBy = session?.user?.name || undefined;

    const updated = await prisma.darazClaim.update({
      where: { id },
      data,
    });
    return NextResponse.json({ success: true, claim: updated });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}