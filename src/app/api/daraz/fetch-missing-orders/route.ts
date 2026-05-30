export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = parseInt(body?.offset ?? "0") || 0;
    const batchSize = 12;

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    // "Unknown" outbound alerts भएका orders (DarazOrder मा नभएका)
    const alertOrders = await prisma.darazAlert.findMany({
      where: { alertType: "outbound_not_delivered", darazOrderId: { not: "unknown" } },
      select: { darazOrderId: true },
      distinct: ["darazOrderId"],
    });
    const allScans = alertOrders.filter((a) => a.darazOrderId);

    // already DarazOrder मा भएका हटाउने
    const existingOrders = await prisma.darazOrder.findMany({
      select: { darazOrderId: true },
    });
    const existingSet = new Set(existingOrders.map((o) => o.darazOrderId));
    const missingOrderIds = allScans
      .map((s) => s.darazOrderId!)
      .filter((id) => !existingSet.has(id));

    const batch = missingOrderIds.slice(offset, offset + batchSize);

    let fetched = 0;
    let notFound = 0;

    for (const orderId of batch) {
      let found = false;
      for (const store of stores) {
        try {
          const itemsResp = await callDaraz("/order/items/get", { order_id: orderId }, store.accessToken!, appKey, appSecret);
          const items = itemsResp?.data || [];
          if (items.length > 0) {
            const it = items[0];
            await prisma.darazOrder.upsert({
              where: { darazOrderId: orderId },
              create: {
                darazOrderId: orderId,
                customerName: "—",
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
            found = true;
            break;
          }
        } catch { /* try next store */ }
      }
      if (!found) notFound++;
    }

    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < missingOrderIds.length;

    return NextResponse.json({
      fetched,
      notFound,
      offset,
      processed: batch.length,
      totalMissing: missingOrderIds.length,
      nextOffset: hasMore ? nextOffset : null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}