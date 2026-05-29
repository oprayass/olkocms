import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings/daraz-stores?error=no_code`);
    }

    const appKey = process.env.DARAZ_APP_KEY!;
    const appSecret = process.env.DARAZ_APP_SECRET!;

    // Generate signature
    const timestamp = Date.now().toString();
    const params: Record<string, string> = {
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp,
    };
    const sortedParams = Object.keys(params).sort().map(k => `${k}${params[k]}`).join("");
    const signStr = sortedParams;
    const sign = crypto.createHmac("sha256", appSecret).update(signStr).digest("hex").toUpperCase();

    // Get token from Daraz
    const tokenUrl = `https://api.daraz.com.np/rest/auth/token/create`;
    const body = new URLSearchParams({ ...params, sign });
    const res = await fetch(tokenUrl, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = await res.json();

    if (!data.access_token) {
      console.error("Daraz token error:", data);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings/daraz-stores?error=token_failed`);
    }

    // Save to DB
    const sellerId = data.account_platform || data.account || "unknown";
    const storeName = data.account || `Store ${sellerId}`;
    const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.darazStore.upsert({
      where: { sellerId: sellerId },
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

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings/daraz-stores?success=true`);
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/settings/daraz-stores?error=unknown`);
  }
}
