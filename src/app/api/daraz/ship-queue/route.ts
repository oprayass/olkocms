export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// Item-level feed for Order Processing.
//
// WHY THIS SYNCS. DarazOrderItem rows are only created by cron/nightly step 1b,
// which runs ONCE A NIGHT. An order that arrives today therefore exists in
// DarazOrder but has NO item rows until 8pm - and pack/rts/print are all keyed
// on orderItemId. Without a live sync here, today's work would be invisible on
// this screen and staff could not ship it. So ?sync=1 pulls /order/items/get for
// ship-stage orders that have no items yet.
//
// Vercel Hobby hard-kills the request at 10s and each order costs one Daraz
// call, so a sync pass is capped at 10 orders and reports `remaining`. The UI
// calls it again until remaining hits 0, showing progress. Never a silent
// half-sync.

const SHIP_STAGE = ["pending", "packed", "ready_to_ship"];

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

async function callDaraz(
  apiPath: string,
  extra: Record<string, string>,
  accessToken: string,
  appKey: string,
  appSecret: string
) {
  const params: Record<string, string> = {
    access_token: accessToken,
    app_key: appKey,
    sign_method: "sha256",
    timestamp: Date.now().toString(),
    ...extra,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const query =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join("&") + `&sign=${sign}`;
  const res = await fetch(`https://api.daraz.com.np/rest${apiPath}?${query}`, { method: "GET" });
  return await res.json();
}

const SYNC_BATCH = 10;

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const doSync = req.nextUrl.searchParams.get("sync") === "1";
    let synced = 0;
    let remaining = 0;
    let syncError: string | null = null;

    if (doSync) {
      try {
        const appKey = (process.env.DARAZ_APP_KEY || "").trim();
        const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

        const stores = await prisma.darazStore.findMany({
          where: { isActive: true, accessToken: { not: null } },
          select: { id: true, accessToken: true },
        });

        const orders = await prisma.darazOrder.findMany({
          where: { status: { in: SHIP_STAGE } },
          orderBy: { orderDate: "desc" },
          take: 150,
          select: { darazOrderId: true, storeId: true },
        });

        const have = await prisma.darazOrderItem.findMany({
          where: { darazOrderId: { in: orders.map((o) => o.darazOrderId) } },
          select: { darazOrderId: true },
        });
        const haveSet = new Set(have.map((h) => h.darazOrderId));
        const missing = orders.filter((o) => !haveSet.has(o.darazOrderId));
        const batch = missing.slice(0, SYNC_BATCH);
        remaining = Math.max(0, missing.length - batch.length);

        for (const ord of batch) {
          // try the order's own store first, then the tenant's other stores
          const primary = ord.storeId ? stores.find((s) => s.id === ord.storeId) : null;
          const tryStores = primary
            ? [primary, ...stores.filter((s) => s.id !== primary.id)]
            : stores;

          for (const store of tryStores) {
            if (!store.accessToken) continue;
            const resp = await callDaraz(
              "/order/items/get",
              { order_id: ord.darazOrderId },
              store.accessToken,
              appKey,
              appSecret
            );
            const items = Array.isArray(resp?.data) ? resp.data : [];
            if (resp?.code !== "0" || items.length === 0) continue;

            for (const it of items) {
              if (!it?.order_item_id) continue;
              const data = {
                darazOrderId: ord.darazOrderId,
                itemName: it.name || null,
                sku: it.sku || null,
                status: it.status || null,
                price: it.paid_price != null ? parseFloat(it.paid_price) : null,
                storeId: store.id,
                trackingNo: it.tracking_code || null,
                shipmentProvider: it.shipment_provider || null,
              };
              await prisma.darazOrderItem.upsert({
                where: { orderItemId: String(it.order_item_id) },
                update: data,
                create: { orderItemId: String(it.order_item_id), ...data },
              });
              synced++;
            }
            break; // matched a store, stop trying others
          }
        }
      } catch (e) {
        syncError = String(e).substring(0, 160);
      }
    }

    const items = await prisma.darazOrderItem.findMany({
      where: { status: { in: SHIP_STAGE } },
      select: {
        orderItemId: true,
        darazOrderId: true,
        itemName: true,
        sku: true,
        status: true,
        price: true,
        storeId: true,
        trackingNo: true,
        printedAt: true,
        printCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const orderIds = Array.from(new Set(items.map((i) => i.darazOrderId)));
    const orders = await prisma.darazOrder.findMany({
      where: { darazOrderId: { in: orderIds } },
      select: { darazOrderId: true, customerName: true, customerPhone: true, orderDate: true },
    });
    const byOrder = new Map(orders.map((o) => [o.darazOrderId, o]));

    const rows = items.map((i) => {
      const o = byOrder.get(i.darazOrderId);
      return {
        orderItemId: i.orderItemId,
        darazOrderId: i.darazOrderId,
        itemName: i.itemName || "-",
        sku: i.sku || "",
        status: i.status || "",
        price: i.price ?? 0,
        storeId: i.storeId,
        trackingNo: i.trackingNo || "",
        printCount: i.printCount ?? 0,
        printedAt: i.printedAt ? i.printedAt.toISOString() : null,
        customerName: o?.customerName || "-",
        customerPhone: o?.customerPhone || "",
        orderDate: o?.orderDate ? o.orderDate.toISOString() : null,
      };
    });

    return NextResponse.json({
      rows,
      count: rows.length,
      counts: {
        pending: rows.filter((r) => r.status === "pending").length,
        packed: rows.filter((r) => r.status === "packed").length,
        ready_to_ship: rows.filter((r) => r.status === "ready_to_ship").length,
        notPrinted: rows.filter((r) => r.status === "ready_to_ship" && r.printCount === 0).length,
        printed: rows.filter((r) => r.printCount > 0).length,
      },
      sync: doSync ? { synced, remaining, error: syncError } : null,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
