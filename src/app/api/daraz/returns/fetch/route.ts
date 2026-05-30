export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

async function callDaraz(apiPath: string, extra: Record<string, string>, store: any, appKey: string, appSecret: string) {
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    access_token: store.accessToken,
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

export async function GET(req: NextRequest) {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const storeIdParam = req.nextUrl.searchParams.get("store");

    const where: any = { isActive: true, accessToken: { not: null } };
    if (storeIdParam) where.id = storeIdParam;
    const stores = await prisma.darazStore.findMany({ where });

    if (stores.length === 0) {
      return NextResponse.json({ error: "No store found" }, { status: 400 });
    }

    const returnStatuses = ["returned", "shipped_back", "shipped_back_success", "failed_delivery"];

    let totalSaved = 0;
    const results: any[] = [];

    for (const store of stores) {
      let storeCount = 0;
      const fetchStart = new Date();

      try {
        // Incremental: lastReturnFetch भए त्यसपछिको मात्र, नत्र last 90 days
        const createdAfter = store.lastReturnFetch
          ? store.lastReturnFetch.toISOString()
          : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        for (const status of returnStatuses) {
          const ordersResp = await callDaraz("/orders/get", {
            created_after: createdAfter, limit: "100", offset: "0",
            sort_by: "created_at", sort_direction: "DESC", status,
          }, store, appKey, appSecret);
          const orders = ordersResp?.data?.orders || [];

          for (const o of orders) {
            const orderId = String(o.order_id);
            const customerName =
              `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() ||
              o.customer_first_name || "N/A";
            const actualStatus = o.statuses?.[0] || status;

            let trackingNo = orderId;
            let itemName = o.items_count ? `${o.items_count} item(s)` : "Daraz Item";
            let reason = "";
            let shipmentProvider = "";
            try {
              const itemsResp = await callDaraz("/order/items/get", { order_id: orderId }, store, appKey, appSecret);
              const item = itemsResp?.data?.[0];
              if (item) {
                if (item.tracking_code) trackingNo = item.tracking_code;
                if (item.name) itemName = item.name;
                if (item.reason) reason = item.reason;
                if (item.shipment_provider) shipmentProvider = item.shipment_provider;
              }
            } catch {}

            const existing = await prisma.darazClaim.findFirst({
              where: { darazOrderId: orderId },
            });

            if (existing) {
              await prisma.darazClaim.update({
                where: { id: existing.id },
                data: {
                  trackingNo, returnType: actualStatus, customerName, itemName,
                  customerComment: reason || existing.customerComment,
                  qcComment: shipmentProvider || existing.qcComment,
                  price: parseFloat(o.price) || 0, quantity: o.items_count || 1,
                  storeId: store.id, orderDate: o.created_at ? new Date(o.created_at) : null,
                },
              });
            } else {
              await prisma.darazClaim.create({
                data: {
                  trackingNo, darazOrderId: orderId, itemName, customerName,
                  customerComment: reason, qcComment: shipmentProvider,
                  price: parseFloat(o.price) || 0, quantity: o.items_count || 1,
                  returnType: actualStatus, claimStatus: "pending",
                  storeId: store.id, orderDate: o.created_at ? new Date(o.created_at) : null,
                },
              });
            }
            storeCount++;
            totalSaved++;
          }
        }

        // Successful fetch — lastReturnFetch update गर्ने
        await prisma.darazStore.update({
          where: { id: store.id },
          data: { lastReturnFetch: fetchStart },
        });

        results.push({
          store: store.storeName,
          returns: storeCount,
          incremental: !!store.lastReturnFetch,
          createdAfter,
        });
      } catch (storeErr) {
        results.push({ store: store.storeName, error: String(storeErr).substring(0, 100) });
      }
    }

    return NextResponse.json({ success: true, totalSaved, stores: stores.length, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}