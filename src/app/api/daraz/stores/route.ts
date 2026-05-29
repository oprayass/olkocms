import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const stores = await prisma.darazStore.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(stores);
  } catch {
    return NextResponse.json({ error: "Failed to fetch stores" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, storeName, isActive } = await req.json();
    const store = await prisma.darazStore.update({
      where: { id },
      data: { storeName, isActive },
    });
    return NextResponse.json(store);
  } catch {
    return NextResponse.json({ error: "Failed to update store" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.darazStore.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete store" }, { status: 500 });
  }
}
