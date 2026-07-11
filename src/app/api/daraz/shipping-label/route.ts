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

    // ---- mode=render : decode the label and serve it as real HTML ----
    // Same proven contract as mode=label (doc_type + order_item_ids). The only
    // difference is what we do with the result: base64-decode data.document.file
    // and return it with Content-Type: text/html, so the official Daraz label
    // renders in a browser tab and we can see the barcode, the addresses and the
    // true dimensions.
    //
    // Add &as=source to get the same bytes back as text/plain instead. That is
    // how we learn the things the A5 layout actually depends on: whether there is
    // an @page rule, whether widths are fixed px, whether the barcode is inline
    // SVG / base64 img / a barcode font, and whether any asset is loaded from an
    // external URL that would break when we print it ourselves.
    //
    // Still read-only: /order/document/get is a fetch, it changes nothing.
    if (mode === "render") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      const as = req.nextUrl.searchParams.get("as") || "html";
      if (!orderItemId) {
        return NextResponse.json({ error: "orderItemId required for mode=render" }, { status: 400 });
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

      if (labelResp?.code !== "0" || !doc?.file) {
        return NextResponse.json(
          {
            error:
              "Daraz returned no document - the order has most likely left the printable window",
            orderItemId,
            store: store.storeName,
            dbStatus: item.status,
            apiCode: labelResp?.code ?? null,
            apiMessage: labelResp?.message ?? null,
          },
          { status: 409 }
        );
      }

      const html = Buffer.from(String(doc.file), "base64").toString("utf8");
      const contentType =
        as === "source" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8";

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store",
          "X-Daraz-Mime-Type": String(doc.mime_type || ""),
          "X-Daraz-Document-Type": String(doc.document_type || ""),
          "X-Decoded-Length": String(html.length),
        },
      });
    }

    // ---- mode=inspect : structural report on the label HTML ----
    // Decodes the same document as mode=render, but instead of serving it, it
    // reads the markup and answers the four questions the A5 layout depends on:
    //   1. Does Daraz ship an @page / @media print rule, and what size?
    //   2. Are dimensions fixed px, or mm/pt (i.e. print-native)?
    //   3. Are the barcode / QR / logo base64 data-URIs, or external URLs that
    //      would break or stall when WE print the page?
    //   4. Is there an @font-face (a barcode font would need the font file).
    // Read-only. No writes, no state changes.
    if (mode === "inspect") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      if (!orderItemId) {
        return NextResponse.json({ error: "orderItemId required for mode=inspect" }, { status: 400 });
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
      if (labelResp?.code !== "0" || !doc?.file) {
        return NextResponse.json(
          {
            error: "Daraz returned no document - order is outside the printable window",
            apiCode: labelResp?.code ?? null,
            apiMessage: labelResp?.message ?? null,
          },
          { status: 409 }
        );
      }

      const html = Buffer.from(String(doc.file), "base64").toString("utf8");

      const uniq = (re: RegExp, limit: number) => {
        const found = html.match(re) || [];
        return Array.from(new Set(found.map((s) => s.trim()))).slice(0, limit);
      };

      const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(
        (m) => m[1]
      );
      const css = styleBlocks.join("\n");

      const pageRules = Array.from(css.matchAll(/@page[^{]*\{[^}]*\}/gi)).map((m) => m[0]);
      const mediaPrint = Array.from(css.matchAll(/@media[^{]*print[^{]*\{/gi)).map((m) => m[0]);
      const fontFaces = Array.from(css.matchAll(/@font-face[^{]*\{[^}]*\}/gi)).map((m) =>
        m[0].substring(0, 220)
      );

      const imgTags = html.match(/<img[^>]*>/gi) || [];
      const images = imgTags.map((tag) => {
        const src = (tag.match(/src\s*=\s*["']([^"']*)["']/i) || [])[1] || "";
        const isData = src.startsWith("data:");
        return {
          encoding: isData ? "data-uri" : src ? "external-url" : "none",
          mime: isData ? src.substring(5, src.indexOf(";")) : null,
          srcPreview: isData ? src.substring(0, 45) + "..." : src,
          srcLength: src.length,
          widthAttr: (tag.match(/width\s*=\s*["']?([\w%.]+)/i) || [])[1] || null,
          heightAttr: (tag.match(/height\s*=\s*["']?([\w%.]+)/i) || [])[1] || null,
          inlineStyle: (tag.match(/style\s*=\s*["']([^"']*)["']/i) || [])[1] || null,
        };
      });

      const cssCount = (re: RegExp) => (css.match(re) || []).length;

      return NextResponse.json({
        mode: "inspect",
        orderItemId,
        store: store.storeName,
        dbStatus: item.status,
        mimeType: doc.mime_type || null,
        htmlLength: html.length,
        styleBlockCount: styleBlocks.length,
        cssLength: css.length,
        pageRules,
        mediaPrintBlocks: mediaPrint,
        fontFaces,
        unitCounts: {
          px: cssCount(/[\d.]+px/g),
          mm: cssCount(/[\d.]+mm/g),
          cm: cssCount(/[\d.]+cm/g),
          pt: cssCount(/[\d.]+pt/g),
          inch: cssCount(/[\d.]+in\b/g),
          percent: cssCount(/[\d.]+%/g),
        },
        sizeDeclarations: Array.from(
          new Set(
            (css.match(/(?:max-|min-)?(?:width|height)\s*:\s*[^;}"]+/gi) || []).map((s) =>
              s.trim()
            )
          )
        ).slice(0, 30),
        bodyOrHtmlRules: Array.from(css.matchAll(/(?:^|\})\s*(?:html|body)[^{]*\{[^}]*\}/gi))
          .map((m) => m[0].replace(/^\}/, "").trim())
          .slice(0, 6),
        imageCount: imgTags.length,
        images,
        svgCount: (html.match(/<svg/gi) || []).length,
        scriptCount: (html.match(/<script/gi) || []).length,
        iframeCount: (html.match(/<iframe/gi) || []).length,
        tableCount: (html.match(/<table/gi) || []).length,
        externalUrls: uniq(/https?:\/\/[^\s"'<>()]+/gi, 15),
        inlineWidthAttrs: uniq(/<(?:table|td|div)[^>]*width\s*=\s*["']?[\w%.]+["']?/gi, 10),
        headPreview: html.substring(0, 500),
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
