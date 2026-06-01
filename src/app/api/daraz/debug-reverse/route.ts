export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, body: string, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  const signBase = apiPath + concat + (body || "");
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
    const bodyObj = { page_size: 10, page_no: 1 };
    const body = JSON.stringify(bodyObj);

    const out: any[] = [];
    for (const store of stores) {
      try {
        const params: Record<string, string> = {
          access_token: store.accessToken!,
          app_key: appKey,
          sign_method: "sha256",
          timestamp: Date.now().toString(),
        };
        const sign = signRequest(apiPath, params, body, appSecret);
        const sortedKeys = Object.keys(params).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const data = await res.json();
        out.push({ store: store.storeName, code: data?.code, message: data?.message, raw: data });
      } catch (e) {
        out.push({ store: store.storeName, error: String(e).substring(0, 150) });
      }
    }

    return NextResponse.json({ apiPath, sentBody: bodyObj, stores: out });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}