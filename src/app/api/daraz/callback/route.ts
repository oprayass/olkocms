export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withExplicitTenant } from "@/lib/with-tenant";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

const STORES_URL = "https://olkocms.vercel.app/dashboard/settings/daraz-stores";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(`${STORES_URL}?error=no_code`);
    }

    // --- Tenant resolve: browser-initiated flow, so the session cookie is present ---
    const session = await getServerSession(authOptions);
    const subscriptionId = (session?.user as any)?.subscriptionId as string | undefined;
    if (!subscriptionId) {
      // No tenant context -> cannot safely attach a store. Bounce to login.
      return NextResponse.redirect(
        `https://olkocms.vercel.app/login?callbackUrl=${encodeURIComponent(
          "/dashboard/settings/daraz-stores"
        )}`
      );
    }

    // --- Token exchange (no DB, no tenant scope needed) ---
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const apiPath = "/auth/token/create";
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp,
    };

    const sortedKeys = Object.keys(params).sort();
    let concat = "";
    for (const k of sortedKeys) {
      concat += k + params[k];
    }
    const signBase = apiPath + concat;
    const sign = crypto
      .createHmac("sha256", appSecret)
      .update(signBase, "utf8")
      .digest("hex")
      .toUpperCase();

    const query =
      sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") +
      `&sign=${sign}`;

    const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.redirect(`${STORES_URL}?error=token_failed`);
    }

    if (!data.access_token) {
      return NextResponse.redirect(`${STORES_URL}?error=token_failed`);
    }

    const sellerId = data.account || data.account_platform || "unknown";
    const storeName = data.account || `Store ${Date.now()}`;
    const tokenExpiry = new Date(Date.now() + (data.expires_in || 2592000) * 1000);

    // --- Tenant-scoped DB write. ONLY this is wrapped. ---
    // Extension rewrites where -> { sellerId, subscriptionId }:
    //   own store     -> match -> update (subId untouched, owner is fixed)
    //   new sellerId  -> no match -> create (subId auto-injected)
    //   other tenant  -> no match -> create -> P2002 on global @unique(sellerId)
    try {
      await withExplicitTenant(subscriptionId, () =>
        prisma.darazStore.upsert({
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
        })
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // sellerId already linked to a different subscription.
        return NextResponse.redirect(`${STORES_URL}?error=store_already_linked`);
      }
      throw e;
    }

    return NextResponse.redirect(`${STORES_URL}?success=true`);
  } catch {
    return NextResponse.redirect(`${STORES_URL}?error=unknown`);
  }
}