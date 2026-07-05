export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, prismaUnscoped } from "@/lib/prisma";
import { withExplicitTenant } from "@/lib/with-tenant";
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

function buildWindows(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const start = new Date("2019-01-01").getTime();
  const now = Date.now();
  const step = 15 * 24 * 60 * 60 * 1000;
  for (let s = start; s < now; s += step) {
    out.push([s, Math.min(s + step, now)]);
  }
  return out;
}

const PAGE_SIZE = 50;

export async function POST(req: NextRequest) {
  try {
    // ---- Gate: cron bearer OR logged-in dashboard session ----
    const authHeader = req.headers.get("authorization");
    const isCron =
      !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let sessionSubId: string | null = null;
    if (!isCron) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      sessionSubId = ((session.user as any)?.subscriptionId as string | null) ?? null;
      if (!sessionSubId) {
        return NextResponse.json(
          { error: "No subscription bound to this account" },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const storeIndex = body.storeIndex || 0;
    const windowIndex = body.windowIndex || 0;
    const pageNo = body.pageNo || 1;

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // Store enumeration. This route is a per-store state machine (one call =
    // one store x window x page), so cron mode can walk the GLOBAL store list
    // (intentional unscoped read) while each store's processing runs inside
    // ITS OWN tenant scope. Session mode walks only this tenant's stores.
    const storeWhere = { isActive: true, accessToken: { not: null as any } };
    const stores = isCron
      ? await prismaUnscoped.darazStore.findMany({ where: storeWhere, orderBy: { id: "asc" } })
      : await withExplicitTenant(sessionSubId!, () =>
          prisma.darazStore.findMany({ where: storeWhere, orderBy: { id: "asc" } })
        );
    const windows = buildWindows();

    if (storeIndex >= stores.length) {
      return NextResponse.json({ done: true, message: "all stores processed" });
    }
    const store = stores[storeIndex];
    const [wStart, wEnd] = windows[windowIndex];

    const subId = (store as any).subscriptionId as string | null | undefined;
    if (!subId) {
      // Store not backfilled with a tenant: skip it but keep the state
      // machine moving so the client loop doesn't stall.
      const nStoreSkip = storeIndex + 1;
      return NextResponse.json({
        storeIndex, windowIndex, pageNo, storeName: store.storeName,
        error: "store has no subscriptionId; skipped",
        nextStoreIndex: nStoreSkip, nextWindowIndex: 0,
        nextPageNo: nStoreSkip >= stores.length ? null : 1,
        done: nStoreSkip >= stores.length,
      });
    }

    // Everything for this store (Daraz calls + upserts) inside ITS tenant scope.
    const r = await withExplicitTenant(subId, async () => {
      const listParams: Record<string, string> = {
        access_token: store.accessToken!, app_key: appKey, sign_method: "sha256",
        timestamp: Date.now().toString(), page_size: String(PAGE_SIZE), page_no: String(pageNo),
        TradeOrderLineCreatedTimeRangeStart: String(wStart),
        TradeOrderLineCreatedTimeRangeEnd: String(wEnd),
      };
      const listData = await (await fetch(buildUrl("/reverse/getreverseordersforseller", listParams, appSecret), { method: "POST" })).json();
      const items = listData?.result?.items || [];
      const total = listData?.result?.total || 0;
      const totalPages = Math.ceil(total / PAGE_SIZE);
      const capRisk = total > 5000;

      const returns = items.filter((it: any) => it.request_type === "RETURN");
      let itemsUpserted = 0;
      let itemsSkipped = 0;
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
          const rf = {
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
          try {
            await prisma.darazOrderItem.upsert({
              where: { orderItemId: oiid },
              update: rf,
              create: {
                orderItemId: oiid,
                darazOrderId: String(d?.trade_order_id || ro.trade_order_id || ""),
                itemName: l.seller_sku_id || null, sku: l.productDTO?.sku || null,
                price: l.item_unit_price != null ? l.item_unit_price / 100 : null,
                storeId: store.id, ...rf,
              },
            });
            itemsUpserted++;
          } catch (err: any) {
            if (err?.code === "P2002") itemsSkipped++; // exists under another tenant
            else throw err;
          }
        }
      }
      return { items, total, totalPages, capRisk, returns, itemsUpserted, itemsSkipped };
    });

    let nStore = storeIndex, nWindow = windowIndex, nPage: number | null = pageNo + 1;
    if (pageNo >= r.totalPages || r.items.length === 0) {
      nWindow = windowIndex + 1;
      nPage = 1;
      if (nWindow >= windows.length) { nStore = storeIndex + 1; nWindow = 0; }
      if (nStore >= stores.length) { nPage = null; }
    }
    const done = nPage == null;

    return NextResponse.json({
      storeIndex, windowIndex, pageNo, storeName: store.storeName,
      window: [new Date(wStart).toISOString().slice(0,10), new Date(wEnd).toISOString().slice(0,10)],
      total: r.total, totalPages: r.totalPages, capRisk: r.capRisk,
      scanned: r.items.length, returnsFound: r.returns.length,
      itemsUpserted: r.itemsUpserted, itemsSkipped: r.itemsSkipped,
      totalWindows: windows.length,
      nextStoreIndex: nStore, nextWindowIndex: nWindow, nextPageNo: nPage, done,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}
