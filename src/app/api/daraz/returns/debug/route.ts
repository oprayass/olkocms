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

    const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const results: any = {};

    // Try 1: reverse order list
    results.tryReverseList = await callDaraz("/reverse/getreverseorderlist", {
      page_size: "10", page_no: "1", start_time: startTime,
    }, store, appKey, appSecret);

    // Try 2: another common path
    results.tryReverseListV2 = await callDaraz("/reverse/order/list/get", {
      page_size: "10", page_no: "1",
    }, store, appKey, appSecret);

    // Try 3: orders with return status filter
    results.tryOrdersReturn = await callDaraz("/orders/get", {
      status: "returned", limit: "10", offset: "0", sort_by: "created_at", sort_direction: "DESC",
    }, store, appKey, appSecret);

    return NextResponse.json({ store: store.storeName, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}
