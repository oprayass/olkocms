export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DIAGNOSTIC (read-only).
//
// FINDING SO FAR: with the store resolved correctly from the order item,
// /order/document/get STILL returns 700040 for an already-shipped order, and
// /order/items/get reports package_id = "" for it. Hypothesis: package_id (and
// thus a printable label) only exists in a pre-handover lifecycle window, and
// Daraz clears it afterwards - the same way it drops tracking_code post-delivery.
//
// THIS STEP TESTS THAT: find items still in a pre-handover status and check
// whether THEIR package_id is populated.
//
//   ?mode=scan   -> DB only. Status counts, so we can see what we have to work
//                   with. Zero Daraz calls, instant.
//   ?mode=probe  -> Picks up to 3 candidate items in pre-handover statuses and
//                   reads package_id live from /order/items/get.
//   ?orderItemId=<id> -> original single-item report (items + label attempt).
//
// No writes, no state changes anywhere in this file.

const PRE_HANDOVER = ["pending", "packed", "ready_to_ship"];

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
    const mode = req.nextUrl.searchParams.get("mode") || "";

    // ---- mode=scan : DB only, what statuses do we actually hold? ----
    if (mode === "scan") {
      const grouped = await prisma.darazOrderItem.groupBy({
        by: ["status"],
        _count: { _all: true },
      });
      const counts = grouped
        .map((g) => ({ status: g.status, count: g._count._all }))
        .sort((a, b) => b.count - a.count);

      const candidates = await prisma.darazOrderItem.findMany({
        where: { status: { in: PRE_HANDOVER } },
        select: {
          orderItemId: true,
          darazOrderId: true,
          status: true,
          storeId: true,
          trackingNo: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      return NextResponse.json({ mode: "scan", statusCounts: counts, candidates });
    }

    // ---- mode=probe : read package_id live for a GIVEN status ----
    // Pass ?status=ready_to_ship (or packed / pending). Defaults to
    // ready_to_ship: that is the decisive one - post-pack, pre-handover, so a
    // package should exist. "pending" is NOT informative (no package yet).
    // Capped at 2 items = 2 Daraz calls, safely under the Vercel 10s ceiling.
    if (mode === "probe") {
      const status = req.nextUrl.searchParams.get("status") || "ready_to_ship";
      const candidates = await prisma.darazOrderItem.findMany({
        where: { status },
        select: { orderItemId: true, darazOrderId: true, status: true, storeId: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
      if (candidates.length === 0) {
        return NextResponse.json({
          mode: "probe",
          status,
          note: "No items found with that status.",
          results: [],
        });
      }

      const results: any[] = [];
      for (const c of candidates) {
        if (!c.storeId) {
          results.push({ ...c, error: "no storeId" });
          continue;
        }
        const store = await prisma.darazStore.findFirst({
          where: { id: c.storeId, isActive: true },
        });
        if (!store || !store.accessToken) {
          results.push({ ...c, error: "store not found or no token" });
          continue;
        }
        const itemsResp = await callDaraz(
          "/order/items/get",
          { order_id: c.darazOrderId },
          store.accessToken,
          appKey,
          appSecret
        );
        const items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
        const t = items.find(
          (it: any) => String(it?.order_item_id) === String(c.orderItemId)
        );
        results.push({
          orderItemId: c.orderItemId,
          darazOrderId: c.darazOrderId,
          dbStatus: c.status,
          store: store.storeName,
          apiCode: itemsResp?.code,
          liveStatus: t?.status ?? null,
          packageId: t?.package_id ?? null,
          packageIdIsEmpty: (t?.package_id ?? "") === "",
          trackingCode: t?.tracking_code ?? null,
        });
      }
      return NextResponse.json({ mode: "probe", status, results });
    }

    // ---- mode=label : the real test. Item is ready_to_ship and HAS a
    // package_id. Try the documented param shapes for /order/document/get and
    // report each, so we learn the true contract from live data instead of
    // guessing. Read-only: document/get is a fetch, it changes nothing.
    if (mode === "label") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      if (!orderItemId) {
        return NextResponse.json({ error: "orderItemId required for mode=label" }, { status: 400 });
      }

      const item = await prisma.darazOrderItem.findUnique({
        where: { orderItemId },
        select: { storeId: true, darazOrderId: true, status: true },
      });
      if (!item || !item.storeId) {
        return NextResponse.json({ error: "Order item not found / no storeId" }, { status: 404 });
      }
      const store = await prisma.darazStore.findFirst({
        where: { id: item.storeId, isActive: true },
      });
      if (!store || !store.accessToken) {
        return NextResponse.json({ error: "Store not found or no token" }, { status: 404 });
      }

      // Get the live package_id.
      const itemsResp = await callDaraz(
        "/order/items/get",
        { order_id: item.darazOrderId },
        store.accessToken,
        appKey,
        appSecret
      );
      const items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
      const t = items.find(
        (it: any) => String(it?.order_item_id) === String(orderItemId)
      );
      const packageId = String(t?.package_id ?? "");
      const liveStatus = t?.status ?? null;

      if (!packageId) {
        return NextResponse.json({
          error: "No package_id on this item - it is outside the printable window",
          liveStatus,
          dbStatus: item.status,
        }, { status: 409 });
      }

      // Three candidate param shapes.
      const variants: Record<string, Record<string, string>> = {
        packages_objects: { doc_type: "shippingLabel", packages: JSON.stringify([{ package_id: packageId }]) },
        packages_ids: { doc_type: "shippingLabel", packages: JSON.stringify([packageId]) },
        order_item_ids: { doc_type: "shippingLabel", order_item_ids: JSON.stringify([Number(orderItemId)]) },
      };

      const attempts: any[] = [];
      for (const [name, params] of Object.entries(variants)) {
        const resp = await callDaraz(
          "/order/document/get",
          params,
          store.accessToken,
          appKey,
          appSecret
        );
        const doc = resp?.data?.document;
        attempts.push({
          variant: name,
          sentParams: params,
          apiCode: resp?.code,
          apiMessage: resp?.message || null,
          hasDocument: !!doc,
          mimeType: doc?.mime_type || null,
          documentType: doc?.document_type || null,
          fileLength: doc?.file ? String(doc.file).length : 0,
          filePreview: doc?.file ? String(doc.file).substring(0, 50) : null,
        });
      }

      return NextResponse.json({
        mode: "label",
        orderItemId,
        darazOrderId: item.darazOrderId,
        store: store.storeName,
        dbStatus: item.status,
        liveStatus,
        packageId,
        attempts,
      });
    }

    // ---- default: single-item report (items + label attempt) ----
    const orderItemId = req.nextUrl.searchParams.get("orderItemId");
    if (!orderItemId) {
      return NextResponse.json(
        { error: "Pass ?mode=scan, ?mode=probe, or ?orderItemId=<id>" },
        { status: 400 }
      );
    }

    const item = await prisma.darazOrderItem.findUnique({
      where: { orderItemId },
      select: { storeId: true, darazOrderId: true, status: true },
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

    return NextResponse.json({
      resolvedFromOrderItem: {
        storeId: item.storeId,
        darazOrderId: item.darazOrderId,
        dbStatus: item.status,
        store: store.storeName,
      },
      liveStatus: target?.status ?? null,
      packageIdFromItemsGet: target?.package_id ?? null,
      label: {
        success: labelResp?.code === "0",
        apiCode: labelResp?.code,
        apiMessage: labelResp?.message || null,
        hasDocument: !!doc,
        mimeType: doc?.mime_type || null,
        fileLength: doc?.file ? String(doc.file).length : 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
