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

async function fetchStatus(status: string, store: any, appKey: string, appSecret: string, createdAfter: string) {
  const apiPath = "/orders/get";
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    access_token: store.accessToken,
    app_key: appKey,
    created_after: createdAfter,
    limit: "100",
    offset: "0",
    sign_method: "sha256",
    sort_by: "created_at",
    sort_direction: "DESC",
    status,
    timestamp,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  return data?.data?.orders || [];
}

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });
    if (stores.length === 0) {
      return NextResponse.json({ error: "No connected stores" }, { status: 400 });
    }

    const returnStatuses = ["returned", "shipped_back", "shipped_back_success", "failed_delivery"];
    const createdAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    let totalSaved = 0;
    const results: any[] = [];

    for (const store of stores) {
      let storeCount = 0;
      try {
        for (const status of returnStatuses) {
          const orders = await fetchStatus(status, store, appKey, appSecret, createdAfter);
          for (const o of orders) {
            const orderId = String(o.order_id);
            const customerName =
              `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() ||
              o.customer_first_name ||
              "N/A";
            const actualStatus = o.statuses?.[0] || status;

            const existing = await prisma.darazClaim.findFirst({
              where: { trackingNo: orderId },
            });

            if (existing) {
              await prisma.darazClaim.update({
                where: { id: existing.id },
                data: {
                  returnType: actualStatus,
                  customerName,
                  price: parseFloat(o.price) || 0,
                  quantity: o.items_count || 1,
                  storeId: store.id,
                  darazOrderId: orderId,
                },
              });
            } else {
              await prisma.darazClaim.create({
                data: {
                  trackingNo: orderId,
                  darazOrderId: orderId,
                  itemName: o.items_count ? `${o.items_count} item(s)` : "Daraz Item",
                  customerName,
                  price: parseFloat(o.price) || 0,
                  quantity: o.items_count || 1,
                  returnType: actualStatus,
                  claimStatus: "pending",
                  storeId: store.id,
                },
              });
            }
            storeCount++;
            totalSaved++;
          }
        }
        results.push({ store: store.storeName, returns: storeCount });
      } catch (storeErr) {
        results.push({ store: store.storeName, error: String(storeErr).substring(0, 100) });
      }
    }

    return NextResponse.json({ success: true, totalSaved, stores: stores.length, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}
