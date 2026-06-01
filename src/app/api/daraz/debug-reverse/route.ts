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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id") || "215676573012376";
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({ where: { isActive: true, accessToken: { not: null } } });

    let result: any = { orderId, reverseOrders: [] };
    for (const store of stores) {
      const listParams: Record<string, string> = {
        access_token: store.accessToken!, app_key: appKey, sign_method: "sha256",
        timestamp: Date.now().toString(), page_size: "10", page_no: "1", trade_order_id: orderId,
      };
      const listData = await (await fetch(buildUrl("/reverse/getreverseordersforseller", listParams, appSecret), { method: "POST" })).json();
      const items = listData?.result?.items || [];
      if (listData?.code === "0" && items.length > 0) {
        result.store = store.storeName;
        for (const ro of items) {
          const detParams: Record<string, string> = {
            access_token: store.accessToken!, app_key: appKey, sign_method: "sha256",
            timestamp: Date.now().toString(), reverse_order_id: String(ro.reverse_order_id),
          };
          const detData = await (await fetch(buildUrl("/order/reverse/return/detail/list", detParams, appSecret), { method: "GET" })).json();
          result.reverseOrders.push({
            reverse_order_id: ro.reverse_order_id,
            request_type: ro.request_type,
            shipping_type: ro.shipping_type,
            detailRaw: detData?.data,
          });
        }
        break;
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}