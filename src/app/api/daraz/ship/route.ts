export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DARAZ RTS WRITE FLOW  (pack -> rts -> printable label)
//
// CONTRACT (read off the official Daraz API Explorer, not guessed):
//
//   POST /order/pack
//     delivery_type      REQUIRED   only "dropship" is supported
//     order_item_ids     REQUIRED   "[1530553,1830236]"  (brackets, comma sep)
//     shipping_provider  "optional" but the doc says MANDATORY for dropship
//     -> data.order_items[]: order_item_id, package_id, tracking_number,
//                            shipment_provider, purchase_order_id/number
//
//   POST /order/rts
//     delivery_type      REQUIRED   "dropship"
//     order_item_ids     REQUIRED
//     shipment_provider  optional
//     tracking_number    optional, but MANDATORY for drop-shipping
//     -> data.order_items[]
//
//   TRAP: pack spells it shiPPing_provider, rts spells it shiPMent_provider.
//   Same concept, different key. Getting it wrong fails the call.
//
//   Order of operations: pack -> take tracking_number from the pack response ->
//   rts -> the order enters ready_to_ship -> the shipping label becomes
//   printable via /order/document/get (see ../shipping-label).
//
// SAFETY: these are the first WRITE calls in the codebase. They touch live
// customer orders on real stores. Therefore:
//   - every write mode DRY-RUNS by default and just echoes the exact payload
//   - a write only fires with an explicit &confirm=PACK / &confirm=RTS
//   - pack refuses unless the item is live-status "pending"
//   - rts refuses unless the item is live-status "packed"
//   - one order at a time. No bulk. No loops over stores.
//
// Modes:
//   ?mode=providers&orderItemId=   valid shipping_provider values (READ-ONLY)
//   ?mode=signtest&orderItemId=    POST signing check using order_item_ids=[0]
//                                  (item 0 does not exist -> cannot pack)
//   ?mode=pack&orderItemId=&provider=NAME[&confirm=PACK]
//   ?mode=rts&orderItemId=[&confirm=RTS]
//   ?mode=status&orderItemId=      live status / package_id / tracking (READ-ONLY)

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

const BASE = "https://api.daraz.com.np/rest";

async function callDarazGet(
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
  const res = await fetch(`${BASE}${apiPath}?${query}`, { method: "GET" });
  return await res.json();
}

// POST: same HMAC over ALL params, but the params travel in a
// x-www-form-urlencoded body (this is what the official IOP SDK does).
async function callDarazPost(
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
  const body = new URLSearchParams({ ...params, sign });
  const res = await fetch(`${BASE}${apiPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return await res.json();
}

async function resolveItemAndStore(orderItemId: string) {
  const item = await prisma.darazOrderItem.findUnique({
    where: { orderItemId },
    select: { storeId: true, darazOrderId: true, status: true },
  });
  if (!item || !item.storeId) return { error: "Order item not found / no storeId", status: 404 } as const;
  const store = await prisma.darazStore.findFirst({ where: { id: item.storeId, isActive: true } });
  if (!store || !store.accessToken) return { error: "Store not found or no token", status: 404 } as const;
  return { item, store } as const;
}

export const GET = withTenant(async (req: NextRequest) => {
  try {
    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const mode = req.nextUrl.searchParams.get("mode") || "";
    const orderItemId = req.nextUrl.searchParams.get("orderItemId") || "";

    if (!orderItemId) {
      return NextResponse.json(
        { error: "orderItemId required. Modes: providers | signtest | status | pack | rts" },
        { status: 400 }
      );
    }

    const r = await resolveItemAndStore(orderItemId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const { item, store } = r;
    const token = store.accessToken as string;

    // live truth about this item (DB status can be stale)
    const readLive = async () => {
      const resp = await callDarazGet(
        "/order/items/get",
        { order_id: item.darazOrderId },
        token,
        appKey,
        appSecret
      );
      const items = Array.isArray(resp?.data) ? resp.data : [];
      const t = items.find((it: any) => String(it?.order_item_id) === String(orderItemId));
      return {
        apiCode: resp?.code ?? null,
        liveStatus: t?.status ?? null,
        packageId: t?.package_id ?? null,
        trackingCode: t?.tracking_code ?? null,
        shipmentProvider: t?.shipment_provider ?? null,
        shippingType: t?.shipping_type ?? null,
        deliveryOptionSof: t?.delivery_option_sof ?? null,
        isDigital: t?.is_digital ?? null,
        raw: t ?? null,
      };
    };

    // ---- READ-ONLY: what shipping_provider values are actually valid? ----
    if (mode === "providers") {
      const resp = await callDarazGet("/shipment/providers/get", {}, token, appKey, appSecret);
      return NextResponse.json({
        mode: "providers",
        store: store.storeName,
        apiCode: resp?.code ?? null,
        apiMessage: resp?.message ?? null,
        data: resp?.data ?? null,
      });
    }

    // ---- READ-ONLY: live state of this item ----
    if (mode === "status") {
      const live = await readLive();
      return NextResponse.json({
        mode: "status",
        orderItemId,
        darazOrderId: item.darazOrderId,
        store: store.storeName,
        dbStatus: item.status,
        ...live,
      });
    }

    // ---- SAFE: does our POST signing work at all? ----
    // order_item_ids=[0] cannot match a real item, so nothing can be packed.
    // If we get a BUSINESS error back (not InvalidSignature / IncompleteSignature),
    // the signature is correct and POST is wired up properly.
    if (mode === "signtest") {
      const provider = req.nextUrl.searchParams.get("provider") || "";
      const payload: Record<string, string> = {
        delivery_type: "dropship",
        order_item_ids: "[0]",
      };
      if (provider) payload.shipping_provider = provider;

      const resp = await callDarazPost("/order/pack", payload, token, appKey, appSecret);
      const code = String(resp?.code ?? "");
      const signatureBroken = /sign|Signature/i.test(String(resp?.message || "")) || code === "IncompleteSignature";
      return NextResponse.json({
        mode: "signtest",
        store: store.storeName,
        sentTo: "POST /order/pack",
        sentPayload: payload,
        apiCode: resp?.code ?? null,
        apiType: resp?.type ?? null,
        apiMessage: resp?.message ?? null,
        verdict: signatureBroken
          ? "SIGNING IS BROKEN - fix before any real write"
          : "signing OK (error is business-level, as expected for item 0)",
        raw: resp ?? null,
      });
    }

    // ---- WRITE: pack ----
    if (mode === "pack") {
      const provider = req.nextUrl.searchParams.get("provider") || "";
      const confirm = req.nextUrl.searchParams.get("confirm") || "";
      const live = await readLive();

      if (!provider) {
        return NextResponse.json(
          { error: "provider required. Run ?mode=providers first and pass &provider=<exact value>" },
          { status: 400 }
        );
      }
      if (live.liveStatus !== "pending") {
        return NextResponse.json(
          {
            error: "Refusing to pack: this item is not live-status 'pending'.",
            liveStatus: live.liveStatus,
            dbStatus: item.status,
          },
          { status: 409 }
        );
      }

      const payload: Record<string, string> = {
        delivery_type: "dropship",
        order_item_ids: `[${Number(orderItemId)}]`,
        shipping_provider: provider,
      };

      if (confirm !== "PACK") {
        return NextResponse.json({
          mode: "pack",
          dryRun: true,
          note: "Nothing was sent. Re-run with &confirm=PACK to actually pack this order item.",
          store: store.storeName,
          orderItemId,
          darazOrderId: item.darazOrderId,
          liveStatus: live.liveStatus,
          wouldSend: { method: "POST", path: "/order/pack", payload },
        });
      }

      const resp = await callDarazPost("/order/pack", payload, token, appKey, appSecret);
      const packed = resp?.data?.order_items?.[0] ?? null;
      return NextResponse.json({
        mode: "pack",
        dryRun: false,
        sentPayload: payload,
        apiCode: resp?.code ?? null,
        apiMessage: resp?.message ?? null,
        ok: resp?.code === "0",
        packageId: packed?.package_id ?? null,
        trackingNumber: packed?.tracking_number ?? null,
        shipmentProvider: packed?.shipment_provider ?? null,
        nextStep:
          resp?.code === "0"
            ? `?mode=rts&orderItemId=${orderItemId}&confirm=RTS`
            : "pack failed - do not proceed to rts",
        raw: resp ?? null,
      });
    }

    // ---- WRITE: rts ----
    if (mode === "rts") {
      const confirm = req.nextUrl.searchParams.get("confirm") || "";
      const live = await readLive();

      if (live.liveStatus !== "packed") {
        return NextResponse.json(
          {
            error: "Refusing to RTS: this item is not live-status 'packed'. Pack it first.",
            liveStatus: live.liveStatus,
            dbStatus: item.status,
          },
          { status: 409 }
        );
      }

      // tracking_number is mandatory for drop-shipping. It comes from pack.
      const tracking =
        req.nextUrl.searchParams.get("tracking") || String(live.trackingCode || "");
      if (!tracking) {
        return NextResponse.json(
          {
            error:
              "No tracking number available. It should have come back from pack. Pass &tracking=<value> explicitly if you have it.",
            live,
          },
          { status: 409 }
        );
      }

      const payload: Record<string, string> = {
        delivery_type: "dropship",
        order_item_ids: `[${Number(orderItemId)}]`,
        tracking_number: tracking,
      };
      const shipProv = req.nextUrl.searchParams.get("provider") || "";
      if (shipProv) payload.shipment_provider = shipProv; // NB: shipMENT here, not shipPING

      if (confirm !== "RTS") {
        return NextResponse.json({
          mode: "rts",
          dryRun: true,
          note: "Nothing was sent. Re-run with &confirm=RTS to actually mark this ready to ship.",
          store: store.storeName,
          orderItemId,
          liveStatus: live.liveStatus,
          wouldSend: { method: "POST", path: "/order/rts", payload },
        });
      }

      const resp = await callDarazPost("/order/rts", payload, token, appKey, appSecret);
      return NextResponse.json({
        mode: "rts",
        dryRun: false,
        sentPayload: payload,
        apiCode: resp?.code ?? null,
        apiMessage: resp?.message ?? null,
        ok: resp?.code === "0",
        nextStep:
          resp?.code === "0"
            ? `/api/daraz/shipping-label?mode=compose&orderItemId=${orderItemId}`
            : "rts failed - label will not be printable",
        raw: resp ?? null,
      });
    }

    return NextResponse.json(
      { error: "Unknown mode. Use: providers | status | signtest | pack | rts" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
});
