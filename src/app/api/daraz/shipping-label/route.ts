export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DIAGNOSTIC (read-only): with the store now derived correctly from the order
// item, retry /order/document/get (doc_type=shippingLabel, order_item_ids) to
// test whether the earlier 700040 "no packages that support printing" was
// actually the OLD store-resolution bug (wrong seller's token) rather than a
// package_id keying problem. Also reports the item's package_id value for the
// record. No writes, no state changes.

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

    // Resolve the order item (tenant-scoped). Gives us the correct store token
    // AND the Daraz order_id.
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

    // Fetch items to read the package_id value (known empty from prior probe,
    // but we report it so the response is self-contained).
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
    const packageId = target?.package_id ?? null;

    // THE TEST: retry the label call with order_item_ids against the CORRECT
    // store. If this succeeds, the earlier 700040 was the store bug.
    const labelResp = await callDaraz(
      "/order/document/get",
      {
        doc_type: "shippingLabel",
        order_item_ids: JSON.stringify([Number(orderItemId)]),
      },
      store.accessToken,
      appKey,
      appSecret
    );

    const doc = labelResp?.data?.document;
    const labelSummary = doc
      ? {
          hasDocument: true,
          mimeType: doc.mime_type || null,
          documentType: doc.document_type || null,
          fileLength: doc.file ? String(doc.file).length : 0,
          filePreview: doc.file ? String(doc.file).substring(0, 60) : null,
        }
      : { hasDocument: false };

    return NextResponse.json({
      resolvedFromOrderItem: {
        storeId: item.storeId,
        darazOrderId: item.darazOrderId,
        store: store.storeName,
      },
      packageIdFromItemsGet: packageId,
      label: {
        success: labelResp?.code === "0",
        apiCode: labelResp?.code,
        apiMessage: labelResp?.message || null,
        summary: labelSummary,
        rawDataKeys: labelResp?.data ? Object.keys(labelResp.data) : [],
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
