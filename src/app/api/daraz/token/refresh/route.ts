export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, prismaUnscoped } from "@/lib/prisma";
import { withExplicitTenant } from "@/lib/with-tenant";
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

export async function GET(req: NextRequest) {
  try {
    // ---- Gate: cron bearer OR logged-in dashboard session ----
    const authHeader = req.headers.get("authorization");
    const isCron =
      !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let sessionSubId: string | null = null;
    if (!isCron) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      sessionSubId = ((session.user as any)?.subscriptionId as string | null) ?? null;
      if (!sessionSubId) {
        return NextResponse.json(
          { error: "No subscription bound to this account" },
          { status: 403 }
        );
      }
    }

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    // Stores whose token expires within 7 days (or already expired).
    // Cron mode: all tenants (intentional unscoped read).
    // Session mode: only THIS tenant's stores.
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const storeWhere = {
      isActive: true,
      refreshToken: { not: null as any },
      tokenExpiry: { lte: sevenDaysLater },
    };
    const stores = isCron
      ? await prismaUnscoped.darazStore.findMany({ where: storeWhere })
      : await withExplicitTenant(sessionSubId!, () =>
          prisma.darazStore.findMany({ where: storeWhere })
        );

    if (stores.length === 0) {
      return NextResponse.json({ success: true, message: "No tokens need refresh", refreshed: 0 });
    }

    const results: any[] = [];
    let refreshed = 0;
    let storesWithoutTenant = 0;

    for (const store of stores) {
      const subId = (store as any).subscriptionId as string | null | undefined;
      if (!subId) {
        storesWithoutTenant++;
        results.push({ store: store.storeName, status: "skipped", error: "store has no subscriptionId" });
        continue;
      }
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
          // Scoped update inside THIS store's tenant context.
          await withExplicitTenant(subId, () =>
            prisma.darazStore.update({
              where: { id: store.id },
              data: {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || store.refreshToken,
                tokenExpiry,
                isActive: true,
                status: "Active",
              },
            })
          );
          refreshed++;
          results.push({ store: store.storeName, status: "refreshed" });
        } else {
          results.push({ store: store.storeName, status: "failed", error: JSON.stringify(data).substring(0, 100) });
        }
      } catch (err) {
        results.push({ store: store.storeName, status: "error", error: String(err).substring(0, 100) });
      }
    }

    const body: Record<string, unknown> = { success: true, refreshed, checked: stores.length, results };
    if (storesWithoutTenant > 0) body.storesWithoutTenant = storesWithoutTenant;
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}
