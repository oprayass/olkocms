export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function sign(apiPath: string, params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params).sort();
  let c = "";
  for (const k of keys) c += k + params[k];
  return crypto.createHmac("sha256", secret).update(apiPath + c, "utf8").digest("hex").toUpperCase();
}

function buildUrl(apiPath: string, params: Record<string, string>, secret: string): string {
  const s = sign(apiPath, params, secret);
  const keys = Object.keys(params).sort();
  const q = keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${s}`;
  return `https://api.daraz.com.np/rest${apiPath}?${q}`;
}

const PAGE_SIZE = 50;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const storeIndex = body.storeIndex || 0;
    const pageNo = body.pageNo || 1;

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
      orderBy: { id: "asc" },
    });

    if (storeIndex >= stores.length) {
      return NextResponse.json({ done: true, message: "all stores processed" });
    }
    const store = stores[storeIndex];

    // LIST one page
    const listParams: Record<string, string> = {
      access_token: store.accessToken!, app_key: appKey, sign_method: "sha256",
      timestamp: Date.now().toString(), page_size: String(PAGE_SIZE), page_no: String(pageNo),
    };
    const listData = await (await fetch(buildUrl("/reverse/getreverseordersforseller", listParams, appSecret), { method: "POST" })).json();
    const items = listData?.result?.items || [];
    const total = listData?.result?.total || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const returns = items.filter((it: any) => it.request_type === "RETURN");
    let itemsUpserted = 0;

    for (const ro of returns) {
      const detParams: Record<string, string> = {
        access_token: store.accessToken!, app_key: appKey, sign_method: "sha256",
        timestamp: Date.now().toString(), reverse_order_id: String(ro.reverse_order_id),
      };
      const detData = await (await fetch(buildUrl("/order/reverse/return/detail/list", detParams, appSecret), { method: "GET" })).json();
      const d = detData?.data;
      const lines = d?.reverseOrderLineDTOList || [];
      for (const l of lines) {
        if (!l.trade_order_line_id) continue;
        const oiid = String(l.trade_order_line_id);
        const returnFields = {
          returnTrackingNo: l.tracking_number || null,
          reverseOrderId: String(ro.reverse_order_id),
          reverseOrderLineId: l.reverse_order_line_id != null ? String(l.reverse_order_line_id) : null,
          ofcStatus: l.ofc_status || null,
          reverseStatus: l.reverse_status || null,
          whqcDecision: l.whqc_decision || null,
          returnReason: l.reason_text || null,
          refundAmount: l.refund_amount != null ? l.refund_amount / 100 : null,
          requestType: ro.request_type || null,
          shippingType: ro.shipping_type || null,
        };
        await prisma.darazOrderItem.upsert({
          where: { orderItemId: oiid },
          update: returnFields,
          create: {
            orderItemId: oiid,
            darazOrderId: String(d?.trade_order_id || ro.trade_order_id || ""),
            itemName: l.seller_sku_id || null,
            sku: l.productDTO?.sku || null,
            price: l.item_unit_price != null ? l.item_unit_price / 100 : null,
            storeId: store.id,
            ...returnFields,
          },
        });
        itemsUpserted++;
      }
    }

    let nextStoreIndex = storeIndex;
    let nextPageNo: number | null = pageNo + 1;
    if (pageNo >= totalPages || items.length === 0) {
      nextStoreIndex = storeIndex + 1;
      nextPageNo = nextStoreIndex < stores.length ? 1 : null;
    }
    const done = nextPageNo == null;

    return NextResponse.json({
      storeIndex, pageNo, storeName: store.storeName, total, totalPages,
      scanned: items.length, returnsFound: returns.length, itemsUpserted,
      nextStoreIndex, nextPageNo, done,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}