export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, prismaUnscoped } from "@/lib/prisma";
import { withExplicitTenant } from "@/lib/with-tenant";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

async function callDaraz(apiPath: string, extra: Record<string, string>, accessToken: string, appKey: string, appSecret: string) {
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    access_token: accessToken,
    app_key: appKey,
    sign_method: "sha256",
    timestamp,
    ...extra,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

type BatchResult = {
  fetched: number;
  notFound: number;
  skipped: number;
  offset: number;
  processed: number;
  totalMissing: number;
  nextOffset: number | null;
};

// One batch for ONE tenant. Must run inside withExplicitTenant so every
// prisma call (alerts, orders, stores, upsert) is auto-scoped. Item lookup
// only tries THIS tenant's stores - never another tenant's tokens.
async function runBatchForTenant(
  offset: number,
  batchSize: number,
  appKey: string,
  appSecret: string
): Promise<BatchResult> {
  const stores = await prisma.darazStore.findMany({
    where: { isActive: true, accessToken: { not: null } },
  });

  // Orders referenced by "outbound_not_delivered" alerts but missing/incomplete in DarazOrder.
  const alertOrders = await prisma.darazAlert.findMany({
    where: { alertType: "outbound_not_delivered", darazOrderId: { not: "unknown" } },
    select: { darazOrderId: true },
    distinct: ["darazOrderId"],
  });
  const allScans = alertOrders.filter((a) => a.darazOrderId);

  // Skip orders that already exist AND are complete (have product, real customerName).
  const existingOrders = await prisma.darazOrder.findMany({
    select: { darazOrderId: true, product: true, customerName: true },
  });
  const existingSet = new Set(
    existingOrders
      .filter((o) => o.product && o.product !== "Unknown product" && o.customerName !== "\u2014")
      .map((o) => o.darazOrderId)
  );
  const missingOrderIds = allScans
    .map((s) => s.darazOrderId!)
    .filter((id) => !existingSet.has(id));

  const batch = missingOrderIds.slice(offset, offset + batchSize);

  let fetched = 0;
  let notFound = 0;
  let skipped = 0;

  for (const orderId of batch) {
    let found = false;
    for (const store of stores) {
      try {
        const itemsResp = await callDaraz("/order/items/get", { order_id: orderId }, store.accessToken!, appKey, appSecret);
        const items = itemsResp?.data || [];
        if (items.length > 0) {
          const it = items[0];
          try {
            await prisma.darazOrder.upsert({
              where: { darazOrderId: orderId },
              create: {
                darazOrderId: orderId,
                customerName: "\u2014",
                product: it.name || "Unknown product",
                quantity: items.length,
                price: parseFloat(it.paid_price) || 0,
                status: it.status || "unknown",
                trackingNo: it.tracking_code || null,
                storeId: store.id,
              },
              update: {
                product: it.name || "Unknown product",
                price: parseFloat(it.paid_price) || 0,
                status: it.status || "unknown",
                trackingNo: it.tracking_code || null,
                storeId: store.id,
              },
            });
            fetched++;
          } catch (err: any) {
            if (err?.code === "P2002") skipped++; // exists under another tenant
            else throw err;
          }
          found = true;
          break;
        }
      } catch { /* try next store */ }
    }
    if (!found) notFound++;
  }

  const nextOffset = offset + batchSize;
  const hasMore = nextOffset < missingOrderIds.length;

  return {
    fetched,
    notFound,
    skipped,
    offset,
    processed: batch.length,
    totalMissing: missingOrderIds.length,
    nextOffset: hasMore ? nextOffset : null,
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
    const batchSize = 12;

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // Session mode (the Sync button): single tenant, response shape unchanged.
    if (!isCron) {
      const r = await withExplicitTenant(sessionSubId!, () =>
        runBatchForTenant(offset, batchSize, appKey, appSecret)
      );
      return NextResponse.json(r);
    }

    // Cron mode: run the batch for EVERY tenant that has active stores
    // (intentional unscoped read to enumerate tenants). Offset applies
    // per tenant; hasMore if any tenant still has more.
    const allStores = await prismaUnscoped.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
      select: { subscriptionId: true } as any,
    });
    const tenantIds = Array.from(
      new Set(allStores.map((s: any) => s.subscriptionId).filter(Boolean))
    ) as string[];

    const tenants: Record<string, unknown> = {};
    const totals = { fetched: 0, notFound: 0, skipped: 0, processed: 0, totalMissing: 0 };
    let anyMore = false;

    for (const subId of tenantIds) {
      try {
        const r = await withExplicitTenant(subId, () =>
          runBatchForTenant(offset, batchSize, appKey, appSecret)
        );
        tenants[subId] = r;
        totals.fetched += r.fetched;
        totals.notFound += r.notFound;
        totals.skipped += r.skipped;
        totals.processed += r.processed;
        totals.totalMissing += r.totalMissing;
        if (r.nextOffset !== null) anyMore = true;
      } catch (err) {
        tenants[subId] = { error: String(err).substring(0, 150) };
      }
    }

    return NextResponse.json({
      ...totals,
      offset,
      nextOffset: anyMore ? offset + batchSize : null,
      tenants,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}
