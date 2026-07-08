export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { withTenant } from "@/lib/with-tenant";

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

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    let orderId = req.nextUrl.searchParams.get("orderId");
    let storeId = req.nextUrl.searchParams.get("store");
    const tracking = req.nextUrl.searchParams.get("tracking");

    if (!orderId && tracking) {
      const item = await prisma.darazOrderItem.findFirst({
        where: { trackingNo: tracking },
        select: { darazOrderId: true, storeId: true },
      });
      if (item) {
        orderId = item.darazOrderId;
        if (!storeId) storeId = item.storeId;
      } else {
        return NextResponse.json({ success: false, items: [], error: "No order found for this tracking number" });
      }
    }

    if (!orderId) return NextResponse.json({ error: "orderId or tracking required" }, { status: 400 });

    // store decide: if storeId param given use it, otherwise search all active stores
    let stores;
    if (storeId) {
      stores = await prisma.darazStore.findMany({
        where: { id: storeId, accessToken: { not: null } },
      });
    } else {
      stores = await prisma.darazStore.findMany({
        where: { isActive: true, accessToken: { not: null } },
      });
    }

    for (const store of stores) {
      const itemsResp = await callDaraz("/order/items/get", { order_id: orderId }, store.accessToken!, appKey, appSecret);
      const items = itemsResp?.data || [];
      if (items.length > 0) {
        const mapped = items.map((it: any) => ({
          name: it.name || "Unknown product",
          sku: it.sku || it.shop_sku || "",
          variation: it.variation || "",
          quantity: parseInt(it.quantity) || 1,
          paidPrice: parseFloat(it.paid_price) || 0,
          trackingCode: it.tracking_code || "",
          shipmentProvider: it.shipment_provider || "",
          status: it.status || "",
          reason: it.reason || "",
          productImage: it.product_main_image || "",
        }));
        let orderDate = "";
        try {
          const orderResp = await callDaraz("/orders/get", { order_id: orderId }, store.accessToken!, appKey, appSecret);
          console.log("[PHONE_DEBUG] orderResp:", JSON.stringify(orderResp));
          orderDate = orderResp?.data?.created_at || orderResp?.data?.[0]?.created_at || "";
        } catch { /* order date is optional */ }
        return NextResponse.json({
          success: true,
          orderId,
          store: store.storeName,
          orderDate,
          itemCount: mapped.length,
          items: mapped,
        });
      }
    }

    return NextResponse.json({ success: false, orderId, items: [], error: "No items found" });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});