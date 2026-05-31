import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET() {
  const scans = await prisma.darazScan.findMany({
    where: { trackingNo: { not: null } },
    select: { trackingNo: true },
    take: 5000,
  });
  const orders = await prisma.darazOrder.findMany({
    where: { trackingNo: { not: null } },
    select: { trackingNo: true },
    take: 5000,
  });

  const all = [...scans.map(s => s.trackingNo!), ...orders.map(o => o.trackingNo!)];

  const patternMap: Record<string, { count: number; examples: string[] }> = {};
  const prefixMap: Record<string, number> = {};

  for (const t of all) {
    const tracking = t.trim();
    if (!tracking) continue;

    const prefixMatch = tracking.match(/^[A-Za-z]+/);
    const prefix = prefixMatch ? prefixMatch[0].toUpperCase() : "(no-prefix)";
    prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;

    const pattern = tracking.replace(/[A-Za-z]/g, "A").replace(/[0-9]/g, "9");
    if (!patternMap[pattern]) patternMap[pattern] = { count: 0, examples: [] };
    patternMap[pattern].count++;
    if (patternMap[pattern].examples.length < 3) patternMap[pattern].examples.push(tracking);
  }

  const patterns = Object.entries(patternMap)
    .map(([pattern, data]) => ({ pattern, ...data }))
    .sort((a, b) => b.count - a.count);

  const prefixes = Object.entries(prefixMap)
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalTracking: all.length,
    topPatterns: patterns.slice(0, 20),
    prefixes,
  });
}