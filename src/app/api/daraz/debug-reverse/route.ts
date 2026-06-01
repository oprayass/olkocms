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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pages = parseInt(searchParams.get("pages") || "5");
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const store = await prisma.darazStore.findFirst({
      where: { isActive: true, accessToken: { not: null } },
    });
    if (!store) return NextResponse.json({ error: "no store" });

    const apiPath = "/reverse/getreverseordersforseller";
    const typeCount: Record<string, number> = {};
    const shippingCount: Record<string, number> = {};
    let totalReported = 0;
    let scanned = 0;
    const samples: any[] = [];

    for (let p = 1; p <= pages; p++) {
      const params: Record<string, string> = {
        access_token: store.accessToken!,
        app_key: appKey,
        sign_method: "sha256",
        timestamp: Date.now().toString(),
        page_size: "50",
        page_no: String(p),
      };
      const sign = signRequest(apiPath, params, appSecret);
      const sortedKeys = Object.keys(params).sort();
      const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
      const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      const items = data?.result?.items || [];
      totalReported = data?.result?.total || totalReported;
      for (const it of items) {
        scanned++;
        const rt = it.request_type || "UNKNOWN";
        typeCount[rt] = (typeCount[rt] || 0) + 1;
        const st = it.shipping_type || "none";
        shippingCount[st] = (shippingCount[st] || 0) + 1;
        if (rt === "RETURN" && samples.length < 5) samples.push(it);
      }
    }

    return NextResponse.json({ store: store.storeName, totalReported, scanned, typeCount, shippingCount, returnSamples: samples });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}