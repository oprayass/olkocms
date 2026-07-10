export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DIAGNOSTIC (read-only): confirm the raw shape of /order/items/get so we can
// find the exact field that carries the Daraz package id (package_id vs a
// nested `package` object). Everything below is derived from the ORDER ITEM
// itself (tenant-scoped) - we no longer trust a `store` query param, which
// previously fell back to the first active store and signed against the wrong
// seller's token. No writes, no state changes.

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
  const query =
    sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const orderItemId = req.nextUrl.searchParams.get("orderItemId");
    if (!orderItemId) {
      return NextResponse.json({ error: "orderItemId required" }, { status: 400 });
    }

    // Resolve the order item (tenant-scoped via withTenant). This single lookup
    // gives us BOTH the correct store (its own accessToken) AND the Daraz
    // order_id that /order/items/get needs.
    const item = await prisma.darazOrderItem.findUnique({
      where: { orderItemId },
      select: { storeId: true, darazOrderId: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Order item not found for this tenant" }, { status: 404 });
    }
    if (!item.storeId) {
      return NextResponse.json({ error: "Order item has no storeId" }, { status: 422 });
    }

    const store = await prisma.darazStore.findFirst({
      where: { id: item.storeId, isActive: true },
    });
    if (!store || !store.accessToken) {
      return NextResponse.json({ error: "Store not found or no token" }, { status: 404 });
    }

    // READ-ONLY probe. Contract mirrors every other call site exactly:
    //   callDaraz("/order/items/get", { order_id }, token, appKey, appSecret)
    //   -> resp.data is the items array.
    const itemsResp = await callDaraz(
      "/order/items/get",
      { order_id: item.darazOrderId },
      store.accessToken,
      appKey,
      appSecret
    );

    const items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
    const target = items.find(
      (it: any) => String(it?.order_item_id) === String(orderItemId)
    );

    // Surface anything package/parcel-related without dumping the whole payload.
    const probe = (it: any) => {
      if (!it || typeof it !== "object") return null;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(it)) {
        const lk = k.toLowerCase();
        if (lk.includes("package") || lk.includes("parcel")) out[k] = it[k];
      }
      return out;
    };

    return NextResponse.json({
      success: itemsResp?.code === "0",
      apiCode: itemsResp?.code,
      apiMessage: itemsResp?.message || null,
      store: store.storeName,
      resolvedFromOrderItem: {
        storeId: item.storeId,
        darazOrderId: item.darazOrderId,
      },
      itemCount: items.length,
      firstItemKeys: items[0] ? Object.keys(items[0]).sort() : [],
      targetItemFound: !!target,
      targetItemKeys: target ? Object.keys(target).sort() : [],
      packageFieldsOnTarget: probe(target),
      packageFieldsOnFirst: probe(items[0]),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
