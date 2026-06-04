export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Diagnostic: what tracking prefixes/formats exist in DarazOrderItem?
// Helps decide if "PND" tracking from scans actually appears in our Daraz data.
export async function GET() {
  try {
    const items = await prisma.darazOrderItem.findMany({
      where: { trackingNo: { not: null } },
      select: { trackingNo: true, status: true },
      take: 5000,
    });

    const prefixCount: Record<string, number> = {};
    const pndSamples: { trackingNo: string; status: string | null }[] = [];

    for (const it of items) {
      const t = it.trackingNo || "";
      // first 5 chars as a rough "prefix" bucket
      const prefix = t.replace(/[^A-Za-z]/g, "").substring(0, 5).toUpperCase() || "(none)";
      prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
      if (t.toUpperCase().includes("PND") && pndSamples.length < 15) {
        pndSamples.push({ trackingNo: t, status: it.status });
      }
    }

    return NextResponse.json({
      totalWithTracking: items.length,
      prefixCount,
      pndSamples,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}