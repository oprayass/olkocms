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

const CANDIDATES = [
  "/reverse/getreverseorderdetail",
  "/reverse/order/detail",
  "/order/reverse/detail/get",
  "/reverse/getreverseorderitem",
  "/order/reverse/return/detail/list",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reverseOrderId = searchParams.get("reverse_order_id") || "502443085678945";
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const store = await prisma.darazStore.findFirst({
      where: { isActive: true, accessToken: { not: null }, storeName: "Yagya Premiums" },
    });
    if (!store) return NextResponse.json({ error: "Yagya store not found" });

    const out: any[] = [];
    for (const apiPath of CANDIDATES) {
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
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();
        out.push({ apiPath, code: data?.code, message: data?.message, raw: data });
      } catch (e) {
        out.push({ apiPath, error: String(e).substring(0, 150) });
      }
    }

    return NextResponse.json({ reverseOrderId, candidates: out });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}