export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

export async function POST() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    // पछिल्लो 7 दिनमा update भएका orders (status change सहित)
    const updateAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let updated = 0;

    for (const store of stores) {
      let offset = 0;
      const limit = 50;
      let keepGoing = true;

      while (keepGoing) {
        const timestamp = Date.now().toString();
        const params: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          limit: String(limit),
          offset: String(offset),
          sign_method: "sha256",
          sort_by: "updated_at",
          sort_direction: "DESC",
          timestamp,
          update_after: updateAfter,
        };
        const sign = signRequest("/orders/get", params, appSecret);
        const sortedKeys = Object.keys(params).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
        const url = `https://api.daraz.com.np/rest/orders/get?${query}`;

        const res = await fetch(url, { method: "GET" });
        const data = await res.json();
        const orders = data?.data?.orders || [];

        for (const o of orders) {
          const orderId = String(o.order_id);
          const newStatus = o.statuses?.[0] || o.status || "unknown";
          const existing = await prisma.darazOrder.findUnique({ where: { darazOrderId: orderId } });
          if (existing) {
            if (existing.status !== newStatus) {
              await prisma.darazOrder.update({
                where: { darazOrderId: orderId },
                data: { status: newStatus },
              });
              updated++;
            }
          }
        }

        if (orders.length < limit) keepGoing = false;
        else offset += limit;
        if (offset > 500) keepGoing = false; // safety cap
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}