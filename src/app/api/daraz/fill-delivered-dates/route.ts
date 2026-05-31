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

// Daraz date "2026-05-15 16:59:26 +0800" -> Date
function parseDarazDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T").replace(" ", ""));
  return isNaN(d.getTime()) ? null : d;
}

const DELIVERED_STATUSES = ["delivered", "shipped"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const limit = 12; // Vercel 10s — सानो batch

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // delivered status भएका तर deliveredAt नभरिएका orders
    const orders = await prisma.darazOrder.findMany({
      where: {
        status: { in: DELIVERED_STATUSES },
        deliveredAt: null,
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

    for (const ord of orders) {
      // order को store पहिले try, नभए सबै store
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
          const sign = signRequest("/order/items/get", params, appSecret);
          const sortedKeys = Object.keys(params).sort();
          const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
          const url = `https://api.daraz.com.np/rest/order/items/get?${query}`;
          const res = await fetch(url, { method: "GET" });
          const data = await res.json();
          const items = data?.data || [];
          if (items.length === 0) continue;

          // delivered item को updated_at खोज्ने
          const deliveredItem = items.find((it: any) => DELIVERED_STATUSES.includes(it.status));
          const target = deliveredItem || items[0];
          const dt = parseDarazDate(target.updated_at);
          if (dt) {
            await prisma.darazOrder.update({
              where: { darazOrderId: ord.darazOrderId },
              data: { deliveredAt: dt },
            });
            filled++;
          }
          break; // यो order भयो, अर्को order
        } catch { /* next store */ }
      }
    }

    return NextResponse.json({
      success: true,
      processed: orders.length,
      filled,
      nextOffset: offset + limit,
      done: orders.length < limit,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}