export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
const lazadaOpenApi = require("lazada-open-api-package");

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
    const apiPath = "/auth/token/create";

    const params: Record<string, string> = {
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp,
    };

    // Package generates correct signature
    const sign = lazadaOpenApi.signature(params, apiPath, appSecret);

    const queryParams = new URLSearchParams({
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp,
      sign,
    });

    const tokenUrl = `https://api.daraz.com.np/rest${apiPath}?${queryParams.toString()}`;
    const res = await fetch(tokenUrl, { method: "GET" });
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.redirect(`https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=${encodeURIComponent("parse:" + text.substring(0, 150))}`);
    }

    if (!data.access_token) {
      const errMsg = encodeURIComponent(JSON.stringify(data).substring(0, 200));
      return NextResponse.redirect(`https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=${errMsg}`);
    }

    const sellerId = data.account || data.account_platform || "unknown";
    const storeName = data.account || `Store ${Date.now()}`;
    const tokenExpiry = new Date(Date.now() + (data.expires_in || 2592000) * 1000);

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
    const errMsg = encodeURIComponent(String(error).substring(0, 200));
    return NextResponse.redirect(`https://olkocms.vercel.app/dashboard/settings/daraz-stores?error=${errMsg}`);
  }
}
