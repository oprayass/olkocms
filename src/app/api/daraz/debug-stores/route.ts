export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stores = await prisma.darazStore.findMany({
    select: {
      id: true,
      storeName: true,
      lastOrderFetch: true,
      lastReturnFetch: true,
    },
  });
  return NextResponse.json({ stores });
}