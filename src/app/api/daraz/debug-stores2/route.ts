import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET() {
  // DarazOrder मा भएका सबै unique storeId
  const orders = await prisma.darazOrder.findMany({
    select: { storeId: true },
    distinct: ["storeId"],
  });
  // DarazScan मा भएका सबै unique storeId
  const scans = await prisma.darazScan.findMany({
    select: { storeId: true },
    distinct: ["storeId"],
  });
  // DarazStore table छ कि — store master
  let stores = null;
  try {
    stores = await prisma.darazStore.findMany();
  } catch { stores = "no DarazStore model"; }
  return NextResponse.json({
    orderStoreIds: orders.map((o) => o.storeId),
    scanStoreIds: scans.map((s) => s.storeId),
    stores,
  });
}