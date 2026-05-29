export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect("https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=no_code");
    }

    const appKey = process.env.DARAZ_APP_KEY!;
    const appSecret = process.env.DARAZ_APP_SECRET!;
    const timestamp = Date.now().toString();

    // Daraz signature — params alphabetically sorted, no separator
    const signParams: Record<string, string> = {
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp,
    };
    const sortedKeys = Object.keys(signParams).sort();
    const signStr = sortedKeys.map(k => `${k}${signParams[k]}`).join("");
    const sign = crypto.createHmac("sha256", appSecret).update(signStr).digest("hex").toUpperCase();

    // Token URL for Nepal
    const params = new URLSearchParams({
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp,
      sign,
    });

    const tokenUrl = `https://api.daraz.com.np/rest/auth/token/create?${params.toString()}`;
    console.log("Token URL:", tokenUrl);

    const res = await fetch(tokenUrl, { method: "GET" });
    const text = await res.text();
    console.log("Token response:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("JSON parse error:", text);
      return NextResponse.redirect("https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=token_failed");
    }

    if (!data.access_token) {
      console.error("No access token:", data);
      return NextResponse.redirect("https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=token_failed");
    }

    const sellerId = data.account || data.account_platform || "unknown";
    const storeName = data.account || `Store ${Date.now()}`;
    const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.darazStore.upsert({
      where: { sellerId },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenExpiry,
        isActive: true,
        status: "Active",
      },
      create: {
        storeName,
        sellerId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenExpiry,
        isActive: true,
        status: "Active",
      },
    });

    return NextResponse.redirect("https://olkocms.vercel.app/dashboard/settings/daraz-stores?success=true");
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect("https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=unknown");
  }
}
