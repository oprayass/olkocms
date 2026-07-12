export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// Item feed for Order Processing.
//
// WHY THIS SYNCS. DarazOrderItem rows are created ONLY by cron/nightly step 1b,
// once a night. An order that arrives today exists in DarazOrder but has NO item
// rows until 8pm - and pack/rts/print are all keyed on orderItemId. Without a
// live sync here, today's work would be invisible and unshippable.
//
// It also REFRESHES items we already hold. Without that, DB status freezes: five
// rows sat as "packed" for weeks while Daraz had already CANCELED them as
// duplicates, each showing a Resume RTS button on a dead order.
//
// Vercel Hobby kills the request at 10s and each order costs one Daraz call, so
// a pass is capped and reports `remaining`. The UI calls again until it hits 0.

const SHIP_STAGE = ["pending", "packed", "ready_to_ship"];
const CANCELLED = ["canceled", "cancelled"];

const CREATE_BATCH = 5;
const REFRESH_BATCH = 7;
const STALE_MINUTES = 5;

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
  const params: Record<string, string> = {
    access_token: accessToken,
    app_key: appKey,
    sign_method: "sha256",
    timestamp: Date.now().toString(),
    ...extra,
  };
  const sign = signRequest(apiPath, params, appSecret);
  const query =
    Object.keys(params)
      .sort()
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join("&") + `&sign=${sign}`;
  const res = await fetch(`https://api.daraz.com.np/rest${apiPath}?${query}`, { method: "GET" });
  return await res.json();
}

// ---- POST: flag / unflag items as suspicious ----
// Suspicious is a HUMAN decision. The system only ever suggests candidates
// (see isDuplicate below) - it never hides an order on its own, because an
// auto-hidden real order is an order that silently never ships.
export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body?.orderItemIds) ? body.orderItemIds : [];
    const suspicious = !!body?.suspicious;
    const reason = typeof body?.reason === "string" ? body.reason : null;

    if (ids.length === 0) {
      return NextResponse.json({ error: "orderItemIds required" }, { status: 400 });
    }

    let updated = 0;
    for (const id of ids) {
      try {
        await prisma.darazOrderItem.update({
          where: { orderItemId: String(id) },
          data: suspicious
            ? { suspicious: true, suspiciousReason: reason, suspiciousAt: new Date() }
            : { suspicious: false, suspiciousReason: null, suspiciousAt: null },
        });
        updated++;
      } catch (e) {
        /* item not in this tenant, or gone - skip */
      }
    }
    return NextResponse.json({ ok: true, updated, suspicious });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const doSync = req.nextUrl.searchParams.get("sync") === "1";
    let synced = 0;
    let remaining = 0;
    let syncError: string | null = null;

    if (doSync) {
      try {
        const appKey = (process.env.DARAZ_APP_KEY || "").trim();
        const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

        const stores = await prisma.darazStore.findMany({
          where: { isActive: true, accessToken: { not: null } },
          select: { id: true, accessToken: true },
        });

        const orders = await prisma.darazOrder.findMany({
          where: { status: { in: SHIP_STAGE } },
          orderBy: { orderDate: "desc" },
          take: 150,
          select: { darazOrderId: true, storeId: true },
        });

        const have = await prisma.darazOrderItem.findMany({
          where: { darazOrderId: { in: orders.map((o) => o.darazOrderId) } },
          select: { darazOrderId: true },
        });
        const haveSet = new Set(have.map((h) => h.darazOrderId));
        const missing = orders.filter((o) => !haveSet.has(o.darazOrderId));
        const createBatch = missing.slice(0, CREATE_BATCH);

        // stalest first, and "packed" before anything else - it is the rarest
        // state and the most likely to be a lie.
        const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
        const packedFirst = await prisma.darazOrderItem.findMany({
          where: { status: "packed", updatedAt: { lt: cutoff } },
          orderBy: { updatedAt: "asc" },
          select: { darazOrderId: true, storeId: true },
        });
        const theRest = await prisma.darazOrderItem.findMany({
          where: { status: { in: ["pending", "ready_to_ship"] }, updatedAt: { lt: cutoff } },
          orderBy: { updatedAt: "asc" },
          select: { darazOrderId: true, storeId: true },
        });
        const staleItems = [...packedFirst, ...theRest];

        const staleOrderIds: string[] = [];
        for (const s of staleItems) {
          if (!staleOrderIds.includes(s.darazOrderId)) staleOrderIds.push(s.darazOrderId);
        }
        const refreshBatch = staleOrderIds.slice(0, REFRESH_BATCH).map((id) => ({
          darazOrderId: id,
          storeId: staleItems.find((s) => s.darazOrderId === id)?.storeId ?? null,
        }));

        remaining =
          Math.max(0, missing.length - createBatch.length) +
          Math.max(0, staleOrderIds.length - refreshBatch.length);

        for (const ord of [...createBatch, ...refreshBatch]) {
          const primary = ord.storeId ? stores.find((s) => s.id === ord.storeId) : null;
          const tryStores = primary ? [primary, ...stores.filter((s) => s.id !== primary.id)] : stores;

          for (const store of tryStores) {
            if (!store.accessToken) continue;
            const resp = await callDaraz(
              "/order/items/get",
              { order_id: ord.darazOrderId },
              store.accessToken,
              appKey,
              appSecret
            );
            const items = Array.isArray(resp?.data) ? resp.data : [];
            if (resp?.code !== "0" || items.length === 0) continue;

            for (const it of items) {
              if (!it?.order_item_id) continue;
              const data = {
                darazOrderId: ord.darazOrderId,
                itemName: it.name || null,
                sku: it.sku || null,
                status: it.status || null,
                price: it.paid_price != null ? parseFloat(it.paid_price) : null,
                storeId: store.id,
                trackingNo: it.tracking_code || null,
                shipmentProvider: it.shipment_provider || null,
              };
              await prisma.darazOrderItem.upsert({
                where: { orderItemId: String(it.order_item_id) },
                update: data,
                create: { orderItemId: String(it.order_item_id), ...data },
              });
              synced++;
            }
            break;
          }
        }
      } catch (e) {
        syncError = String(e).substring(0, 160);
      }
    }

    const SELECT = {
      orderItemId: true,
      darazOrderId: true,
      itemName: true,
      sku: true,
      status: true,
      price: true,
      storeId: true,
      trackingNo: true,
      printedAt: true,
      printCount: true,
      suspicious: true,
      suspiciousReason: true,
      createdAt: true,
      updatedAt: true,
    };

    const live = await prisma.darazOrderItem.findMany({
      where: { status: { in: SHIP_STAGE } },
      select: SELECT,
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    // Cancelled: kept OUT of every processing tab and given its own, so staff can
    // see what died without it polluting the work list. Recent ones only.
    const cancelled = await prisma.darazOrderItem.findMany({
      where: { status: { in: CANCELLED } },
      select: SELECT,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const all = [...live, ...cancelled];
    const orderIds = Array.from(new Set(all.map((i) => i.darazOrderId)));
    const orders = await prisma.darazOrder.findMany({
      where: { darazOrderId: { in: orderIds } },
      select: { darazOrderId: true, customerName: true, customerPhone: true, orderDate: true },
    });
    const byOrder = new Map(orders.map((o) => [o.darazOrderId, o]));

    // DUPLICATE DETECTION (suggestion only, never acted on automatically).
    // Same customer phone + same SKU appearing more than once in the ship stage.
    // This is precisely the pattern Daraz itself cancels as "Duplicated order".
    const dupKey = (phone: string, sku: string) => `${phone}::${sku}`;
    const dupCounts = new Map<string, number>();
    for (const i of live) {
      const phone = byOrder.get(i.darazOrderId)?.customerPhone || "";
      const sku = i.sku || i.itemName || "";
      if (!phone || !sku) continue;
      const k = dupKey(phone, sku);
      dupCounts.set(k, (dupCounts.get(k) || 0) + 1);
    }

    const shape = (i: any, isCancelled: boolean) => {
      const o = byOrder.get(i.darazOrderId);
      const phone = o?.customerPhone || "";
      const sku = i.sku || i.itemName || "";
      const dup = !isCancelled && phone && sku ? dupCounts.get(dupKey(phone, sku)) || 1 : 1;
      return {
        orderItemId: i.orderItemId,
        darazOrderId: i.darazOrderId,
        itemName: i.itemName || "-",
        sku: i.sku || "",
        status: i.status || "",
        price: i.price ?? 0,
        storeId: i.storeId,
        trackingNo: i.trackingNo || "",
        printCount: i.printCount ?? 0,
        printedAt: i.printedAt ? i.printedAt.toISOString() : null,
        suspicious: !!i.suspicious,
        suspiciousReason: i.suspiciousReason || "",
        isCancelled,
        isDuplicate: dup > 1,
        duplicateCount: dup,
        customerName: o?.customerName || "-",
        customerPhone: phone,
        orderDate: o?.orderDate ? o.orderDate.toISOString() : null,
      };
    };

    const rows = [...live.map((i) => shape(i, false)), ...cancelled.map((i) => shape(i, true))];

    const active = rows.filter((r) => !r.isCancelled && !r.suspicious);
    return NextResponse.json({
      rows,
      count: rows.length,
      counts: {
        toship: active.filter((r) => r.status === "pending" || r.status === "packed").length,
        notprinted: active.filter((r) => r.status === "ready_to_ship" && r.printCount === 0).length,
        printed: active.filter((r) => r.printCount > 0).length,
        suspicious: rows.filter((r) => r.suspicious && !r.isCancelled).length,
        cancelled: rows.filter((r) => r.isCancelled).length,
        duplicates: active.filter((r) => r.isDuplicate).length,
      },
      sync: doSync ? { synced, remaining, error: syncError } : null,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
