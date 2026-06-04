import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// READ-ONLY diagnostic for outbound_not_delivered alerts.
// Classifies WHY each outbound scan fails to match the central DarazOrderItem,
// so we pick the right GENERIC fix (backfill normalize / fetch order items /
// truly orphan / junk) instead of hardcoding any store. No writes.

const DELIVERED_OR_DONE = [
  "shipped_back_success", "failed_delivery", "delivered", "shipped",
  "transit_to_ship", "shipped_back", "returned", "canceled", "cancelled",
];
const OPEN_STATUSES = ["ready_to_ship", "packed", "pending"];
const CUTOFF = new Date("2026-05-01T00:00:00+05:45");

const norm = (t: string) => t.replace(/\//g, "-").trim();
const isJunk = (t: string) => !t || /[,\s]/.test(t) || t.trim().length === 0 || t.length > 40;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const includeAll = url.searchParams.get("all") === "1";
    const SAMPLE = 5;

    // Load central data ONCE, match in memory (avoids per-scan queries / Vercel timeout).
    const items = await prisma.darazOrderItem.findMany({
      select: { trackingNo: true, darazOrderId: true, status: true },
    });
    const orders = await prisma.darazOrder.findMany({
      select: { darazOrderId: true, status: true },
    });

    const itemTrackingRaw = new Set<string>();
    const itemTrackingNorm = new Map<string, string>();
    const itemStatusByOrder = new Map<string, string>();
    const itemOrderIds = new Set<string>();
    for (const it of items) {
      if (it.trackingNo) {
        itemTrackingRaw.add(it.trackingNo);
        itemTrackingNorm.set(norm(it.trackingNo), (it.status ?? "").toLowerCase());
      }
      if (it.darazOrderId) {
        itemOrderIds.add(it.darazOrderId);
        if (!itemStatusByOrder.has(it.darazOrderId))
          itemStatusByOrder.set(it.darazOrderId, (it.status ?? "").toLowerCase());
      }
    }
    const orderStatusById = new Map<string, string>();
    const orderHeaderIds = new Set<string>();
    for (const o of orders) {
      orderHeaderIds.add(o.darazOrderId);
      orderStatusById.set(o.darazOrderId, (o.status ?? "").toLowerCase());
    }

    const scans = await prisma.darazScan.findMany({
      where: {
        deleted: false,
        scanType: "outbound",
        ...(includeAll ? {} : { createdAt: { gte: CUTOFF } }),
        OR: [{ trackingNo: { not: null } }, { darazOrderId: { not: null } }],
      },
      select: { id: true, trackingNo: true, darazOrderId: true, storeId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const buckets: Record<string, { count: number; samples: string[] }> = {};
    const byStore: Record<string, Record<string, number>> = {};
    const add = (cat: string, scan: any) => {
      if (!buckets[cat]) buckets[cat] = { count: 0, samples: [] };
      buckets[cat].count++;
      if (buckets[cat].samples.length < SAMPLE)
        buckets[cat].samples.push(scan.trackingNo ?? scan.darazOrderId ?? scan.id);
      const store = scan.storeId ?? "no_store";
      byStore[store] = byStore[store] || {};
      byStore[store][cat] = (byStore[store][cat] || 0) + 1;
    };

    for (const scan of scans) {
      const tno = scan.trackingNo ?? "";
      let status = "";
      let matched = false;

      if (tno && itemTrackingRaw.has(tno)) {
        matched = true;
        status = itemTrackingNorm.get(norm(tno)) ?? "";
      } else if (scan.darazOrderId && itemOrderIds.has(scan.darazOrderId)) {
        matched = true;
        status = itemStatusByOrder.get(scan.darazOrderId) ?? "";
      }
      if (!status && scan.darazOrderId && orderStatusById.has(scan.darazOrderId)) {
        status = orderStatusById.get(scan.darazOrderId) ?? "";
      }

      if (matched && status && DELIVERED_OR_DONE.includes(status)) { add("matched_done_NO_ALERT", scan); continue; }
      if (matched && OPEN_STATUSES.includes(status)) { add("matched_open_REAL_ALERT", scan); continue; }
      if (matched) { add("matched_other_status:" + (status || "blank"), scan); continue; }

      if (tno && isJunk(tno)) { add("nomatch_junk_tracking", scan); continue; }
      if (tno && !itemTrackingRaw.has(tno) && itemTrackingNorm.has(norm(tno))) {
        add("nomatch_slashdash_FIXABLE_backfill", scan); continue;
      }
      if (scan.darazOrderId) {
        if (orderHeaderIds.has(scan.darazOrderId)) add("nomatch_order_items_missing_NEED_FETCH", scan);
        else add("nomatch_order_not_fetched_NEED_FETCH", scan);
        continue;
      }
      add("nomatch_tracking_orphan_unfetched_or_lost", scan);
    }

    const summary = Object.entries(buckets)
      .map(([k, v]) => ({ category: k, count: v.count, samples: v.samples }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      window: includeAll ? "all_time" : "from " + CUTOFF.toISOString(),
      totalOutboundScans: scans.length,
      totalItems: items.length,
      totalOrders: orders.length,
      summary,
      byStore,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}