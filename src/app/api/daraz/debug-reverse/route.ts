export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, allParams: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(allParams).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + allParams[k];
  const signBase = apiPath + concat;
  return crypto.createHmac("sha256", appSecret).update(signBase, "utf8").digest("hex").toUpperCase();
}

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    const apiPath = "/reverse/getreverseordersforseller";

    const out: any[] = [];
    for (const store of stores) {
      try {
        const sysParams: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          sign_method: "sha256",
          timestamp: Date.now().toString(),
        };
        const bizParams: Record<string, string> = {
          page_size: "10",
          page_no: "1",
        };
        const allForSign = { ...sysParams, ...bizParams };
        const sign = signRequest(apiPath, allForSign, appSecret);

        const allForQuery: Record<string, string> = { ...allForSign };
        const sortedKeys = Object.keys(allForQuery).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(allForQuery[k])}`).join("&") + `&sign=${sign}`;
        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, { method: "POST" });
        const data = await res.json();
        out.push({ store: store.storeName, code: data?.code, message: data?.message, raw: data });
      } catch (e) {
        out.push({ store: store.storeName, error: String(e).substring(0, 150) });
      }
    }

    return NextResponse.json({ apiPath, stores: out });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}