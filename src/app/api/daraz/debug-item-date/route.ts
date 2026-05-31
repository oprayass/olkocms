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

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // यो order कुन store को हो — DB बाट storeId, अनि token
    const order = await prisma.darazOrder.findUnique({ where: { darazOrderId: orderId } });
    const stores = await prisma.darazStore.findMany({ where: { isActive: true, accessToken: { not: null } } });

    // सबै store try गर्ने (कुन store को हो थाहा नभए)
    for (const store of stores) {
      const timestamp = Date.now().toString();
      const params: Record<string, string> = {
        access_token: store.accessToken!,
        app_key: appKey,
        order_id: orderId,
        sign_method: "sha256",
        timestamp,
      };
      const sign = signRequest("/order/items/get", params, appSecret);
      const sortedKeys = Object.keys(params).sort();
      const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
      const url = `https://api.daraz.com.np/rest/order/items/get?${query}`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      if (data?.data && data.data.length > 0) {
        // पहिलो item को सबै keys + values देखाउने
        return NextResponse.json({
          storeMatched: store.id,
          itemKeys: Object.keys(data.data[0]),
          firstItem: data.data[0],
        });
      }
    }
    return NextResponse.json({ error: "No items found in any store", dbStatus: order?.status });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}