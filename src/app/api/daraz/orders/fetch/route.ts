export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Daraz signature helper (same as token create)
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

    // Get all active stores with tokens
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

        // Fetch orders from last 30 days
        const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const params: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          created_after: createdAfter,
          limit: "50",
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
            },
            create: {
              darazOrderId: String(o.order_id),
              customerName: `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
              product: o.items_count ? `${o.items_count} item(s)` : "Daraz Order",
              quantity: o.items_count || 1,
              price: parseFloat(o.price) || 0,
              status: o.statuses?.[0] || o.status || "unknown",
              storeId: store.id,
            },
          });
          totalSaved++;
        }

        results.push({ store: store.storeName, fetched: orders.length, error: data?.code !== "0" ? JSON.stringify(data).substring(0, 100) : null });
      } catch (storeErr) {
        results.push({ store: store.storeName, error: String(storeErr).substring(0, 100) });
      }
    }

    return NextResponse.json({ success: true, totalFetched, totalSaved, stores: stores.length, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}

// Helper: refresh expiring tokens before fetch (called internally)
async function refreshExpiringTokens(appKey: string, appSecret: string) {
  const { prisma } = await import("@/lib/prisma");
  const cryptoMod = await import("crypto");
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const stores = await prisma.darazStore.findMany({
    where: { isActive: true, refreshToken: { not: null }, tokenExpiry: { lte: sevenDaysLater } },
  });
  for (const store of stores) {
    try {
      const apiPath = "/auth/token/refresh";
      const timestamp = Date.now().toString();
      const params: Record<string, string> = {
        app_key: appKey, refresh_token: store.refreshToken!, sign_method: "sha256", timestamp,
      };
      const sortedKeys = Object.keys(params).sort();
      let concat = "";
      for (const k of sortedKeys) concat += k + params[k];
      const sign = cryptoMod.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
      const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
      const res = await fetch(`https://api.daraz.com.np/rest${apiPath}?${query}`, { method: "GET" });
      const data = await res.json();
      if (data.access_token) {
        await prisma.darazStore.update({
          where: { id: store.id },
          data: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || store.refreshToken,
            tokenExpiry: new Date(Date.now() + (data.expires_in || 2592000) * 1000),
          },
        });
      }
    } catch {}
  }
}
