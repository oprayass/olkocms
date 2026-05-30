export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) {
    concat += k + params[k];
  }
  const signBase = apiPath + concat;
  return crypto.createHmac("sha256", appSecret).update(signBase, "utf8").digest("hex").toUpperCase();
}

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    if (stores.length === 0) {
      return NextResponse.json({ error: "No connected stores found" }, { status: 400 });
    }

    let totalFetched = 0;
    let totalSaved = 0;
    const results: any[] = [];

    for (const store of stores) {
      try {
        const apiPath = "/orders/get";
        const timestamp = Date.now().toString();
        const fetchStart = new Date();

        // Incremental: lastOrderFetch भए त्यसपछिको मात्र, नत्र last 90 days
        const createdAfter = store.lastOrderFetch
          ? store.lastOrderFetch.toISOString()
          : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        const params: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          created_after: createdAfter,
          limit: "100",
          offset: "0",
          sign_method: "sha256",
          sort_by: "created_at",
          sort_direction: "DESC",
          timestamp,
        };

        const sign = signRequest(apiPath, params, appSecret);
        const sortedKeys = Object.keys(params).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;

        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, { method: "GET" });
        const data = await res.json();

        const orders = data?.data?.orders || [];
        totalFetched += orders.length;

        for (const o of orders) {
          await prisma.darazOrder.upsert({
            where: { darazOrderId: String(o.order_id) },
            update: {
              status: o.statuses?.[0] || o.status || "unknown",
              customerName: `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
              price: parseFloat(o.price) || 0,
              storeId: store.id,
              orderDate: o.created_at ? new Date(o.created_at) : null,
            },
            create: {
              darazOrderId: String(o.order_id),
              customerName: `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
              product: o.items_count ? `${o.items_count} item(s)` : "Daraz Order",
              quantity: o.items_count || 1,
              price: parseFloat(o.price) || 0,
              status: o.statuses?.[0] || o.status || "unknown",
              storeId: store.id,
              orderDate: o.created_at ? new Date(o.created_at) : null,
            },
          });
          totalSaved++;
        }

        // Successful fetch — lastOrderFetch update गर्ने
        await prisma.darazStore.update({
          where: { id: store.id },
          data: { lastOrderFetch: fetchStart },
        });

        results.push({
          store: store.storeName,
          fetched: orders.length,
          incremental: !!store.lastOrderFetch,
          createdAfter,
          error: data?.code !== "0" ? JSON.stringify(data).substring(0, 100) : null,
        });
      } catch (storeErr) {
        results.push({ store: store.storeName, error: String(storeErr).substring(0, 100) });
      }
    }

    return NextResponse.json({ success: true, totalFetched, totalSaved, stores: stores.length, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}