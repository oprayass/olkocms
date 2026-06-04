import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const dynamic = "force-dynamic";

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

// Incremental DarazOrder write: new -> create, changed -> update, same -> skip.
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
  const existing = await prisma.darazOrder.findUnique({ where: { darazOrderId: o.darazOrderId } });
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
  if (o.orderDate && o.orderDate.getTime() !== (existing.orderDate ? existing.orderDate.getTime() : 0))
    changes.orderDate = o.orderDate;
  if (Object.keys(changes).length === 0) return "skipped";
  await prisma.darazOrder.update({ where: { darazOrderId: o.darazOrderId }, data: changes });
  return "updated";
}

// Fetch items+tracking for one order, trying its store first then all stores.
async function fetchItemsForOrder(
  orderId: string,
  primaryStoreId: string | null,
  stores: { id: string; accessToken: string | null }[],
  appKey: string,
  appSecret: string
): Promise<{ items: any[]; matchedStore: string | null }> {
  const primary = primaryStoreId ? stores.find((s) => s.id === primaryStoreId) : null;
  const tryStores = primary ? [primary, ...stores.filter((s) => s.id !== primary.id)] : stores;
  for (const store of tryStores) {
    if (!store.accessToken) continue;
    const data = await callDaraz("/order/items/get", { order_id: orderId }, store.accessToken, appKey, appSecret);
    const d = data?.data;
    if (data?.code === "0" && Array.isArray(d) && d.length > 0) {
      return { items: d, matchedStore: store.id };
    }
  }
  return { items: [], matchedStore: null };
}

const TRACKABLE = ["ready_to_ship", "packed", "shipped", "pending"];
const FAILED_STATUSES = ["shipped_back", "failed_delivery", "returned", "shipped_back_success"];
const DELIVERED_OR_DONE = [
  "delivered", "shipped", "transit_to_ship", "shipped_back", "returned", "canceled", "cancelled",
];

async function matchTracking(trackingNo: string) {
  const byReturn = await prisma.darazOrderItem.findFirst({
    where: { returnTrackingNo: trackingNo, whqcDecision: "return_to_merchant" },
  });
  if (byReturn) return { item: byReturn, matchType: "return_to_merchant" };
  const byOutbound = await prisma.darazOrderItem.findFirst({
    where: { trackingNo, status: { in: ["shipped_back", "failed_delivery", "returned"] } },
  });
  if (byOutbound) return { item: byOutbound, matchType: "failed_delivery" };
  return null;
}

// Counts an alert as existing in ANY status (incl. resolved/lost) so a resolved
// alert is NOT re-created on the next run. (resolve must stick.)
async function alertExists(alertType: string, alertKey: string) {
  const existing = await prisma.darazAlert.findFirst({
    where: { alertType, notes: { contains: alertKey } },
  });
  return !!existing;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const report: Record<string, unknown> = { startedAt: new Date().toISOString() };

  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    // ---- Step 1: targeted forward fetch (recent 7-day window) -> incremental DarazOrder ----
    let ordersCreated = 0;
    let ordersUpdated = 0;
    let ordersSkipped = 0;
    const createdAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    for (const store of stores) {
      try {
        const resp = await callDaraz(
          "/orders/get",
          { created_after: createdAfter, limit: "100", offset: "0", sort_by: "created_at", sort_direction: "DESC" },
          store.accessToken!,
          appKey,
          appSecret
        );
        const orders = resp?.data?.orders || [];
        for (const o of orders) {
          const action = await upsertDarazOrder({
            darazOrderId: String(o.order_id),
            customerName: `${o.address_billing?.first_name || ""} ${o.address_billing?.last_name || ""}`.trim() || "N/A",
            product: o.items_count ? `${o.items_count} item(s)` : "Daraz Order",
            quantity: o.items_count || 1,
            price: parseFloat(o.price) || 0,
            status: o.statuses?.[0] || o.status || "unknown",
            storeId: store.id,
            orderDate: o.created_at ? new Date(o.created_at) : null,
          });
          if (action === "created") ordersCreated++;
          else if (action === "updated") ordersUpdated++;
          else ordersSkipped++;
        }
      } catch { /* skip store */ }
    }
    report.step1_fetch = { ordersCreated, ordersUpdated, ordersSkipped };

    // ---- Step 1b: fill tracking for ship-stage orders (DarazOrderItem.trackingNo) ----
    // Tracking lives only in DarazOrderItem and Daraz removes it after delivery,
    // so capture it now for shipped/ready_to_ship orders.
    let trackingItemsSaved = 0;
    const trackable = await prisma.darazOrder.findMany({
      where: { status: { in: TRACKABLE } },
      orderBy: { orderDate: "desc" },
      take: 120,
      select: { darazOrderId: true, storeId: true },
    });
    for (const ord of trackable) {
      try {
        const { items, matchedStore } = await fetchItemsForOrder(
          ord.darazOrderId, ord.storeId, stores, appKey, appSecret
        );
        for (const it of items) {
          if (!it.order_item_id) continue;
          await prisma.darazOrderItem.upsert({
            where: { orderItemId: String(it.order_item_id) },
            update: {
              darazOrderId: ord.darazOrderId,
              itemName: it.name || null,
              sku: it.sku || null,
              status: it.status || null,
              price: it.paid_price != null ? parseFloat(it.paid_price) : null,
              storeId: matchedStore,
              trackingNo: it.tracking_code || null,
              shipmentProvider: it.shipment_provider || null,
              cancelReturnInitiator: it.cancel_return_initiator || null,
            },
            create: {
              orderItemId: String(it.order_item_id),
              darazOrderId: ord.darazOrderId,
              itemName: it.name || null,
              sku: it.sku || null,
              status: it.status || null,
              price: it.paid_price != null ? parseFloat(it.paid_price) : null,
              storeId: matchedStore,
              trackingNo: it.tracking_code || null,
              shipmentProvider: it.shipment_provider || null,
              cancelReturnInitiator: it.cancel_return_initiator || null,
            },
          });
          trackingItemsSaved++;
        }
      } catch { /* skip order */ }
    }
    report.step1b_fillTracking = { trackingItemsSaved, ordersChecked: trackable.length };

    // ---- Step 2: refresh-status (update_after last 7 days) -> status changes auto-download ----
    let statusChanged = 0;
    const updateAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    for (const store of stores) {
      try {
        const resp = await callDaraz(
          "/orders/get",
          { update_after: updateAfter, limit: "100", offset: "0", sort_by: "updated_at", sort_direction: "DESC" },
          store.accessToken!,
          appKey,
          appSecret
        );
        const orders = resp?.data?.orders || [];
        for (const o of orders) {
          const orderId = String(o.order_id);
          const newStatus = o.statuses?.[0] || o.status || "unknown";
          const existing = await prisma.darazOrder.findUnique({ where: { darazOrderId: orderId } });
          if (existing && existing.status !== newStatus) {
            await prisma.darazOrder.update({ where: { darazOrderId: orderId }, data: { status: newStatus } });
            statusChanged++;
          }
        }
      } catch { /* skip store */ }
    }
    report.step2_refreshStatus = { statusChanged };

    // ---- Step 3: resolve-scans (INBOUND MATCH RULE) ----
    let matched = 0;
    let stillUnmatched = 0;
    const unresolvedScans = await prisma.darazScan.findMany({
      where: {
        deleted: false,
        trackingNo: { not: null },
        scanType: { in: ["inbound", "return", "failed"] },
        OR: [{ darazOrderId: null }, { wrongStore: true }],
      },
    });
    for (const scan of unresolvedScans) {
      const found = await matchTracking(scan.trackingNo as string);
      if (!found) { stillUnmatched++; continue; }
      const item = found.item;
      let customerName: string | null = null;
      if (item.darazOrderId) {
        const ord = await prisma.darazOrder.findUnique({
          where: { darazOrderId: item.darazOrderId },
          select: { customerName: true },
        });
        customerName = ord?.customerName ?? null;
      }
      const data: Record<string, unknown> = { wrongStore: false };
      if (item.darazOrderId) data.darazOrderId = item.darazOrderId;
      if (item.itemName) { data.itemName = item.itemName; data.productName = item.itemName; }
      if (item.price != null) data.price = item.price;
      if (item.storeId) data.storeId = item.storeId;
      if (customerName) data.customerName = customerName;
      await prisma.darazScan.update({ where: { id: scan.id }, data });
      matched++;
    }
    report.step3_resolveScans = { matched, stillUnmatched };

    // ---- Step 4: reconcile -> derive alerts ----
    let alertsCreated = 0;
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const CUTOFF = new Date("2026-05-01T00:00:00+05:45"); // only alert on outbound scanned on/after 1 May 2026


    // 4a: clear stale outbound alerts now delivered/done.
    // Only touch still-open alerts; NEVER delete resolved/lost (keeps resolve sticky).
    const stale = await prisma.darazAlert.findMany({
      where: {
        alertType: "outbound_not_delivered",
        status: { in: ["unresolved", "investigating"] },
      },
      select: { id: true, darazOrderId: true },
    });
    for (const a of stale) {
      if (!a.darazOrderId || a.darazOrderId === "unknown") {
        await prisma.darazAlert.delete({ where: { id: a.id } });
        continue;
      }
      const ord = await prisma.darazOrder.findFirst({
        where: { darazOrderId: a.darazOrderId },
        select: { status: true },
      });
      if (ord && DELIVERED_OR_DONE.includes((ord.status ?? "").toLowerCase())) {
        await prisma.darazAlert.delete({ where: { id: a.id } });
      }
    }

    // 4b: outbound_not_delivered (match DarazOrderItem first - tracking lives there)
    const outboundScans = await prisma.darazScan.findMany({
      where: {
        deleted: false,
        scanType: "outbound",
        createdAt: { gte: CUTOFF },
        OR: [{ trackingNo: { not: null } }, { darazOrderId: { not: null } }],
      },
    });
    for (const scan of outboundScans) {
      let item = null;
      if (scan.trackingNo) {
        item = await prisma.darazOrderItem.findFirst({
          where: { trackingNo: scan.trackingNo },
          select: { darazOrderId: true, status: true },
        });
      }
      if (!item && scan.darazOrderId) {
        item = await prisma.darazOrderItem.findFirst({
          where: { darazOrderId: scan.darazOrderId },
          select: { darazOrderId: true, status: true },
        });
      }
      const resolvedOrderId = item?.darazOrderId ?? scan.darazOrderId ?? null;
      let status = (item?.status ?? "").toLowerCase();
      if (!status && resolvedOrderId) {
        const order = await prisma.darazOrder.findFirst({
          where: { darazOrderId: resolvedOrderId },
          select: { status: true },
        });
        status = (order?.status ?? "").toLowerCase();
      }
      const hasMatch = !!item || !!resolvedOrderId;
      if (hasMatch && status && DELIVERED_OR_DONE.includes(status)) continue;
      const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
      if (await alertExists("outbound_not_delivered", alertKey)) continue;
      const isLost = scan.createdAt < twoMonthsAgo;
      await prisma.darazAlert.create({
        data: {
          darazOrderId: resolvedOrderId ?? "unknown",
          productName: scan.itemName ?? scan.productName ?? "Unknown Item",
          alertType: "outbound_not_delivered",
          status: isLost ? "lost" : "unresolved",
          notes: `Tracking: ${scan.trackingNo ?? "none"} | Order: ${resolvedOrderId ?? "unknown"} - outbound scanned but no delivery progress in central DB. Status: ${status || "not found"}. Scanned by: ${scan.scannedBy ?? "unknown"} on ${scan.createdAt.toLocaleDateString()}`,
        },
      });
      alertsCreated++;
    }

    // 4c: return_not_received (customer return + failed delivery, no inbound scan)
    const expectedReturns = await prisma.darazOrderItem.findMany({
      where: {
        OR: [
          { whqcDecision: "return_to_merchant", returnTrackingNo: { not: null } },
          { status: { in: FAILED_STATUSES }, trackingNo: { not: null } },
        ],
      },
    });
    for (const item of expectedReturns) {
      const isMerchantReturn = item.whqcDecision === "return_to_merchant" && !!item.returnTrackingNo;
      const inboundTracking = isMerchantReturn ? item.returnTrackingNo : item.trackingNo;
      if (!inboundTracking) continue;
      const inbound = await prisma.darazScan.findFirst({
        where: {
          deleted: false,
          scanType: "inbound",
          OR: [
            { trackingNo: inboundTracking },
            item.darazOrderId ? { darazOrderId: item.darazOrderId } : {},
          ].filter((o) => Object.keys(o).length > 0),
        },
      });
      if (inbound) continue;
      if (await alertExists("return_not_received", inboundTracking)) continue;
      const kind = isMerchantReturn ? "customer return" : "failed delivery";
      await prisma.darazAlert.create({
        data: {
          darazOrderId: item.darazOrderId ?? "unknown",
          productName: item.itemName ?? "Unknown Item",
          alertType: "return_not_received",
          status: "unresolved",
          notes: `Tracking: ${inboundTracking} | Order: ${item.darazOrderId ?? "unknown"} - central DB shows ${kind} (status ${item.status ?? item.whqcDecision ?? "?"}) but no inbound scan. Store: ${item.storeId ?? "unknown"}`,
        },
      });
      alertsCreated++;
    }

    // 4d: wrong_store (inbound scans resolve could not match)
    const wrongStoreScans = await prisma.darazScan.findMany({
      where: { deleted: false, scanType: "inbound", wrongStore: true },
    });
    for (const scan of wrongStoreScans) {
      const alertKey = scan.trackingNo ?? scan.darazOrderId ?? scan.id;
      if (await alertExists("wrong_store", alertKey)) continue;
      await prisma.darazAlert.create({
        data: {
          darazOrderId: scan.darazOrderId ?? "unknown",
          productName: scan.itemName ?? scan.productName ?? "Unknown Item",
          alertType: "wrong_store",
          status: "unresolved",
          notes: `Tracking: ${scan.trackingNo ?? "none"} | Order: ${scan.darazOrderId ?? "unknown"} - inbound scanned but tracking not found in central DB (wrong/unknown store). Scanned by: ${scan.scannedBy ?? "unknown"}`,
        },
      });
      alertsCreated++;
    }
    report.step4_reconcile = { alertsCreated };

    report.success = true;
    report.durationMs = Date.now() - startedAt;
    return NextResponse.json(report);
  } catch (err) {
    report.success = false;
    report.error = String(err).substring(0, 200);
    report.durationMs = Date.now() - startedAt;
    return NextResponse.json(report, { status: 500 });
  }
}