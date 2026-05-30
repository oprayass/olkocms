import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, totalCount, recentScans] = await Promise.all([
      prisma.darazScan.count({
        where: { scanType: "outbound", createdAt: { gte: todayStart } },
      }),
      prisma.darazScan.count({ where: { scanType: "outbound" } }),
      prisma.darazScan.findMany({
        where: { scanType: "outbound", createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { trackingNo: true, createdAt: true, scannedBy: true },
      }),
    ]);

    return NextResponse.json({ todayCount, totalCount, recentScans });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { trackingNo, force } = await req.json();
    if (!trackingNo) return NextResponse.json({ error: "Tracking number required" }, { status: 400 });

    // Duplicate check — यो trackingNo पहिले outbound scan भएको छ?
    const existing = await prisma.darazScan.findFirst({
      where: { trackingNo, scanType: "outbound" },
      orderBy: { createdAt: "desc" },
    });

    // पहिले scan भएको छ र force=true छैन → duplicate alert फर्काउने (save नगरी)
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

    // force=true → पुरानो delete गरेर नयाँ बनाउने
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
  } catch {
    return NextResponse.json({ error: "Failed to save scan" }, { status: 500 });
  }
}