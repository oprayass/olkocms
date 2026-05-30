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

async function callDaraz(apiPath: string, extraParams: Record<string, string>, store: any, appKey: string, appSecret: string) {
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    access_token: store.accessToken,
    app_key: appKey,
    sign_method: "sha256",
    timestamp,
    ...extraParams,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const store = await prisma.darazStore.findFirst({
      where: { isActive: true, accessToken: { not: null } },
    });
    if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

    // ek returned claim bata order_id linw
    const claim = await prisma.darazClaim.findFirst({
      where: { storeId: store.id, darazOrderId: { not: null } },
    });
    if (!claim) return NextResponse.json({ error: "No claim for this store" }, { status: 400 });

    const orderId = claim.darazOrderId!;
    const itemsResp = await callDaraz("/order/items/get", { order_id: orderId }, store, appKey, appSecret);

    return NextResponse.json({ store: store.storeName, orderId, itemsResponse: itemsResp });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}
