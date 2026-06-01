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
    const reverseOrderId = searchParams.get("reverse_order_id") || "502443085678945";
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    const apiPath = "/order/reverse/return/detail/list";

    const out: any[] = [];
    for (const store of stores) {
      try {
        const allForSign: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          sign_method: "sha256",
          timestamp: Date.now().toString(),
          reverse_order_id: reverseOrderId,
        };
        const sign = signRequest(apiPath, allForSign, appSecret);
        const sortedKeys = Object.keys(allForSign).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(allForSign[k])}`).join("&") + `&sign=${sign}`;
        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, { method: "GET" });
        const data = await res.json();
        const hasData = data?.code === "0" && data?.result;
        out.push({ store: store.storeName, code: data?.code, message: data?.message, raw: hasData ? data : undefined });
      } catch (e) {
        out.push({ store: store.storeName, error: String(e).substring(0, 150) });
      }
    }

    return NextResponse.json({ apiPath, reverseOrderId, stores: out });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}