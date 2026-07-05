import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { nepalTodayStartUTC } from "@/lib/nepalTime";
import { withTenant } from "@/lib/with-tenant";

export const GET = withTenant(async () => {
  try {
    const todayStart = nepalTodayStartUTC();
    const [todayCount, totalCount, recentScans] = await Promise.all([
      prisma.darazScan.count({
        where: { scanType: "outbound", deleted: false, createdAt: { gte: todayStart } },
      }),
      prisma.darazScan.count({ where: { scanType: "outbound", deleted: false } }),
      prisma.darazScan.findMany({
        where: { scanType: "outbound", deleted: false, createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, trackingNo: true, createdAt: true, scannedBy: true },
      }),
    ]);
    return NextResponse.json({ todayCount, totalCount, recentScans });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
});

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const force = body.force;
    // Normalize tracking: scans may arrive as PND/NP/... (slash) but Daraz stores
    // PND-NP-... (dash). Convert all slashes to dashes so they match. DEX/UPA have
    // no separators and are unaffected.
    const trackingNo =
      typeof body.trackingNo === "string"
        ? body.trackingNo.replace(/\//g, "-").trim()
        : body.trackingNo;
    if (!trackingNo) return NextResponse.json({ error: "Tracking number required" }, { status: 400 });

    // Duplicate check (tenant-scoped): has this trackingNo already been outbound-scanned?
    const existing = await prisma.darazScan.findFirst({
      where: { trackingNo, scanType: "outbound" },
      orderBy: { createdAt: "desc" },
    });
    // Already scanned and force=false -> return duplicate info (do not save).
    if (existing && !force) {
      return NextResponse.json({
        duplicate: true,
        existing: {
          id: existing.id,
          trackingNo: existing.trackingNo,
          scannedAt: existing.createdAt,
          scannedBy: existing.scannedBy || "unknown",
        },
      });
    }
    // force=true -> delete the old one and create a new scan.
    if (existing && force) {
      await prisma.darazScan.delete({ where: { id: existing.id } });
    }
    const scan = await prisma.darazScan.create({
      data: {
        trackingNo,
        scanType: "outbound",
        scannedBy: session?.user?.name || session?.user?.email || "unknown",
      },
    });
    return NextResponse.json({ success: true, scan });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save scan: " + String(err).substring(0, 150) }, { status: 500 });
  }
});
