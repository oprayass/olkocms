import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  const outbound = await prisma.darazScan.count({ where: { scanType: "outbound" } });
  const inbound = await prisma.darazScan.count({ where: { scanType: "inbound" } });
  const sample = await prisma.darazScan.findMany({ where: { scanType: "outbound" }, take: 3 });
  return NextResponse.json({ outbound, inbound, sample });
}