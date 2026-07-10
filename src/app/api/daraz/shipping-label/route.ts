export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DIAGNOSTIC (read-only): retrieve an already-generated Daraz shipping label
// for an order that has ALREADY been marked Ready-To-Ship (has a tracking no).
// Proves the /order/document/get contract before we build RTS or the A5 layout.
// No writes, no state changes. Main-admin gated, tenant-scoped via withTenant.

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
    const storeId = req.nextUrl.searchParams.get("store");
    const docType = req.nextUrl.searchParams.get("docType") || "shippingLabel";
    if (!orderItemId) {
      return NextResponse.json({ error: "orderItemId required" }, { status: 400 });
    }

    // Resolve the store (tenant-scoped): only THIS tenant's stores are visible.
    const store = storeId
      ? await prisma.darazStore.findFirst({ where: { id: storeId, isActive: true } })
      : await prisma.darazStore.findFirst({ where: { isActive: true, accessToken: { not: null } } });
    if (!store || !store.accessToken) {
      return NextResponse.json({ error: "Store not found or no token" }, { status: 404 });
    }

    // Daraz expects order_item_ids as a JSON array string, e.g. "[123456]".
    const resp = await callDaraz(
      "/order/document/get",
      {
        doc_type: docType,
        order_item_ids: JSON.stringify([Number(orderItemId)]),
      },
      store.accessToken,
      appKey,
      appSecret
    );

    // Return the raw response so we can inspect the exact contract.
    // If a document is present, report its shape without dumping the whole
    // (potentially huge) base64 blob into the response.
    const doc = resp?.data?.document;
    const summary = doc
      ? {
          hasDocument: true,
          mimeType: doc.mime_type || null,
          documentType: doc.document_type || null,
          fileLength: doc.file ? String(doc.file).length : 0,
          filePreview: doc.file ? String(doc.file).substring(0, 60) : null,
        }
      : { hasDocument: false };

    return NextResponse.json({
      success: resp?.code === "0",
      apiCode: resp?.code,
      apiMessage: resp?.message || null,
      store: store.storeName,
      orderItemId,
      docType,
      summary,
      rawKeys: resp?.data ? Object.keys(resp.data) : [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
