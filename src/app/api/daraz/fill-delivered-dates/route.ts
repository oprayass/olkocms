export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

const DELIVERED_STATUSES = ["delivered", "shipped"];

// Walk the trace response and return the epoch-ms event_time of the "Delivered" stage
function extractDeliveredTime(data: any): number | null {
  const packages = data?.result?.data || [];
  for (const pkg of packages) {
    const list = pkg?.package_detail_info_list || [];
    for (const p of list) {
      const events = p?.logistic_detail_info_list || [];
      for (const ev of events) {
        const isDelivered =
          ev?.detail_type === "delivered" ||
          ev?.status_code === "1400" ||
          ev?.title === "Delivered";
        if (isDelivered && ev?.event_time) {
          const t = Number(ev.event_time);
          if (!isNaN(t) && t > 0) return t;
        }
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const limit = 12; // Vercel 10s timeout - small batch
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // ALL delivered orders (re-fill even if deliveredAt already set, to fix old wrong values)
    const orders = await prisma.darazOrder.findMany({
      where: {
        status: { in: DELIVERED_STATUSES },
      },
      select: { darazOrderId: true, storeId: true },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    const stores = await prisma.darazStore.findMany({ where: { isActive: true, accessToken: { not: null } } });
    const storeMap: Record<string, any> = {};
    for (const s of stores) storeMap[s.id] = s;

    let filled = 0;
    const diag: any[] = [];
    for (const ord of orders) {
      // try order's own store first, then all stores
      const tryStores = ord.storeId && storeMap[ord.storeId] ? [storeMap[ord.storeId], ...stores] : stores;
      for (const store of tryStores) {
        try {
          const timestamp = Date.now().toString();
          const params: Record<string, string> = {
            access_token: store.accessToken!,
            app_key: appKey,
            order_id: ord.darazOrderId,
            sign_method: "sha256",
            timestamp,
          };
          const apiPath = "/logistic/order/trace";
          const sign = signRequest(apiPath, params, appSecret);
          const sortedKeys = Object.keys(params).sort();
          const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
          const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;

          const res = await fetch(url, { method: "GET" });
          const data = await res.json();

          // skip stores that can't see this order (wrong store / no permission)
          if (data?.code && data.code !== "0") { diag.push({ o: ord.darazOrderId, store: store.email, code: data.code }); continue; }

          // does THIS store actually have the package trace? (empty = wrong store)
          const stageCount = (data?.result?.data || []).reduce((n: number, pkg: any) => n + (pkg?.package_detail_info_list || []).reduce((m: number, p: any) => m + (p?.logistic_detail_info_list || []).length, 0), 0);
          if (stageCount === 0) continue; // wrong store, try next
          const deliveredMs = extractDeliveredTime(data);
          if (deliveredMs) {
            await prisma.darazOrder.update({
              where: { darazOrderId: ord.darazOrderId },
              data: { deliveredAt: new Date(deliveredMs) },
            });
            filled++;
          }
          diag.push({ o: ord.darazOrderId, store: store.email, stages: stageCount, delivered: deliveredMs });
          break; // correct store found (delivered or not yet) - done with this order
        } catch { /* next store */ }
      }
    }

    return NextResponse.json({
      success: true,
      processed: orders.length,
      filled,
      storeCount: stores.length,
      storeEmails: stores.map((s: any) => s.email),
      diag,
      nextOffset: offset + limit,
      done: orders.length < limit,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}