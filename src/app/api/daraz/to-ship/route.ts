export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

async function callDaraz(
  apiPath: string,
  extra: Record<string, string>,
  accessToken: string,
  appKey: string,
  appSecret: string
) {
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    access_token: accessToken,
    app_key: appKey,
    sign_method: "sha256",
    timestamp,
    ...extra,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

const TO_SHIP_STATUSES = ["pending", "ready_to_ship", "packed"];

// Incremental write into DarazOrder: new -> create, changed -> update, same -> skip.
// Never wipes existing fields with null/undefined.
async function upsertDarazOrder(o: {
  darazOrderId: string;
  customerName: string;
  product: string;
  quantity: number;
  price: number;
  status: string;
  storeId: string;
  orderDate: Date | null;
}): Promise<"created" | "updated" | "skipped"> {
  const existing = await prisma.darazOrder.findUnique({
    where: { darazOrderId: o.darazOrderId },
  });

  if (!existing) {
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
      },
    });
    return "created";
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

  if (Object.keys(changes).length === 0) return "skipped";

  await prisma.darazOrder.update({
    where: { darazOrderId: o.darazOrderId },
    data: changes,
  });
  return "updated";
}

export async function GET() {
  const appKey = (process.env.DARAZ_APP_KEY || "").trim();
  const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let liveOk = false;
  let liveError: string | null = null;

  // 1) LIVE incremental pull into central DB (best-effort).
  try {
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });
    const createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    for (const store of stores) {
      for (const status of TO_SHIP_STATUSES) {
        try {
          const resp = await callDaraz(
            "/orders/get",
            {
              created_after: createdAfter,
              limit: "50",
              offset: "0",
              sort_by: "created_at",
              sort_direction: "DESC",
              status,
            },
            store.accessToken!,
            appKey,
            appSecret
          );
          const orders = resp?.data?.orders || [];
          for (const o of orders) {
            const action = await upsertDarazOrder({
              darazOrderId: String(o.order_id),
              customerName:
                `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
              product: o.items_count ? `${o.items_count} item(s)` : "Daraz Order",
              quantity: o.items_count || 1,
              price: parseFloat(o.price) || 0,
              status: o.statuses?.[0] || status,
              storeId: store.id,
              orderDate: o.created_at ? new Date(o.created_at) : null,
            });
            if (action === "created") created += 1;
            else if (action === "updated") updated += 1;
            else skipped += 1;
          }
        } catch {
          /* skip this store/status, keep going */
        }
      }
    }
    liveOk = true;
  } catch (err) {
    liveError = String(err).substring(0, 200);
  }

  // 2) ALWAYS respond from the central DB (fallback to last-known if live failed).
  try {
    const rows = await prisma.darazOrder.findMany({
      where: { status: { in: TO_SHIP_STATUSES } },
      orderBy: { orderDate: "desc" },
    });
    const orders = rows.map((r) => ({
      orderId: r.darazOrderId,
      customerName: r.customerName,
      itemsCount: r.quantity,
      price: r.price,
      status: r.status,
      storeId: r.storeId,
      orderDate: r.orderDate ? r.orderDate.toISOString() : null,
    }));
    return NextResponse.json({
      orders,
      count: orders.length,
      live: { ok: liveOk, created, updated, skipped, error: liveError },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}