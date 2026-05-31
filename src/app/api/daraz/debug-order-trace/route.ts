import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function buildDarazRequest(apiPath: string, params: Record<string, string>, appKey: string, appSecret: string) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const allParams: Record<string, string> = {
    app_key: appKey,
    sign_method: "sha256",
    timestamp,
    ...params,
  };
  const sortedKeys = Object.keys(allParams).sort();
  const buildStr = apiPath + sortedKeys.map(k => k + allParams[k]).join("");
  const sign = crypto
    .createHmac("sha256", appSecret.trim())
    .update(buildStr)
    .digest("hex")
    .toUpperCase();
  const query = sortedKeys.map(k => `${k}=${encodeURIComponent(allParams[k])}`).join("&") + `&sign=${sign}`;
  return `https://api.daraz.com.np/rest${apiPath}?${query}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id") || "215639386580372";
  const storeIndex = parseInt(searchParams.get("store") || "0");

  const appKey = process.env.DARAZ_APP_KEY!;
  const appSecret = process.env.DARAZ_APP_SECRET!;

  // We need access_token per store - fetch from DB
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const stores = await prisma.darazStore.findMany({ take: 9 });
  await prisma.$disconnect();

  if (stores.length === 0) {
    return NextResponse.json({ error: "No stores found" });
  }

  const store = stores[storeIndex % stores.length];
  const accessToken = store.accessToken;

  const apiPath = "/logistic/order/trace";
  const url = buildDarazRequest(apiPath, { access_token: accessToken, order_id: orderId }, appKey, appSecret);

  try {
    const res = await fetch(url);
    const data = await res.json();
    return NextResponse.json({ store: store.email, orderId, url: url.split("?")[0], data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}