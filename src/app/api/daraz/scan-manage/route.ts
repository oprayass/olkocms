import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { nepalTodayStartUTC } from "@/lib/nepalTime";

export const dynamic = "force-dynamic";

// GET Ã¢â‚¬â€ scans list (active Ã Â¤ÂµÃ Â¤Â¾ deleted), filter Ã Â¤Â¸Ã Â¤Â¹Ã Â¤Â¿Ã Â¤Â¤
export async function GET(req: NextRequest) {
  try {
    const scanType = req.nextUrl.searchParams.get("scanType"); // outbound | inbound
    const view = req.nextUrl.searchParams.get("view") || "active"; // active | deleted | wrongStore
    const dateFilter = req.nextUrl.searchParams.get("date"); // today | all

    // 30 days Ã Â¤Â­Ã Â¤Â¨Ã Â¥ÂÃ Â¤Â¦Ã Â¤Â¾ Ã Â¤ÂªÃ Â¥ÂÃ Â¤Â°Ã Â¤Â¾Ã Â¤Â¨Ã Â¤Â¾ deleted auto-purge
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await prisma.darazScan.deleteMany({
      where: { deleted: true, deletedAt: { lt: thirtyDaysAgo } },
    });

    const where: any = {};
    if (scanType) where.scanType = scanType;

    if (view === "deleted") {
      where.deleted = true;
    } else {
      where.deleted = false;
      if (view === "wrongStore") where.wrongStore = true;
    }

    if (dateFilter === "today" && view !== "deleted") {
      where.createdAt = { gte: nepalTodayStartUTC() };
    }

    const scans = await prisma.darazScan.findMany({
      where,
      orderBy: view === "deleted" ? { deletedAt: "desc" } : { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ scans });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}

// DELETE Ã¢â‚¬â€ soft delete (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Permission denied Ã¢â‚¬â€ admin Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â¤Ã Â¥ÂÃ Â¤Â° delete Ã Â¤â€”Ã Â¤Â°Ã Â¥ÂÃ Â¤Â¨ Ã Â¤Â¸Ã Â¤â€¢Ã Â¥ÂÃ Â¤â€º" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.darazScan.update({
      where: { id },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: session?.user?.name || session?.user?.email || "unknown",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}

// PATCH Ã¢â‚¬â€ undo (restore deleted scan)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.darazScan.update({
      where: { id },
      data: { deleted: false, deletedAt: null, deletedBy: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}