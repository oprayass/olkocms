export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time backfill: existing DarazScan rows whose trackingNo contains "/"
// (e.g. PND/NP/000722689) are rewritten to dash form (PND-NP-000722689) so they
// match Daraz tracking (which uses dashes). Run once via GET, then delete this route.
export async function GET() {
  try {
    const slashScans = await prisma.darazScan.findMany({
      where: { trackingNo: { contains: "/" } },
      select: { id: true, trackingNo: true },
    });

    let updated = 0;
    const samples: { from: string; to: string }[] = [];
    for (const s of slashScans) {
      const from = s.trackingNo || "";
      const to = from.replace(/\//g, "-").trim();
      if (to !== from) {
        await prisma.darazScan.update({ where: { id: s.id }, data: { trackingNo: to } });
        updated++;
        if (samples.length < 10) samples.push({ from, to });
      }
    }

    return NextResponse.json({ found: slashScans.length, updated, samples });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}