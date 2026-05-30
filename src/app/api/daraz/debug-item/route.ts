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
  const appKey = (process.env.DARAZ_APP_KEY || "").trim();
  const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
  const orderId = req.nextUrl.searchParams.get("orderId");
  const storeId = req.nextUrl.searchParams.get("store");
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const store = await prisma.darazStore.findFirst({
    where: storeId ? { id: storeId } : { isActive: true, accessToken: { not: null } },
  });
  if (!store?.accessToken) return NextResponse.json({ error: "No store" }, { status: 400 });

  const apiPath = "/order/items/get";
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    access_token: store.accessToken,
    app_key: appKey,
    order_id: orderId,
    sign_method: "sha256",
    timestamp,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const res = await fetch(`https://api.daraz.com.np/rest${apiPath}?${query}`, { method: "GET" });
  const data = await res.json();

  return NextResponse.json(data);
}