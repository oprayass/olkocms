import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStoreCuid } from "@/lib/storeMap";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    let updated = 0;
    let skipped = 0;

    // सबै scans जसको storeId cuid होइन (Excel text वा email)
    const scans = await prisma.darazScan.findMany({
      where: { storeId: { not: null } },
      select: { id: true, storeId: true },
    });

    for (const scan of scans) {
      const sid = scan.storeId!;
      // already cuid भए (c सँग सुरु + लामो) skip
      if (sid.startsWith("c") && sid.length > 20) { skipped++; continue; }

      const cuid = resolveStoreCuid(sid);
      if (cuid && cuid !== sid) {
        await prisma.darazScan.update({
          where: { id: scan.id },
          data: { storeId: cuid },
        });
        updated++;
      } else {
        skipped++;
      }
    }

    // claims पनि fix
    const claims = await prisma.darazClaim.findMany({
      where: { storeId: { not: null } },
      select: { id: true, storeId: true },
    });

    for (const claim of claims) {
      const sid = claim.storeId!;
      if (sid.startsWith("c") && sid.length > 20) { skipped++; continue; }

      const cuid = resolveStoreCuid(sid);
      if (cuid && cuid !== sid) {
        await prisma.darazClaim.update({
          where: { id: claim.id },
          data: { storeId: cuid },
        });
        updated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ updated, skipped });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}