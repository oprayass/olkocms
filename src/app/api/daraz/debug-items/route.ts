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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id") || "215639386580372";
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    const out: any[] = [];
    for (const store of stores) {
      const apiPath = "/order/items/get";
      const params: Record<string, string> = {
        access_token: store.accessToken!,
        app_key: appKey,
        order_id: orderId,
        sign_method: "sha256",
        timestamp: Date.now().toString(),
      };
      const sign = signRequest(apiPath, params, appSecret);
      const sortedKeys = Object.keys(params).sort();
      const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
      const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      const items = data?.data || [];
      out.push({
        store: store.storeName,
        code: data?.code,
        itemCount: Array.isArray(items) ? items.length : 0,
        items: Array.isArray(items) ? items.map((it: any) => ({
          order_item_id: it.order_item_id,
          name: it.name,
          sku: it.sku,
          tracking_code: it.tracking_code,
          status: it.status,
          shipment_provider: it.shipment_provider,
          cancel_return_initiator: it.cancel_return_initiator,
          return_status: it.return_status,
          paid_price: it.paid_price,
          item_price: it.item_price,
        })) : [],
      });
    }

    return NextResponse.json({ orderId, stores: out });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}