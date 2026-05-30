import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const alerts = await prisma.darazAlert.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const alert = await prisma.darazAlert.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "resolved" ? new Date() : null,
      },
    });
    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const deleted = await prisma.darazAlert.deleteMany({});
    return NextResponse.json({ deleted: deleted.count });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}