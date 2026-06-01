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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id") || "215468222820925";
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // DB check
    const inOrder = await prisma.darazOrder.findUnique({ where: { darazOrderId: orderId } });
    const inItems = await prisma.darazOrderItem.findMany({ where: { darazOrderId: orderId } });

    // Live forward items
    const stores = await prisma.darazStore.findMany({ where: { isActive: true, accessToken: { not: null } } });
    let live: any = null;
    for (const store of stores) {
      const params: Record<string, string> = {
        access_token: store.accessToken!, app_key: appKey, order_id: orderId,
        sign_method: "sha256", timestamp: Date.now().toString(),
      };
      const s = sign("/order/items/get", params, appSecret);
      const keys = Object.keys(params).sort();
      const q = keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${s}`;
      const data = await (await fetch(`https://api.daraz.com.np/rest/order/items/get?${q}`, { method: "GET" })).json();
      const items = data?.data;
      if (data?.code === "0" && Array.isArray(items) && items.length > 0) {
        live = {
          store: store.storeName,
          items: items.map((it: any) => ({
            order_item_id: it.order_item_id, name: it.name, status: it.status,
            tracking_code: it.tracking_code, cancel_return_initiator: it.cancel_return_initiator,
            return_status: it.return_status,
          })),
        };
        break;
      }
    }

    return NextResponse.json({
      orderId,
      inDarazOrder: inOrder ? { status: inOrder.status, storeId: inOrder.storeId } : null,
      inDarazOrderItem: inItems,
      liveForward: live,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}