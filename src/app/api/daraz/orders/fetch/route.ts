export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, prismaUnscoped } from "@/lib/prisma";
import { withExplicitTenant } from "@/lib/with-tenant";
import crypto from "crypto";

function normalizePhone(raw: string | null | undefined): { normalized: string | null; raw: string | null } {
  if (!raw) return { normalized: null, raw: null };
  const cleanedRaw = String(raw).trim();
  if (!cleanedRaw) return { normalized: null, raw: null };
  let digits = cleanedRaw.replace(/[^0-9]/g, '');
  if (digits.length === 13 && digits.startsWith('977')) digits = digits.slice(3);
  if (digits.length === 11 && digits.startsWith('977')) digits = digits.slice(3);
  const normalized = digits.length === 10 ? digits : null;
  return { normalized, raw: cleanedRaw };
}

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) {
    concat += k + params[k];
  }
  const signBase = apiPath + concat;
  return crypto.createHmac("sha256", appSecret).update(signBase, "utf8").digest("hex").toUpperCase();
}

// Incremental write into DarazOrder: new -> create, changed -> update, same -> skip.
// Never wipes existing fields with null/undefined/"N/A".
// Always called inside withExplicitTenant(store.subscriptionId, ...), so the
// scoped client injects subscriptionId everywhere. If the same darazOrderId
// exists under ANOTHER tenant, the scoped findUnique sees nothing and create
// hits the global unique constraint -> P2002 -> skip (never cross-tenant overwrite).
async function upsertDarazOrder(o: {
  darazOrderId: string;
  customerName: string;
  product: string;
  quantity: number;
  price: number;
  status: string;
  storeId: string;
  orderDate: Date | null;
  customerPhone: string | null;
  customerPhoneRaw: string | null;
}): Promise<"created" | "updated" | "skipped"> {
  const existing = await prisma.darazOrder.findUnique({
    where: { darazOrderId: o.darazOrderId },
  });

  if (!existing) {
    try {
      await prisma.darazOrder.create({
        data: {
          darazOrderId: o.darazOrderId,
          customerName: o.customerName,
          product: o.product,
          quantity: o.quantity,
          price: o.price,
          status: o.status,
          storeId: o.storeId,
          orderDate: o.orderDate,
          customerPhone: o.customerPhone,
          customerPhoneRaw: o.customerPhoneRaw,
        },
      });
      return "created";
    } catch (err: any) {
      if (err?.code === "P2002") return "skipped"; // exists under another tenant
      throw err;
    }
  }

  const changes: Record<string, unknown> = {};
  if (o.status && o.status !== existing.status) changes.status = o.status;
  if (o.customerName && o.customerName !== "N/A" && o.customerName !== existing.customerName)
    changes.customerName = o.customerName;
  if (o.price && o.price !== existing.price) changes.price = o.price;
  if (o.storeId && o.storeId !== existing.storeId) changes.storeId = o.storeId;
  if (
    o.orderDate &&
    o.orderDate.getTime() !== (existing.orderDate ? existing.orderDate.getTime() : 0)
  )
    changes.orderDate = o.orderDate;

  if (o.customerPhone && o.customerPhone !== existing.customerPhone)
    changes.customerPhone = o.customerPhone;
  if (o.customerPhoneRaw && o.customerPhoneRaw !== existing.customerPhoneRaw)
    changes.customerPhoneRaw = o.customerPhoneRaw;

  if (Object.keys(changes).length === 0) return "skipped";

  await prisma.darazOrder.update({
    where: { darazOrderId: o.darazOrderId },
    data: changes,
  });
  return "updated";
}

export async function GET(req: NextRequest) {
  try {
    // ---- Gate: cron bearer OR logged-in dashboard session ----
    // Callers: (a) Orders page "Sync Orders" button step 1 (session),
    //          (b) external cron/scheduler with Authorization: Bearer CRON_SECRET.
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

    // ---- Store enumeration ----
    // Cron mode: all tenants' active stores (intentional unscoped read).
    // Session mode: only THIS tenant's stores.
    const storeWhere = { isActive: true, accessToken: { not: null as any } };
    const stores = isCron
      ? await prismaUnscoped.darazStore.findMany({ where: storeWhere })
      : await withExplicitTenant(sessionSubId!, () =>
          prisma.darazStore.findMany({ where: storeWhere })
        );

    if (stores.length === 0) {
      return NextResponse.json({ error: "No connected stores found" }, { status: 400 });
    }

    let totalFetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let storesWithoutTenant = 0;
    const results: any[] = [];

    for (const store of stores) {
      const subId = (store as any).subscriptionId as string | null | undefined;
      if (!subId) {
        storesWithoutTenant += 1;
        results.push({ store: store.storeName, error: "store has no subscriptionId; skipped" });
        continue;
      }
      try {
        // Everything for this store runs inside ITS tenant scope.
        const r = await withExplicitTenant(subId, async () => {
          const apiPath = "/orders/get";
          const timestamp = Date.now().toString();
          const fetchStart = new Date();

          // Incremental window: from lastOrderFetch if present, else last 90 days.
          const createdAfter = store.lastOrderFetch
            ? store.lastOrderFetch.toISOString()
            : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

          const params: Record<string, string> = {
            access_token: store.accessToken!,
            app_key: appKey,
            created_after: createdAfter,
            limit: "100",
            offset: "0",
            sign_method: "sha256",
            sort_by: "created_at",
            sort_direction: "DESC",
            timestamp,
          };

          const sign = signRequest(apiPath, params, appSecret);
          const sortedKeys = Object.keys(params).sort();
          const query =
            sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;

          const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
          const res = await fetch(url, { method: "GET" });
          const data = await res.json();

          const orders = data?.data?.orders || [];
          let sCreated = 0;
          let sUpdated = 0;
          let sSkipped = 0;

          for (const o of orders) {
            const action = await upsertDarazOrder({
              darazOrderId: String(o.order_id),
              customerName:
                `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
              product: o.items_count ? `${o.items_count} item(s)` : "Daraz Order",
              quantity: o.items_count || 1,
              price: parseFloat(o.price) || 0,
              status: o.statuses?.[0] || o.status || "unknown",
              storeId: store.id,
              orderDate: o.created_at ? new Date(o.created_at) : null,
              customerPhone: (() => {
                const rawPhone =
                  o.address_shipping?.phone ||
                  o.address_shipping?.phone2 ||
                  o.address_billing?.phone ||
                  o.address_billing?.phone2 ||
                  null;
                return normalizePhone(rawPhone).normalized;
              })(),
              customerPhoneRaw: (() => {
                const rawPhone =
                  o.address_shipping?.phone ||
                  o.address_shipping?.phone2 ||
                  o.address_billing?.phone ||
                  o.address_billing?.phone2 ||
                  null;
                return normalizePhone(rawPhone).raw;
              })(),
            });
            if (action === "created") sCreated += 1;
            else if (action === "updated") sUpdated += 1;
            else sSkipped += 1;
          }

          // Advance lastOrderFetch ONLY when Daraz confirms success (code "0").
          // Advancing on failure silently skips the failed window forever
          // (this is exactly how the June 28 token outage created a data gap).
          const apiOk = data?.code === "0";
          if (apiOk) {
            await prisma.darazStore.update({
              where: { id: store.id },
              data: { lastOrderFetch: fetchStart },
            });
          }

          return {
            fetched: orders.length,
            created: sCreated,
            updated: sUpdated,
            skipped: sSkipped,
            incremental: !!store.lastOrderFetch,
            createdAfter,
            windowAdvanced: apiOk,
            error: !apiOk ? JSON.stringify(data).substring(0, 100) : null,
          };
        });

        totalFetched += r.fetched;
        created += r.created;
        updated += r.updated;
        skipped += r.skipped;
        results.push({
          store: store.storeName,
          fetched: r.fetched,
          incremental: r.incremental,
          createdAfter: r.createdAfter,
          error: r.error,
        });
      } catch (storeErr) {
        results.push({ store: store.storeName, error: String(storeErr).substring(0, 100) });
      }
    }

    const body: Record<string, unknown> = {
      success: true,
      totalFetched,
      created,
      updated,
      skipped,
      stores: stores.length,
      results,
    };
    if (storesWithoutTenant > 0) body.storesWithoutTenant = storesWithoutTenant;

    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}
