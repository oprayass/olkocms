export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DARAZ SHIPPING LABEL + INVOICE  (diagnostic + compose)
//
// SOLVED CONTRACT (proven against live orders, do not re-litigate):
//   /order/document/get
//     doc_type       = shippingLabel | invoice | carrierManifest   (all 3 work)
//     order_item_ids = JSON.stringify([Number(orderItemId)])
//   The `packages` param DOES NOT EXIST. package_id is a red herring.
//   The ONLY precondition is lifecycle state: the order must be ready_to_ship.
//   Outside that window -> 700040 "There are no packages that support printing!"
//
//   shippingLabel -> base64 text/html, ~103KB. One <div class="cn-html-body"
//     style="width:115mm;height:160mm">, children absolutely positioned in mm,
//     inline styles only, no stylesheet. Barcode + QR are base64 svg data-URIs.
//     Hazards: 2 external <script> from g.alicdn.com, and the shop logo is an
//     external img.alicdn.com URL. Both are neutralised in mode=compose.
//   invoice -> base64 text/html, ~4KB, Daraz's own "Purchase Summary". A4-wide.
//
// MONEY (this is the part that bites):
//   /order/items/get returns ONE ROW PER UNIT. Quantity = rows sharing a sku.
//   Real fields: paid_price, item_price, shipping_amount, voucher_amount,
//   tax_amount, shop_sku, sku, variation, shop_id (the trading name), currency.
//   DarazOrderItem.price in our DB is NOT the collectable amount.
//   Daraz's own label and its own invoice DISAGREE (label COD 784.00 vs invoice
//   total 761.00 on order 215864832433729) and no API field explains the gap.
//   The rider collects what the LABEL says. So: payable = the label's COD, and
//   any residual is shown as an explicit Adjustment line so the invoice always
//   reconciles instead of quietly lying.
//
// STORE RESOLUTION: never trust a ?store param. DarazOrderItem.findUnique gives
// storeId (-> the right accessToken) and darazOrderId (-> order_id). The old
// findFirst-on-first-active-store fallback signed against the wrong seller.
//
// Modes (all read-only; nothing in this file writes anything):
//   ?mode=scan                          DB-only status counts + candidates
//   ?mode=probe&status=ready_to_ship    live package_id / liveStatus
//   ?mode=label&orderItemId=            tries 3 param shapes, reports each
//   ?mode=render&orderItemId=           label as text/html (&as=source)
//   ?mode=inspect&orderItemId=          structural report on the label markup
//   ?mode=doctypes&orderItemId=         which doc_types this seller can get
//   ?mode=doc&orderItemId=&type=invoice render any one doc_type
//   ?mode=amounts&orderItemId=          raw item fields (money + sku)
//   ?mode=compose&orderItemId=          >>> THE DELIVERABLE: A5 label + invoice
//   ?orderItemId=                       single-item report

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

// Resolve the owning store from the order item itself. Never from a query param.
async function resolveItemAndStore(orderItemId: string) {
  const item = await prisma.darazOrderItem.findUnique({
    where: { orderItemId },
    select: { storeId: true, darazOrderId: true, status: true },
  });
  if (!item || !item.storeId) return { error: "Order item not found / no storeId", status: 404 } as const;
  const store = await prisma.darazStore.findFirst({
    where: { id: item.storeId, isActive: true },
  });
  if (!store || !store.accessToken) return { error: "Store not found or no token", status: 404 } as const;
  return { item, store } as const;
}

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const mode = req.nextUrl.searchParams.get("mode") || "";

    // ---- mode=scan ----
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

    // ---- mode=probe ----
    if (mode === "probe") {
      const status = req.nextUrl.searchParams.get("status") || "ready_to_ship";
      const candidates = await prisma.darazOrderItem.findMany({
        where: { status },
        select: { orderItemId: true, darazOrderId: true, status: true, storeId: true },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
      if (candidates.length === 0) {
        return NextResponse.json({ mode: "probe", status, note: "No items with that status.", results: [] });
      }

      const results: any[] = [];
      for (const c of candidates) {
        if (!c.storeId) {
          results.push({ ...c, error: "no storeId" });
          continue;
        }
        const store = await prisma.darazStore.findFirst({ where: { id: c.storeId, isActive: true } });
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
        const t = items.find((it: any) => String(it?.order_item_id) === String(c.orderItemId));
        results.push({
          orderItemId: c.orderItemId,
          darazOrderId: c.darazOrderId,
          dbStatus: c.status,
          store: store.storeName,
          apiCode: itemsResp?.code,
          liveStatus: t?.status ?? null,
          packageId: t?.package_id ?? null,
          trackingCode: t?.tracking_code ?? null,
        });
      }
      return NextResponse.json({ mode: "probe", status, results });
    }

    // ---- mode=render : the label as HTML ----
    if (mode === "render") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      const as = req.nextUrl.searchParams.get("as") || "html";
      if (!orderItemId) return NextResponse.json({ error: "orderItemId required" }, { status: 400 });

      const r = await resolveItemAndStore(orderItemId);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

      const labelResp = await callDaraz(
        "/order/document/get",
        { doc_type: "shippingLabel", order_item_ids: JSON.stringify([Number(orderItemId)]) },
        r.store.accessToken as string,
        appKey,
        appSecret
      );
      const doc = labelResp?.data?.document;
      if (labelResp?.code !== "0" || !doc?.file) {
        return NextResponse.json(
          {
            error: "No document - order is outside the printable window",
            apiCode: labelResp?.code ?? null,
            apiMessage: labelResp?.message ?? null,
          },
          { status: 409 }
        );
      }
      const html = Buffer.from(String(doc.file), "base64").toString("utf8");
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": as === "source" ? "text/plain; charset=utf-8" : "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    // ---- mode=doctypes / mode=doc ----
    if (mode === "doctypes" || mode === "doc") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      if (!orderItemId) return NextResponse.json({ error: "orderItemId required" }, { status: 400 });

      const r = await resolveItemAndStore(orderItemId);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

      const askFor = async (docType: string) =>
        await callDaraz(
          "/order/document/get",
          { doc_type: docType, order_item_ids: JSON.stringify([Number(orderItemId)]) },
          r.store.accessToken as string,
          appKey,
          appSecret
        );

      if (mode === "doc") {
        const type = req.nextUrl.searchParams.get("type") || "invoice";
        const resp = await askFor(type);
        const d = resp?.data?.document;
        if (resp?.code !== "0" || !d?.file) {
          return NextResponse.json(
            { error: "No document for that doc_type", docType: type, apiCode: resp?.code ?? null, apiMessage: resp?.message ?? null },
            { status: 409 }
          );
        }
        const asSource = req.nextUrl.searchParams.get("as") === "source";
        const text = Buffer.from(String(d.file), "base64").toString("utf8");
        return new NextResponse(text, {
          status: 200,
          headers: {
            "Content-Type": asSource ? "text/plain; charset=utf-8" : String(d.mime_type || "text/html"),
            "Cache-Control": "no-store",
          },
        });
      }

      const types = ["shippingLabel", "invoice", "carrierManifest"];
      const results: any[] = [];
      for (const t of types) {
        const resp = await askFor(t);
        const d = resp?.data?.document;
        results.push({
          docType: t,
          ok: resp?.code === "0" && !!d?.file,
          apiCode: resp?.code ?? null,
          apiMessage: resp?.message ?? null,
          mimeType: d?.mime_type ?? null,
          decodedLength: d?.file ? Buffer.from(String(d.file), "base64").toString("utf8").length : 0,
        });
      }
      return NextResponse.json({ mode: "doctypes", orderItemId, store: r.store.storeName, results });
    }

    // ---- mode=amounts : raw item fields ----
    if (mode === "amounts") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      if (!orderItemId) return NextResponse.json({ error: "orderItemId required" }, { status: 400 });

      const r = await resolveItemAndStore(orderItemId);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

      const itemsResp = await callDaraz(
        "/order/items/get",
        { order_id: r.item.darazOrderId },
        r.store.accessToken as string,
        appKey,
        appSecret
      );
      const rawItems = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
      const allKeys = Array.from(new Set(rawItems.flatMap((it: any) => Object.keys(it || {})))).sort();
      const moneyish = /price|amount|fee|cost|total|voucher|discount|tax|qty|quantity|shipping/i;
      const moneyFields = rawItems.map((it: any) => {
        const out: Record<string, any> = { order_item_id: it?.order_item_id };
        for (const k of Object.keys(it || {})) if (moneyish.test(k)) out[k] = it[k];
        return out;
      });
      return NextResponse.json({
        mode: "amounts",
        orderItemId,
        darazOrderId: r.item.darazOrderId,
        apiCode: itemsResp?.code ?? null,
        itemCount: rawItems.length,
        allKeys,
        moneyFields,
        firstRawItem: rawItems[0] ?? null,
      });
    }

    // ================= mode=compose : THE DELIVERABLE =================
    // A5 sheet. Official Daraz shipping label on top (untouched, full size so
    // the barcode stays scannable). Our invoice below the cut line.
    //
    // Invoice rules (as specified):
    //   - one line per SHOP_SKU. Daraz gives one row per unit, so 3 rows of the
    //     same sku => Qty 3 on one line. 3 different skus => 3 named lines.
    //   - shipping fee is its own line
    //   - TOTAL PAYABLE = the COD figure read off the label. That is what the
    //     rider collects. If the breakdown does not sum to it, an Adjustment
    //     line makes up the difference so the invoice always reconciles.
    //
    // &scale=0.85  shrink the label to buy invoice room (barcode shrinks too)
    // &auto=1      open the print dialog on load
    if (mode === "compose") {
      const orderItemId = req.nextUrl.searchParams.get("orderItemId");
      const auto = req.nextUrl.searchParams.get("auto") === "1";
      const scaleRaw = parseFloat(req.nextUrl.searchParams.get("scale") || "1");
      const scale = isNaN(scaleRaw) ? 1 : Math.min(1, Math.max(0.6, scaleRaw));
      if (!orderItemId) return NextResponse.json({ error: "orderItemId required" }, { status: 400 });

      const r = await resolveItemAndStore(orderItemId);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
      const { item, store } = r;

      // 1. the official label
      const labelResp = await callDaraz(
        "/order/document/get",
        { doc_type: "shippingLabel", order_item_ids: JSON.stringify([Number(orderItemId)]) },
        store.accessToken as string,
        appKey,
        appSecret
      );
      const doc = labelResp?.data?.document;
      if (labelResp?.code !== "0" || !doc?.file) {
        return NextResponse.json(
          {
            error: "Daraz returned no label. The order must be ready_to_ship to be printable.",
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

      // 2. read the COD figure off the label BEFORE we touch the markup.
      //    The label is divs; strip tags to get text in DOM order, then take the
      //    first number that follows the COD marker.
      const labelText = labelHtml.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/gi, " ");
      const codMatch = labelText.match(/COD[^0-9]{0,60}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
      const labelCod = codMatch ? Number(codMatch[1].replace(/,/g, "")) : null;

      // 3. neutralise the two network hazards (alicdn scripts + remote logo)
      labelHtml = labelHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<meta[^>]*>/gi, "");
      const remoteSrcs = Array.from(
        new Set(
          (labelHtml.match(/src\s*=\s*["']https?:\/\/[^"']+["']/gi) || [])
            .map((s) => (s.match(/["']([^"']+)["']/) || [])[1])
            .filter(Boolean) as string[]
        )
      ).slice(0, 5);
      let inlined = 0;
      for (const url of remoteSrcs) {
        try {
          const res = await fetch(url);
          const ct = res.headers.get("content-type") || "image/png";
          const buf = Buffer.from(await res.arrayBuffer());
          labelHtml = labelHtml.split(url).join(`data:${ct};base64,${buf.toString("base64")}`);
          inlined++;
        } catch (e) {
          // leave the remote URL rather than break the label
        }
      }

      // 4. authoritative line data from Daraz (NOT from our DB)
      const itemsResp = await callDaraz(
        "/order/items/get",
        { order_id: item.darazOrderId },
        store.accessToken as string,
        appKey,
        appSecret
      );
      const rawItems: any[] = Array.isArray(itemsResp?.data) ? itemsResp.data : [];

      // group by shop_sku -> quantity
      type Line = { name: string; variation: string; sku: string; qty: number; unit: number; amount: number };
      const groups = new Map<string, Line>();
      for (const it of rawItems) {
        const key = String(it?.shop_sku || it?.sku || it?.name || "?");
        const paid = Number(it?.paid_price) || 0;
        const existing = groups.get(key);
        if (existing) {
          existing.qty += 1;
          existing.amount += paid;
        } else {
          groups.set(key, {
            name: String(it?.name || "-"),
            variation: String(it?.variation || ""),
            sku: String(it?.shop_sku || it?.sku || ""),
            qty: 1,
            unit: paid,
            amount: paid,
          });
        }
      }
      const lines = Array.from(groups.values());

      const sum = (f: (it: any) => number) => rawItems.reduce((s, it) => s + (f(it) || 0), 0);
      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const shipping = sum((it) => Number(it?.shipping_amount));
      const voucher = sum((it) => Number(it?.voucher_amount));
      const tax = sum((it) => Number(it?.tax_amount));
      const computed = subtotal + shipping + tax - voucher;
      const payable = labelCod !== null ? labelCod : computed;
      const adjustment = Math.round((payable - computed) * 100) / 100;

      const first = rawItems[0] || {};
      const shopName = String(first?.shop_id || store.storeName || "");
      const tracking = String(first?.tracking_code || "");
      const currency = String(first?.currency || "NPR");
      const orderRow = await prisma.darazOrder.findUnique({ where: { darazOrderId: item.darazOrderId } });
      const orderDate = orderRow?.orderDate
        ? new Date(orderRow.orderDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
        : "";

      const esc = (v: any) =>
        String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const money = (n: number) => (isNaN(n) ? "-" : n.toFixed(2));

      const MAX_LINES = 4;
      const shown = lines.slice(0, MAX_LINES);
      const rows = shown
        .map(
          (l) => `<tr>
          <td class="nm">${esc(l.name)}${l.variation ? `<span class="var">${esc(l.variation)}</span>` : ""}</td>
          <td class="q">${l.qty}</td>
          <td class="r">${money(l.unit)}</td>
          <td class="r b">${money(l.amount)}</td>
        </tr>`
        )
        .join("");
      const moreRow =
        lines.length > MAX_LINES
          ? `<tr><td class="nm more">+ ${lines.length - MAX_LINES} more item(s)</td><td class="q"></td><td class="r"></td><td class="r"></td></tr>`
          : "";

      const totRow = (label: string, val: number, cls = "") =>
        `<tr class="${cls}"><td class="tl">${esc(label)}</td><td class="tv">${money(val)}</td></tr>`;

      const totals = [
        totRow("Subtotal", subtotal),
        totRow("Shipping fee", shipping),
        voucher > 0 ? totRow("Voucher", -voucher) : "",
        tax > 0 ? totRow("Tax", tax) : "",
        Math.abs(adjustment) >= 0.01 ? totRow("Adjustment", adjustment) : "",
      ]
        .filter(Boolean)
        .join("");

      // geometry
      const labelW = 115 * scale;
      const labelH = 160 * scale;
      const labelLeft = (148 - labelW) / 2;
      const cutTop = 3 + labelH + 2;
      const invTop = cutTop + 2.5;
      const invH = 210 - invTop - 3;

      const page = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(shopName)} - ${esc(item.darazOrderId)}</title>
<style>
  @page { size: A5; margin: 0; }
  html, body { margin: 0; padding: 0; background: #eef0f3; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  .sheet {
    width: 148mm; height: 210mm; position: relative; overflow: hidden;
    background: #fff; margin: 14px auto; box-shadow: 0 2px 14px rgba(0,0,0,.18);
    font-family: Arial, Helvetica, sans-serif; color: #000;
  }
  .label-slot { position: absolute; left: ${labelLeft}mm; top: 3mm; width: ${labelW}mm; height: ${labelH}mm; overflow: hidden; }
  .label-inner { ${scale === 1 ? "" : `transform: scale(${scale}); transform-origin: top left;`} }
  .cut { position: absolute; left: 5mm; top: ${cutTop}mm; width: 138mm; border-top: 1px dashed #9aa0a6; }
  .cut span { position: absolute; top: -4.4mm; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 2mm; font-size: 6pt; color: #9aa0a6; letter-spacing: 1px; }
  .inv { position: absolute; left: 6mm; top: ${invTop}mm; width: 136mm; height: ${invH}mm; font-size: 7.5pt; line-height: 1.2; overflow: hidden; }
  .ih { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.3px solid #000; padding-bottom: .8mm; }
  .ih .shop { font-size: 11pt; font-weight: bold; letter-spacing: .2px; }
  .ih .meta { font-size: 6.8pt; text-align: right; color: #333; }
  .cols { display: flex; gap: 4mm; margin-top: 1.2mm; }
  .items { flex: 1 1 auto; }
  table { width: 100%; border-collapse: collapse; }
  .items th { font-size: 6pt; text-transform: uppercase; letter-spacing: .4px; color: #555; border-bottom: .6px solid #c8ccd0; padding: .5mm .8mm; text-align: left; }
  .items td { padding: .7mm .8mm; border-bottom: .4px solid #e8eaed; vertical-align: top; font-size: 7pt; }
  td.nm { width: 60%; }
  td.q, th.q { width: 8mm; text-align: center; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  td.b { font-weight: bold; }
  .var { display: block; font-size: 5.8pt; color: #777; }
  .more { font-style: italic; color: #777; font-size: 6.2pt; }
  .side { flex: 0 0 46mm; }
  .side table { border-collapse: collapse; }
  .tl { font-size: 7pt; color: #333; padding: .5mm 0; }
  .tv { font-size: 7pt; text-align: right; padding: .5mm 0; white-space: nowrap; }
  .pay { margin-top: 1mm; border-top: 1.3px solid #000; padding-top: 1mm; display: flex; justify-content: space-between; align-items: baseline; }
  .pay .lbl { font-size: 6.5pt; font-weight: bold; letter-spacing: .5px; }
  .pay .amt { font-size: 13pt; font-weight: bold; }
  .cust { margin-top: 1.2mm; font-size: 6.8pt; color: #222; }
  .cust b { font-size: 7.5pt; }
  .brand { position: absolute; right: 0; bottom: 0; font-size: 5.5pt; color: #aeb3b8; letter-spacing: .5px; }
  .bar { text-align: center; margin-top: 14px; font-family: Arial, sans-serif; }
  .bar button { font-size: 14px; padding: 8px 20px; cursor: pointer; border: 0; background: #111; color: #fff; border-radius: 4px; }
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
  <span>Paper = A5 &middot; Margins = None &middot; Background graphics = ON</span>
</div>
<div class="sheet">
  <div class="label-slot"><div class="label-inner">${labelHtml}</div></div>
  <div class="cut"><span>CUT HERE</span></div>
  <div class="inv">
    <div class="ih">
      <div class="shop">${esc(shopName)}</div>
      <div class="meta">
        INVOICE &middot; Order ${esc(item.darazOrderId)}<br />
        ${esc(orderDate)}${tracking ? " &middot; " + esc(tracking) : ""}
      </div>
    </div>
    <div class="cols">
      <div class="items">
        <table>
          <thead><tr><th>Item</th><th class="q">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
          <tbody>${rows}${moreRow}</tbody>
        </table>
      </div>
      <div class="side">
        <table>${totals}</table>
        <div class="pay">
          <span class="lbl">TOTAL PAYABLE (COD)</span>
          <span class="amt">${esc(currency)} ${money(payable)}</span>
        </div>
      </div>
    </div>
    <div class="cust">
      <b>${esc(orderRow?.customerName || "")}</b>
      ${orderRow?.customerPhone ? " &middot; " + esc(orderRow.customerPhone) : ""}
    </div>
    <div class="brand">OlkoCMS</div>
  </div>
</div>
${auto ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>" : ""}
</body>
</html>`;

      return new NextResponse(page, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Label-COD": String(labelCod),
          "X-Computed-Total": String(computed),
          "X-Adjustment": String(adjustment),
          "X-Inlined-Assets": String(inlined),
          "X-Line-Count": String(lines.length),
          "X-Unit-Count": String(rawItems.length),
        },
      });
    }

    // ---- default: single-item report ----
    const orderItemId = req.nextUrl.searchParams.get("orderItemId");
    if (!orderItemId) {
      return NextResponse.json(
        {
          error:
            "Pass ?mode=scan | probe | render | doctypes | doc | amounts | compose, or ?orderItemId=<id>",
        },
        { status: 400 }
      );
    }

    const r = await resolveItemAndStore(orderItemId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const itemsResp = await callDaraz(
      "/order/items/get",
      { order_id: r.item.darazOrderId },
      r.store.accessToken as string,
      appKey,
      appSecret
    );
    const items = Array.isArray(itemsResp?.data) ? itemsResp.data : [];
    const target = items.find((it: any) => String(it?.order_item_id) === String(orderItemId));

    const labelResp = await callDaraz(
      "/order/document/get",
      { doc_type: "shippingLabel", order_item_ids: JSON.stringify([Number(orderItemId)]) },
      r.store.accessToken as string,
      appKey,
      appSecret
    );
    const doc = labelResp?.data?.document;

    return NextResponse.json({
      resolvedFromOrderItem: {
        storeId: r.item.storeId,
        darazOrderId: r.item.darazOrderId,
        dbStatus: r.item.status,
        store: r.store.storeName,
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
