import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nepalTodayStartUTC } from "@/lib/nepalTime";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
  const todayStart = nepalTodayStartUTC();
    const [todayCount, totalCount, wrongStoreCount, recentScans] = await Promise.all([
      prisma.darazScan.count({ where: { scanType: "inbound", deleted: false, createdAt: { gte: todayStart } } }),
      prisma.darazScan.count({ where: { scanType: "inbound", deleted: false } }),
      prisma.darazScan.count({ where: { scanType: "inbound", wrongStore: true, deleted: false } }),
      prisma.darazScan.findMany({
        where: { scanType: "inbound", deleted: false, createdAt: { gte: todayStart } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: { id: true, trackingNo: true, createdAt: true, scannedBy: true, wrongStore: true, storeId: true, itemName: true },
      }),
    ]);
    return NextResponse.json({ todayCount, totalCount, wrongStoreCount, recentScans });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch stats: " + String(err).substring(0, 120) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const scannedBy = session?.user?.name || session?.user?.email || "unknown";
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

    // Duplicate check: has this trackingNo already been inbound-scanned?
    const existing = await prisma.darazScan.findFirst({
      where: { trackingNo, scanType: "inbound" },
      orderBy: { createdAt: "desc" },
    });
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
    if (existing && force) {
      await prisma.darazScan.delete({ where: { id: existing.id } });
    }
    // Wrong-store detection: is this tracking in any of our DarazClaim (Daraz returns)?
    const claim = await prisma.darazClaim.findFirst({
      where: { trackingNo },
      select: { storeId: true, itemName: true, customerName: true, darazOrderId: true, price: true },
    });
    const wrongStore = !claim; // not found in any of our stores -> wrong/unknown
    let storeName: string | null = null;
    if (claim?.storeId) {
      const store = await prisma.darazStore.findUnique({ where: { id: claim.storeId }, select: { storeName: true } });
      storeName = store?.storeName || null;
    }
    const scan = await prisma.darazScan.create({
      data: {
        trackingNo,
        scanType: "inbound",
        scannedBy,
        storeId: claim?.storeId || null,
        wrongStore,
        itemName: claim?.itemName || null,
        customerName: claim?.customerName || null,
        darazOrderId: claim?.darazOrderId || null,
        price: claim?.price || null,
      },
    });
    return NextResponse.json({
      success: true,
      scan,
      wrongStore,
      matchedStore: storeName,
      matchedItem: claim?.itemName || null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save scan: " + String(err).substring(0, 150) }, { status: 500 });
  }
}