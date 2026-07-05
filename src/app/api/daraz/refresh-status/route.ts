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
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

// Pull orders updated in the last 7 days for ONE store (paginated, capped)
// and sync status changes into DarazOrder. Must run inside the store's
// tenant scope so findUnique/update are auto-scoped.
async function refreshForStore(
  store: { id: string; accessToken: string | null },
  appKey: string,
  appSecret: string
): Promise<number> {
  const updateAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let updated = 0;
  let offset = 0;
  const limit = 50;
  let keepGoing = true;

  while (keepGoing) {
    const timestamp = Date.now().toString();
    const params: Record<string, string> = {
      access_token: store.accessToken!,
      app_key: appKey,
      limit: String(limit),
      offset: String(offset),
      sign_method: "sha256",
      sort_by: "updated_at",
      sort_direction: "DESC",
      timestamp,
      update_after: updateAfter,
    };
    const sign = signRequest("/orders/get", params, appSecret);
    const sortedKeys = Object.keys(params).sort();
    const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
    const url = `https://api.daraz.com.np/rest/orders/get?${query}`;

    const res = await fetch(url, { method: "GET" });
    const data = await res.json();
    const orders = data?.data?.orders || [];

    for (const o of orders) {
      const orderId = String(o.order_id);
      const newStatus = o.statuses?.[0] || o.status || "unknown";
      const existing = await prisma.darazOrder.findUnique({ where: { darazOrderId: orderId } });
      if (existing) {
        if (existing.status !== newStatus) {
          await prisma.darazOrder.update({
            where: { darazOrderId: orderId },
            data: { status: newStatus },
          });
          updated++;
        }
      }
    }

    if (orders.length < limit) keepGoing = false;
    else offset += limit;
    if (offset > 500) keepGoing = false; // safety cap
  }

  return updated;
}

export async function POST(req: NextRequest) {
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

    // Store enumeration: cron mode walks ALL tenants' stores (intentional
    // unscoped read); session mode only this tenant's stores.
    const storeWhere = { isActive: true, accessToken: { not: null as any } };
    const stores = isCron
      ? await prismaUnscoped.darazStore.findMany({ where: storeWhere })
      : await withExplicitTenant(sessionSubId!, () =>
          prisma.darazStore.findMany({ where: storeWhere })
        );

    let updated = 0;
    let storesWithoutTenant = 0;

    for (const store of stores) {
      const subId = (store as any).subscriptionId as string | null | undefined;
      if (!subId) {
        storesWithoutTenant++;
        continue;
      }
      try {
        updated += await withExplicitTenant(subId, () =>
          refreshForStore(store, appKey, appSecret)
        );
      } catch { /* skip store, keep going */ }
    }

    const body: Record<string, unknown> = { success: true, updated };
    if (storesWithoutTenant > 0) body.storesWithoutTenant = storesWithoutTenant;
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}
