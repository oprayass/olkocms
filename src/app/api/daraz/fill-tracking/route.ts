export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

async function fetchItems(orderId: string, accessToken: string, appKey: string, appSecret: string) {
  const apiPath = "/order/items/get";
  const params: Record<string, string> = {
    access_token: accessToken,
    app_key: appKey,
    order_id: orderId,
    sign_method: "sha256",
    timestamp: Date.now().toString(),
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const BATCH = 12;

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });
    const storeById = new Map(stores.map((s) => [s.id, s]));

    const total = await prisma.darazOrder.count();
    const orders = await prisma.darazOrder.findMany({
      orderBy: { createdAt: "asc" },
      skip: offset,
      take: BATCH,
    });

    let itemsSaved = 0;
    const results: any[] = [];

    for (const order of orders) {
      const orderId = order.darazOrderId;
      let items: any[] = [];
      let matchedStore: string | null = null;

      // Try saved store first
      const primary = order.storeId ? storeById.get(order.storeId) : null;
      const tryStores = primary ? [primary, ...stores.filter((s) => s.id !== primary.id)] : stores;

      for (const store of tryStores) {
        const data = await fetchItems(orderId, store.accessToken!, appKey, appSecret);
        const d = data?.data;
        if (data?.code === "0" && Array.isArray(d) && d.length > 0) {
          items = d;
          matchedStore = store.id;
          break;
        }
      }

      for (const it of items) {
        if (!it.order_item_id) continue;
        await prisma.darazOrderItem.upsert({
          where: { orderItemId: String(it.order_item_id) },
          update: {
            darazOrderId: orderId,
            itemName: it.name || null,
            sku: it.sku || null,
            status: it.status || null,
            price: it.paid_price != null ? parseFloat(it.paid_price) : null,
            storeId: matchedStore,
            trackingNo: it.tracking_code || null,
            shipmentProvider: it.shipment_provider || null,
            cancelReturnInitiator: it.cancel_return_initiator || null,
          },
          create: {
            orderItemId: String(it.order_item_id),
            darazOrderId: orderId,
            itemName: it.name || null,
            sku: it.sku || null,
            status: it.status || null,
            price: it.paid_price != null ? parseFloat(it.paid_price) : null,
            storeId: matchedStore,
            trackingNo: it.tracking_code || null,
            shipmentProvider: it.shipment_provider || null,
            cancelReturnInitiator: it.cancel_return_initiator || null,
          },
        });
        itemsSaved++;
      }
      results.push({ orderId, matched: !!matchedStore, itemCount: items.length });
    }

    const nextOffset = offset + BATCH < total ? offset + BATCH : null;
    return NextResponse.json({ offset, nextOffset, total, processed: orders.length, itemsSaved, done: nextOffset == null, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}