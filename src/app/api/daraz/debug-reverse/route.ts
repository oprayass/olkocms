export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, allParams: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(allParams).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + allParams[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tradeOrderId = searchParams.get("trade_order_id") || "207558548878945";
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    const apiPath = "/reverse/getreverseordersforseller";

    const out: any[] = [];
    for (const store of stores) {
      try {
        const allForSign: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          sign_method: "sha256",
          timestamp: Date.now().toString(),
          page_size: "10",
          page_no: "1",
          trade_order_id: tradeOrderId,
        };
        const sign = signRequest(apiPath, allForSign, appSecret);
        const sortedKeys = Object.keys(allForSign).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(allForSign[k])}`).join("&") + `&sign=${sign}`;
        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();
        const items = data?.result?.items || [];
        if (data?.code === "0" && Array.isArray(items) && items.length > 0) {
          out.push({ store: store.storeName, code: data.code, itemCount: items.length, raw: data });
        }
      } catch (e) {
        out.push({ store: store.storeName, error: String(e).substring(0, 150) });
      }
    }

    return NextResponse.json({ tradeOrderId, matches: out });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}