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

const TO_SHIP_STATUSES = ["pending", "ready_to_ship", "packed"];

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    const allOrders: any[] = [];
    const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const store of stores) {
      for (const status of TO_SHIP_STATUSES) {
        try {
          const resp = await callDaraz("/orders/get", {
            created_after: createdAfter,
            limit: "50",
            offset: "0",
            sort_by: "created_at",
            sort_direction: "DESC",
            status,
          }, store.accessToken!, appKey, appSecret);

          const orders = resp?.data?.orders || [];
          for (const o of orders) {
            allOrders.push({
              orderId: String(o.order_id),
              customerName: `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
              itemsCount: o.items_count || 1,
              price: parseFloat(o.price) || 0,
              status: o.statuses?.[0] || status,
              storeId: store.id,
              orderDate: o.created_at || null,
            });
          }
        } catch { /* skip this status/store */ }
      }
    }

    // Order ID ले dedupe (एउटै order multiple status मा नआओस्)
    const seen = new Set<string>();
    const unique = allOrders.filter((o) => {
      if (seen.has(o.orderId)) return false;
      seen.add(o.orderId);
      return true;
    });

    // newest first
    unique.sort((a, b) => new Date(b.orderDate || 0).getTime() - new Date(a.orderDate || 0).getTime());

    return NextResponse.json({ orders: unique, count: unique.length });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}