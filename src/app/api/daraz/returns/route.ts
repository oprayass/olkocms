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

// human-readable labels for log
const FIELD_LABELS: Record<string, string> = {
  qcComment: "Daraz QC Reason",
  claimDecision: "Claim Decision",
  itemCondition: "Item Condition",
  claimReason: "Claim Reason",
  claimType: "Claim Type",
  claimedAmount: "Claimed Amount",
  receivedAmount: "Received Amount",
  claimStatus: "Claim Status",
  claimNote: "Note",
  claimDate: "Claim Date",
};

function fmt(v: any): string {
  if (v == null || v === "") return "—";
  if (v instanceof Date) return v.toISOString().substring(0, 10);
  return String(v);
}

// Update claim details + write audit log per changed field
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const changedBy = session?.user?.name || session?.user?.email || "unknown";
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Claim id required" }, { status: 400 });

    // existing claim (for diff)
    const before = await prisma.darazClaim.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    const data: any = {};
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

    if (body.claimStatus === "approved" || body.claimStatus === "rejected") {
      data.resolvedAt = new Date();
    }
    data.scannedBy = changedBy;

    // diff → log entries
    const logs: { claimId: string; field: string; oldValue: string; newValue: string; changedBy: string }[] = [];
    for (const key of Object.keys(data)) {
      if (key === "scannedBy" || key === "resolvedAt") continue;
      const oldV = (before as any)[key];
      const newV = data[key];
      const oldStr = fmt(oldV instanceof Date ? oldV : oldV);
      const newStr = fmt(newV);
      if (oldStr !== newStr) {
        logs.push({
          claimId: id,
          field: FIELD_LABELS[key] || key,
          oldValue: oldStr,
          newValue: newStr,
          changedBy,
        });
      }
    }

    const updated = await prisma.darazClaim.update({ where: { id }, data });

    if (logs.length > 0) {
      await prisma.darazClaimLog.createMany({ data: logs });
    }

    return NextResponse.json({ success: true, claim: updated, logged: logs.length });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}