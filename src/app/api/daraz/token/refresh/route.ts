export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) {
    concat += k + params[k];
  }
  const signBase = apiPath + concat;
  return crypto.createHmac("sha256", appSecret).update(signBase, "utf8").digest("hex").toUpperCase();
}

export async function GET() {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // Stores jasko token 7 din bhitra expire hunchha
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const stores = await prisma.darazStore.findMany({
      where: {
        isActive: true,
        refreshToken: { not: null },
        tokenExpiry: { lte: sevenDaysLater },
      },
    });

    if (stores.length === 0) {
      return NextResponse.json({ success: true, message: "No tokens need refresh", refreshed: 0 });
    }

    const results: any[] = [];
    let refreshed = 0;

    for (const store of stores) {
      try {
        const apiPath = "/auth/token/refresh";
        const timestamp = Date.now().toString();
        const params: Record<string, string> = {
          app_key: appKey,
          refresh_token: store.refreshToken!,
          sign_method: "sha256",
          timestamp,
        };
        const sign = signRequest(apiPath, params, appSecret);
        const sortedKeys = Object.keys(params).sort();
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, { method: "GET" });
        const data = await res.json();

        if (data.access_token) {
          const tokenExpiry = new Date(Date.now() + (data.expires_in || 2592000) * 1000);
          await prisma.darazStore.update({
            where: { id: store.id },
            data: {
              accessToken: data.access_token,
              refreshToken: data.refresh_token || store.refreshToken,
              tokenExpiry,
              isActive: true,
              status: "Active",
            },
          });
          refreshed++;
          results.push({ store: store.storeName, status: "refreshed" });
        } else {
          results.push({ store: store.storeName, status: "failed", error: JSON.stringify(data).substring(0, 100) });
        }
      } catch (err) {
        results.push({ store: store.storeName, status: "error", error: String(err).substring(0, 100) });
      }
    }

    return NextResponse.json({ success: true, refreshed, checked: stores.length, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}
