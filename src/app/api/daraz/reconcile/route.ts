import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, prismaUnscoped } from "@/lib/prisma";
import { withExplicitTenant } from "@/lib/with-tenant";

export const dynamic = "force-dynamic";

const FAILED_STATUSES = ["shipped_back", "failed_delivery", "returned", "shipped_back_success"];
const DELIVERED_OR_DONE = [
  "shipped_back_success",
  "failed_delivery",
  "delivered",
  "shipped",
  "transit_to_ship",
  "shipped_back",
  "returned",
  "canceled",
  "cancelled",
];

// Counts an alert as existing in ANY status (incl. resolved/lost) so a resolved
// alert is NOT re-created on the next reconcile/cron run. (resolve must stick.)
// Runs inside a tenant scope, so it only sees this tenant's alerts.
async function alertExists(alertType: string, alertKey: string) {
  const existing = await prisma.darazAlert.findFirst({
    where: {
      alertType,
      notes: { contains: alertKey },
    },
  });
  return !!existing;
}

type BatchResult = {
  created: number;
  skipped: number;
  offset: number;
  nextOffset: number | null;
  total: number;
};

// One reconcile batch for ONE tenant. Must run inside withExplicitTenant so
// scans, items, orders, and alert create/delete are all auto-scoped.
async function runBatchForTenant(offset: number, limit: number): Promise<BatchResult> {
  let created = 0;
  let skipped = 0;

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const CUTOFF = new Date("2026-05-01T00:00:00+05:45"); // only alert on outbound scanned on/after 1 May 2026

  // offset 0: clear stale outbound alerts whose item/order is now delivered/done.
  // Only touch still-open alerts; NEVER delete resolved/lost (keeps resolve sticky).
  if (offset === 0) {
    const stale = await prisma.darazAlert.findMany({
      where: {
        alertType: "outbound_not_delivered",
        status: { in: ["unresolved", "investigating"] },
      },
      select: { id: true, darazOrderId: true },
    });
    for (const a of stale) {
      if (!a.darazOrderId || a.darazOrderId === "unknown") {
        await prisma.darazAlert.delete({ where: { id: a.id } });
        continue;
      }
      const ord = await prisma.darazOrder.findFirst({
        where: { darazOrderId: a.darazOrderId },
        select: { status: true },
      });
      if (ord && DELIVERED_OR_DONE.includes((ord.status ?? "").toLowerCase())) {
        await prisma.darazAlert.delete({ where: { id: a.id } });
      }
    }
  }

  // ---------- A) outbound_not_delivered (paginated) ----------
  // Match the outbound scan against central DarazOrderItem FIRST (tracking lives
  // there, not in DarazOrder). Fall back to DarazOrder by orderId for status.
  const outboundScans = await prisma.darazScan.findMany({
    where: {
      deleted: false,
      scanType: "outbound",
      createdAt: { gte: CUTOFF },
      OR: [{ trackingNo: { not: null } }, { darazOrderId: { not: null } }],
    },
    skip: offset,
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  for (const scan of outboundScans) {
    // 1. Try the central item table by tracking (the real source of tracking).
    let item = null;
    if (scan.trackingNo) {
      item = await prisma.darazOrderItem.findFirst({
        where: { trackingNo: scan.trackingNo },
        select: { darazOrderId: true, status: true },
      });
    }
    if (!item && scan.darazOrderId) {
      item = await prisma.darazOrderItem.findFirst({
        where: { darazOrderId: scan.darazOrderId },
        select: { darazOrderId: true, status: true },
      });
    }

    // 2. Resolve a status: prefer the item status, else the order status.
    const resolvedOrderId = item?.darazOrderId ?? scan.darazOrderId ?? null;
    let status = (item?.status ?? "").toLowerCase();
    if (!status && resolvedOrderId) {
      const order = await prisma.darazOrder.findFirst({
        where: { darazOrderId: resolvedOrderId },
        select: { status: true },
      });
      status = (order?.status ?? "").toLowerCase();
    }

    // If we found a matching item/order AND it is delivered/done -> no alert.
    const hasMatch = !!item || !!resolvedOrderId;
    if (hasMatch && status && DELIVERED_OR_DONE.includes(status)) {
      skipped++;
      continue;
    }
    // Matched an item but status not yet populated (fresh/incomplete fetch).
    // Not a real "not delivered" -> skip; a later run with a real status decides.
    if (hasMatch && !status) {
      skipped++;
      continue;
    }

    const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
    if (await alertExists("outbound_not_delivered", alertKey)) {
      skipped++;
      continue;
    }

    const isLost = scan.createdAt < twoMonthsAgo;
    await prisma.darazAlert.create({
      data: {
        darazOrderId: resolvedOrderId ?? "unknown",
        productName: scan.itemName ?? scan.productName ?? "Unknown Item",
        alertType: "outbound_not_delivered",
        status: isLost ? "lost" : "unresolved",
        notes: `Tracking: ${scan.trackingNo ?? "none"} | Order: ${resolvedOrderId ?? "unknown"} - outbound scanned but no delivery progress in central DB. Status: ${status || "not found"}. Scanned by: ${scan.scannedBy ?? "unknown"} on ${scan.createdAt.toLocaleDateString()}`,
      },
    });
    created++;
  }

  const totalOutbound = await prisma.darazScan.count({
    where: {
      deleted: false,
      scanType: "outbound",
      OR: [{ trackingNo: { not: null } }, { darazOrderId: { not: null } }],
    },
  });

  // ---------- B) return_not_received + C) wrong_store (offset 0 only) ----------
  if (offset === 0) {
    const expectedReturns = await prisma.darazOrderItem.findMany({
      where: {
        OR: [
          { whqcDecision: "return_to_merchant", returnTrackingNo: { not: null } },
          { status: { in: FAILED_STATUSES }, trackingNo: { not: null } },
        ],
      },
    });

    for (const item of expectedReturns) {
      const isMerchantReturn = item.whqcDecision === "return_to_merchant" && !!item.returnTrackingNo;
      const inboundTracking = isMerchantReturn ? item.returnTrackingNo : item.trackingNo;
      if (!inboundTracking) {
        skipped++;
        continue;
      }

      const inbound = await prisma.darazScan.findFirst({
        where: {
          deleted: false,
          scanType: "inbound",
          OR: [
            { trackingNo: inboundTracking },
            item.darazOrderId ? { darazOrderId: item.darazOrderId } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });
      if (inbound) {
        skipped++;
        continue;
      }

      const alertKey = inboundTracking;
      if (await alertExists("return_not_received", alertKey)) {
        skipped++;
        continue;
      }

      const kind = isMerchantReturn ? "customer return" : "failed delivery";
      await prisma.darazAlert.create({
        data: {
          darazOrderId: item.darazOrderId ?? "unknown",
          productName: item.itemName ?? "Unknown Item",
          alertType: "return_not_received",
          status: "unresolved",
          notes: `Tracking: ${inboundTracking} | Order: ${item.darazOrderId ?? "unknown"} - central DB shows ${kind} (status ${item.status ?? item.whqcDecision ?? "?"}) but no inbound scan. Store: ${item.storeId ?? "unknown"}`,
        },
      });
      created++;
    }

    const wrongStoreScans = await prisma.darazScan.findMany({
      where: { deleted: false, scanType: "inbound", wrongStore: true },
    });
    for (const scan of wrongStoreScans) {
      const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
      if (await alertExists("wrong_store", alertKey)) {
        skipped++;
        continue;
      }
      await prisma.darazAlert.create({
        data: {
          darazOrderId: scan.darazOrderId ?? "unknown",
          productName: scan.itemName ?? scan.productName ?? "Unknown Item",
          alertType: "wrong_store",
          status: "unresolved",
          notes: `Tracking: ${scan.trackingNo ?? "none"} | Order: ${scan.darazOrderId ?? "unknown"} - inbound scanned but tracking not found in central DB (wrong/unknown store). Scanned by: ${scan.scannedBy ?? "unknown"}`,
        },
      });
      created++;
    }
  }

  const nextOffset = offset + limit;
  const hasMore = nextOffset < totalOutbound;

  return {
    created,
    skipped,
    offset,
    nextOffset: hasMore ? nextOffset : null,
    total: totalOutbound,
  };
}

export async function POST(req: NextRequest) {
  try {
    // ---- Gate: cron bearer OR logged-in dashboard session ----
    const authHeader = req.headers.get("authorization");
    const isCron =
      !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let sessionSubId: string | null = null;
    if (!isCron) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      sessionSubId = ((session.user as any)?.subscriptionId as string | null) ?? null;
      if (!sessionSubId) {
        return NextResponse.json(
          { error: "No subscription bound to this account" },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const offset = parseInt(body?.offset ?? "0") || 0;
    const limit = 200;

    // Session mode (the Sync button): single tenant, response shape unchanged.
    if (!isCron) {
      const r = await withExplicitTenant(sessionSubId!, () =>
        runBatchForTenant(offset, limit)
      );
      return NextResponse.json(r);
    }

    // Cron mode: run the batch for EVERY tenant with active stores
    // (intentional unscoped read to enumerate tenants).
    const allStores = await prismaUnscoped.darazStore.findMany({
      where: { isActive: true },
      select: { subscriptionId: true } as any,
    });
    const tenantIds = Array.from(
      new Set(allStores.map((s: any) => s.subscriptionId).filter(Boolean))
    ) as string[];

    const tenants: Record<string, unknown> = {};
    let created = 0;
    let skipped = 0;
    let total = 0;
    let anyMore = false;

    for (const subId of tenantIds) {
      try {
        const r = await withExplicitTenant(subId, () => runBatchForTenant(offset, limit));
        tenants[subId] = r;
        created += r.created;
        skipped += r.skipped;
        total += r.total;
        if (r.nextOffset !== null) anyMore = true;
      } catch (err) {
        tenants[subId] = { error: String(err).substring(0, 150) };
      }
    }

    return NextResponse.json({
      created,
      skipped,
      offset,
      nextOffset: anyMore ? offset + limit : null,
      total,
      tenants,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}
