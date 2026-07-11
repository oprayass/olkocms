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

    // ---- mode=compose : the real deliverable. Official Daraz label + our
    // invoice, together, on one A5 page, ready to print.
    //
    // What the label actually is (proven by mode=inspect, not assumed):
    //   - one <div class="cn-html-body" style="width:115mm;height:160mm">
    //   - every child absolutely positioned in MILLIMETRES, inline styles only
    //   - zero stylesheets, zero @page rules
    //   - barcode + QR are base64 image/svg+xml data-URIs (vector, scale safely)
    //   - BUT: 2 external <script> from g.alicdn.com, and the Daraz logo is an
    //     external img.alicdn.com URL
    //
    // So we can lift the label container straight into our own page and it stays
    // geometrically exact. We only have to neutralise the two network hazards:
    //   1. strip the alicdn scripts (pure layout helpers; the mm positions are
    //      already inline, so the label renders identically without them, and
    //      the print dialog no longer waits on a CDN)
    //   2. fetch the logo server-side and inline it as a data-URI, so printing
    //      is fully offline and the logo can never come out blank
    //
    // A5 = 148 x 210 mm. Label = 115 x 160 mm. It sits at the top, centred,
    // leaving ~40 mm below the cut line for the invoice. No scaling needed.
    //
    // Query params: &scale=0.9 (shrink the label to buy invoice room)
    //               &auto=1    (open the print dialog on load)
    //
    // Read-only: still just /order/document/get. Nothing is written anywhere.
    if (mode === "compose") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      const auto = req.nextUrl.searchParams.get("auto") === "1";
      const scaleRaw = parseFloat(req.nextUrl.searchParams.get("scale") || "1");
      const scale = isNaN(scaleRaw) ? 1 : Math.min(1, Math.max(0.6, scaleRaw));
      if (!orderItemId) {
        return NextResponse.json({ error: "orderItemId required for mode=compose" }, { status: 400 });
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

      // 1. the label
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
            error: "Daraz returned no label - this order is outside the printable window (it must be ready_to_ship)",
            orderItemId,
            store: store.storeName,
            dbStatus: item.status,
            apiCode: labelResp?.code ?? null,
            apiMessage: labelResp?.message ?? null,
          },
          { status: 409 }
        );
      }
      let labelHtml = Buffer.from(String(doc.file), "base64").toString("utf8");

      // 2. neutralise the network hazards
      labelHtml = labelHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
      labelHtml = labelHtml.replace(/<meta[^>]*>/gi, "");

      const remoteSrcs = Array.from(
        new Set(
          (labelHtml.match(/src\s*=\s*["']https?:\/\/[^"']+["']/gi) || [])
            .map((s) => (s.match(/["']([^"']+)["']/) || [])[1])
            .filter(Boolean) as string[]
        )
      ).slice(0, 5);
      const inlinedAssets: string[] = [];
      for (const url of remoteSrcs) {
        try {
          const r = await fetch(url);
          const ct = r.headers.get("content-type") || "image/png";
          const buf = Buffer.from(await r.arrayBuffer());
          labelHtml = labelHtml.split(url).join(`data:${ct};base64,${buf.toString("base64")}`);
          inlinedAssets.push(url);
        } catch (e) {
          // leave the remote URL in place rather than breaking the label
        }
      }

      // 3. the invoice data
      const order = await prisma.darazOrder.findUnique({
        where: { darazOrderId: item.darazOrderId },
      });
      const lines = await prisma.darazOrderItem.findMany({
        where: { darazOrderId: item.darazOrderId },
        select: {
          orderItemId: true,
          itemName: true,
          sku: true,
          price: true,
          trackingNo: true,
          shipmentProvider: true,
          shippingType: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const esc = (v: any) =>
        String(v ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      const money = (n: any) => {
        const v = Number(n);
        return isNaN(v) ? "-" : v.toFixed(2);
      };
      const total = lines.reduce((s, l) => s + (Number(l.price) || 0), 0);
      const orderDate = order?.orderDate
        ? new Date(order.orderDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-";
      const thisLine = lines.find((l) => l.orderItemId === orderItemId) || lines[0];
      const tracking = thisLine?.trackingNo || "-";
      const provider = thisLine?.shipmentProvider || "-";

      const rows = lines
        .slice(0, 5)
        .map(
          (l, i) => `<tr>
            <td class="c">${i + 1}</td>
            <td>${esc(l.itemName || "-")}${l.sku ? `<span class="sku">${esc(l.sku)}</span>` : ""}</td>
            <td class="r">${money(l.price)}</td>
          </tr>`
        )
        .join("");
      const moreRow =
        lines.length > 5
          ? `<tr><td class="c"></td><td class="more">+ ${lines.length - 5} more item(s)</td><td class="r"></td></tr>`
          : "";

      const labelScale =
        scale === 1
          ? ""
          : `transform: scale(${scale}); transform-origin: top left;`;
      const labelBoxW = 115 * scale;
      const labelBoxH = 160 * scale;
      const labelLeft = (148 - labelBoxW) / 2;
      const cutTop = 4 + labelBoxH + 3;
      const invTop = cutTop + 3;
      const invH = 210 - invTop - 4;

      const page = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Label + Invoice ${esc(orderItemId)}</title>
<style>
  @page { size: A5; margin: 0; }
  html, body { margin: 0; padding: 0; background: #f3f4f6; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet {
    width: 148mm; height: 210mm; position: relative; overflow: hidden;
    background: #fff; margin: 12px auto; box-sizing: border-box;
    box-shadow: 0 2px 12px rgba(0,0,0,.18);
    font-family: Arial, Helvetica, sans-serif; color: #000;
  }
  .label-slot {
    position: absolute; left: ${labelLeft}mm; top: 4mm;
    width: ${labelBoxW}mm; height: ${labelBoxH}mm; overflow: hidden;
  }
  .label-inner { ${labelScale} }
  .cut {
    position: absolute; left: 5mm; top: ${cutTop}mm; width: 138mm;
    border-top: 1px dashed #9ca3af;
  }
  .cut span {
    position: absolute; top: -4.2mm; left: 50%; transform: translateX(-50%);
    background: #fff; padding: 0 2mm; font-size: 6pt; color: #9ca3af;
    letter-spacing: .5px;
  }
  .inv {
    position: absolute; left: 6mm; top: ${invTop}mm; width: 136mm; height: ${invH}mm;
    font-size: 7.5pt; line-height: 1.25; overflow: hidden;
  }
  .inv-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.2px solid #000; padding-bottom: 1mm; }
  .inv-head .who { font-size: 10pt; font-weight: bold; }
  .inv-head .meta { text-align: right; font-size: 7pt; }
  .inv-head .meta b { font-size: 8pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 1.5mm; }
  th { text-align: left; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .4px; color: #444; border-bottom: .6px solid #bbb; padding: .6mm 1mm; }
  td { padding: .8mm 1mm; border-bottom: .4px solid #e5e7eb; vertical-align: top; }
  td.c { width: 6mm; color: #666; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  .sku { display: block; font-size: 6pt; color: #777; }
  .more { font-size: 6.5pt; color: #777; font-style: italic; }
  .foot { display: flex; justify-content: space-between; margin-top: 1.5mm; }
  .foot .cust { font-size: 7pt; }
  .foot .cust b { font-size: 8pt; }
  .tot { text-align: right; }
  .tot .amt { font-size: 12pt; font-weight: bold; }
  .tot .pay { font-size: 6.5pt; color: #444; text-transform: uppercase; letter-spacing: .5px; }
  .brand { position: absolute; right: 6mm; bottom: 1.5mm; font-size: 5.5pt; color: #9ca3af; letter-spacing: .5px; }
  .bar { max-width: 148mm; margin: 12px auto 0; text-align: center; font-family: Arial, sans-serif; }
  .bar button { font-size: 14px; padding: 8px 18px; cursor: pointer; border: 1px solid #333; background: #111; color: #fff; border-radius: 4px; }
  .bar span { display: block; margin-top: 6px; font-size: 11px; color: #666; }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; }
    .bar { display: none; }
  }
</style>
</head>
<body>
<div class="bar">
  <button onclick="window.print()">Print A5</button>
  <span>Set paper = A5, margins = None, Background graphics = ON</span>
</div>
<div class="sheet">
  <div class="label-slot"><div class="label-inner">${labelHtml}</div></div>
  <div class="cut"><span>CUT HERE</span></div>
  <div class="inv">
    <div class="inv-head">
      <div class="who">${esc(store.storeName || "")}</div>
      <div class="meta">
        <b>INVOICE</b><br />
        Order ${esc(item.darazOrderId)} &middot; ${esc(orderDate)}
      </div>
    </div>
    <table>
      <thead>
        <tr><th class="c"></th><th>Item</th><th class="r">Amount (Rs.)</th></tr>
      </thead>
      <tbody>
        ${rows}${moreRow}
      </tbody>
    </table>
    <div class="foot">
      <div class="cust">
        <b>${esc(order?.customerName || "-")}</b><br />
        ${esc(order?.customerPhone || order?.customerPhoneRaw || "-")}<br />
        ${esc(provider)} &middot; ${esc(tracking)}
      </div>
      <div class="tot">
        <div class="pay">${esc(order?.paymentStatus || "COD")}</div>
        <div class="amt">Rs. ${money(total)}</div>
      </div>
    </div>
    <div class="brand">OlkoCMS</div>
  </div>
</div>
${auto ? "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 400); });</script>" : ""}
</body>
</html>`;

      return new NextResponse(page, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Inlined-Assets": String(inlinedAssets.length),
          "X-Invoice-Lines": String(lines.length),
        },
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
