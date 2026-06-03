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

// Incremental write into DarazOrder: new -> create, changed -> update, same -> skip.
// Never wipes existing fields with null/undefined/"N/A".
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
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    if (stores.length === 0) {
      return NextResponse.json({ error: "No connected stores found" }, { status: 400 });
    }

    let totalFetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const store of stores) {
      try {
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
        const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;

        const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
        const res = await fetch(url, { method: "GET" });
        const data = await res.json();

        const orders = data?.data?.orders || [];
        totalFetched += orders.length;

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
          });
          if (action === "created") created += 1;
          else if (action === "updated") updated += 1;
          else skipped += 1;
        }

        // Successful fetch -> advance lastOrderFetch.
        await prisma.darazStore.update({
          where: { id: store.id },
          data: { lastOrderFetch: fetchStart },
        });

        results.push({
          store: store.storeName,
          fetched: orders.length,
          incremental: !!store.lastOrderFetch,
          createdAfter,
          error: data?.code !== "0" ? JSON.stringify(data).substring(0, 100) : null,
        });
      } catch (storeErr) {
        results.push({ store: store.storeName, error: String(storeErr).substring(0, 100) });
      }
    }

    return NextResponse.json({
      success: true,
      totalFetched,
      created,
      updated,
      skipped,
      stores: stores.length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}