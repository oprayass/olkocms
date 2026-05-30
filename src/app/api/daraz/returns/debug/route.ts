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

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // pahilo connected store linw
    const store = await prisma.darazStore.findFirst({
      where: { isActive: true, accessToken: { not: null } },
    });
    if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

    const apiPath = "/order/reverse/return/detail/list";
    const timestamp = Date.now().toString();
    const createdAfter = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const params: Record<string, string> = {
      access_token: store.accessToken!,
      app_key: appKey,
      sign_method: "sha256",
      timestamp,
      page_size: "10",
      page_no: "1",
      create_time_start: createdAfter,
    };

    const sign = signRequest(apiPath, params, appSecret);
    const sortedKeys = Object.keys(params).sort();
    const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
    const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;

    const res = await fetch(url, { method: "GET" });
    const data = await res.json();

    return NextResponse.json({ store: store.storeName, requestParams: params, response: data });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}
