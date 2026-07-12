export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// DARAZ FULFILMENT WRITE FLOW: providers -> pack -> rts -> printable label
//
// THE REAL CONTRACT (read off Daraz Documentation > Fulfillment API).
// NOTE: these are NOT /order/pack and /order/rts. Those are different, real
// APIs that this app is not scoped for - which is why they returned
// InsufficientPermission. The correct paths are:
//
//   GET|POST /order/shipment/providers/get
//     param: getShipmentProvidersReq = {"orders":[{"order_id":"..."}]}
//     -> result.data.shipment_providers[] { name, provider_code }
//        result.data.shipping_allocate_type  e.g. "TFS"
//
//   POST /order/fulfill/pack
//     param: packReq = {
//       "pack_order_list":[{"order_id":"...","order_item_list":["<itemId>"]}],
//       "delivery_type":"dropship",
//       "shipment_provider_code":"<provider_code>",
//       "shipping_allocate_type":"TFS"
//     }
//     -> result.data.pack_order_list[].order_item_list[] {
//          order_item_id, item_err_code, msg, tracking_number,
//          shipment_provider, package_id, retry }
//
//   POST /order/package/rts
//     param: readyToShipReq = {"packages":[{"package_id":"FP..."}]}
//     -> result.data.packages[] { package_id, item_err_code, msg, retry }
//
// So RTS is keyed on PACKAGE_ID (which pack gives us), not on item ids.
// Responses for these fulfilment APIs nest under result.data - unlike the read
// APIs (/order/items/get) where data is top-level. Parsed defensively below.
//
// Useful error codes: 700021 ORDER_NOT_FOUND, 700025 ORDER_ITEM_NOT_FOUND,
// 700026 FO_ITEM_NOT_ALLOW_TO_PACK, 700001 DBS_SHIPMENT_PROVIDER_CODE_NOT_EXITS,
// 700004 PARAM_ILLEGAL, 700000 PACKAGE_STATUS_NOT_ALLOW_TO_OP.
//
// SAFETY. These are the only write calls in the codebase and they touch live
// customer orders:
//   - packtest sends a FAKE order id. Expected: 700021 ORDER_NOT_FOUND. That
//     proves path + signature + payload shape without touching anything real.
//     If we get PARAM_ILLEGAL instead, our payload shape is wrong - stop.
//   - pack and rts DRY-RUN by default and only fire with &confirm=PACK / =RTS
//   - pack refuses unless the item's LIVE status is "pending"
//   - rts refuses unless the item's LIVE status is "packed" and it has a package_id
//   - one item at a time. No bulk. No loops over stores.
//
// Modes:
//   ?mode=status&orderItemId=          live state (READ-ONLY)
//   ?mode=providers&orderItemId=       valid provider_code list (READ-ONLY)
//   ?mode=packtest&orderItemId=&provider=CODE   fake-order probe (SAFE)
//   ?mode=pack&orderItemId=&provider=CODE[&confirm=PACK]
//   ?mode=rts&orderItemId=[&packageId=FP...][&confirm=RTS]

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

const BASE = "https://api.daraz.com.np/rest";

async function callGet(
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

// POST: HMAC over ALL params (system + business), business params travel in the
// form body. This is what the IOP SDK does (commonParams -> urlQuery,
// bizParams -> body). Our earlier POST reached Daraz's authorisation layer, so
// the signing itself is already proven correct.
async function callPost(
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

// fulfilment APIs nest under result.data; read APIs put data at top level
function unwrap(resp: any) {
  const result = resp?.result ?? null;
  return {
    data: result?.data ?? resp?.data ?? null,
    success: result?.success ?? null,
    errorCode: result?.error_code ?? null,
    errorMsg: result?.error_msg ?? null,
    apiCode: resp?.code ?? null,
    apiMessage: resp?.message ?? null,
    requestId: resp?.request_id ?? null,
  };
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
        { error: "orderItemId required. Modes: status | providers | packtest | pack | rts" },
        { status: 400 }
      );
    }

    const r = await resolveItemAndStore(orderItemId);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    const { item, store } = r;
    const token = store.accessToken as string;

    const readLive = async () => {
      const resp = await callGet("/order/items/get", { order_id: item.darazOrderId }, token, appKey, appSecret);
      const items = Array.isArray(resp?.data) ? resp.data : [];
      const t = items.find((it: any) => String(it?.order_item_id) === String(orderItemId));
      return {
        liveStatus: t?.status ?? null,
        packageId: t?.package_id ?? null,
        trackingCode: t?.tracking_code ?? null,
        shipmentProvider: t?.shipment_provider ?? null,
        shippingType: t?.shipping_type ?? null,
      };
    };

    // ---------- READ-ONLY: live state ----------
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

    // ---------- READ-ONLY: valid provider codes ----------
    // The gateway wants BOTH the nested payload AND order_item_ids:
    //   send order_item_ids alone      -> "getShipmentProvidersReq is mandatory"
    //   send getShipmentProvidersReq   -> "order_item_ids is mandatory"
    // So it is not flat-vs-nested, it is flat AND nested. Same pattern as
    // /order/document/get, which needed doc_type + order_item_ids together.
    // Read-only: this endpoint only lists providers.
    if (mode === "providers") {
      const itemsJson = JSON.stringify([Number(orderItemId)]);
      const reqPayload = JSON.stringify({ orders: [{ order_id: String(item.darazOrderId) }] });

      const variants: Record<string, Record<string, string>> = {
        both_orders_payload: {
          getShipmentProvidersReq: reqPayload,
          order_item_ids: itemsJson,
        },
        both_items_payload: {
          getShipmentProvidersReq: JSON.stringify({
            orders: [
              {
                order_id: String(item.darazOrderId),
                order_item_list: [String(orderItemId)],
              },
            ],
          }),
          order_item_ids: itemsJson,
        },
      };

      const attempts: any[] = [];
      for (const [name, params] of Object.entries(variants)) {
        const viaGet = await callGet("/order/shipment/providers/get", params, token, appKey, appSecret);
        const g = unwrap(viaGet);
        let p: any = null;
        if (g.apiCode !== "0") {
          const viaPost = await callPost("/order/shipment/providers/get", params, token, appKey, appSecret);
          p = unwrap(viaPost);
        }
        const win = g.apiCode === "0" ? g : p;
        attempts.push({
          variant: name,
          sentParams: params,
          getCode: g.apiCode,
          getMessage: g.apiMessage,
          postCode: p?.apiCode ?? null,
          postMessage: p?.apiMessage ?? null,
          ok: win?.apiCode === "0",
          errorCode: win?.errorCode ?? null,
          errorMsg: win?.errorMsg ?? null,
          shipmentProviders: win?.data?.shipment_providers ?? null,
          shippingAllocateType: win?.data?.shipping_allocate_type ?? null,
          data: win?.data ?? null,
        });
      }

      return NextResponse.json({
        mode: "providers",
        store: store.storeName,
        orderItemId,
        darazOrderId: item.darazOrderId,
        attempts,
      });
    }

    // ---------- SAFE: fake-order probe ----------
    // Fake order id -> cannot pack anything. Expected: 700021 ORDER_NOT_FOUND,
    // which would prove path + signature + payload shape are all correct.
    // Sends packReq AND order_item_ids together, because that is what the
    // providers endpoint proved the gateway wants.
    // PARAM_ILLEGAL / MissingParameter instead = our shape is still wrong -> stop.
    if (mode === "packtest") {
      const provider = req.nextUrl.searchParams.get("provider") || "TEST";
      const allocate = req.nextUrl.searchParams.get("allocate") || "TFS";

      const packReq = JSON.stringify({
        pack_order_list: [{ order_id: "1", order_item_list: ["1"] }],
        delivery_type: "dropship",
        shipment_provider_code: provider,
        shipping_allocate_type: allocate,
      });

      const variants: Record<string, Record<string, string>> = {
        packreq_plus_items: { packReq, order_item_ids: "[1]" },
        packreq_only: { packReq },
        flat_only: {
          delivery_type: "dropship",
          order_item_ids: "[1]",
          shipment_provider_code: provider,
          shipping_allocate_type: allocate,
        },
      };

      const attempts: any[] = [];
      for (const [name, params] of Object.entries(variants)) {
        const resp = await callPost("/order/fulfill/pack", params, token, appKey, appSecret);
        const u = unwrap(resp);
        const blob = String(u.apiCode || "") + String(u.apiMessage || "") + String(u.errorCode || "") + String(u.errorMsg || "");
        const verdict = /InsufficientPermission/i.test(blob)
          ? "NO PERMISSION"
          : /700021|order not found/i.test(blob)
          ? "SHAPE CORRECT (fake order rejected as not found)"
          : /MissingParameter/i.test(blob)
          ? "missing a param - read apiMessage"
          : /700004|illegal/i.test(blob)
          ? "param illegal - shape wrong"
          : "unexpected - read raw";
        attempts.push({
          variant: name,
          sentParams: params,
          verdict,
          apiCode: u.apiCode,
          apiMessage: u.apiMessage,
          errorCode: u.errorCode,
          errorMsg: u.errorMsg,
          data: u.data,
        });
      }

      return NextResponse.json({
        mode: "packtest",
        note: "FAKE order id. Nothing real was touched.",
        store: store.storeName,
        attempts,
      });
    }

    // ---------- WRITE: pack ----------
    if (mode === "pack") {
      const provider = req.nextUrl.searchParams.get("provider") || "";
      const allocate = req.nextUrl.searchParams.get("allocate") || "TFS";
      const confirm = req.nextUrl.searchParams.get("confirm") || "";
      if (!provider) {
        return NextResponse.json(
          { error: "provider required. Run ?mode=providers first, then pass &provider=<provider_code>" },
          { status: 400 }
        );
      }

      const live = await readLive();
      if (live.liveStatus !== "pending") {
        return NextResponse.json(
          {
            error: "Refusing to pack: live status is not 'pending'.",
            liveStatus: live.liveStatus,
            dbStatus: item.status,
          },
          { status: 409 }
        );
      }

      const payload = JSON.stringify({
        pack_order_list: [
          { order_id: String(item.darazOrderId), order_item_list: [String(orderItemId)] },
        ],
        delivery_type: "dropship",
        shipment_provider_code: provider,
        shipping_allocate_type: allocate,
      });

      if (confirm !== "PACK") {
        return NextResponse.json({
          mode: "pack",
          dryRun: true,
          note: "Nothing was sent. Re-run with &confirm=PACK to pack this order item for real.",
          store: store.storeName,
          orderItemId,
          darazOrderId: item.darazOrderId,
          liveStatus: live.liveStatus,
          wouldSend: { method: "POST", path: "/order/fulfill/pack", packReq: JSON.parse(payload) },
        });
      }

      const resp = await callPost("/order/fulfill/pack", { packReq: payload }, token, appKey, appSecret);
      const u = unwrap(resp);
      const packedItem = u.data?.pack_order_list?.[0]?.order_item_list?.[0] ?? null;
      const ok = String(packedItem?.item_err_code ?? "") === "0";
      return NextResponse.json({
        mode: "pack",
        dryRun: false,
        sentPayload: JSON.parse(payload),
        ok,
        itemErrCode: packedItem?.item_err_code ?? null,
        itemMsg: packedItem?.msg ?? null,
        packageId: packedItem?.package_id ?? null,
        trackingNumber: packedItem?.tracking_number ?? null,
        shipmentProvider: packedItem?.shipment_provider ?? null,
        ...u,
        nextStep: ok
          ? `?mode=rts&orderItemId=${orderItemId}&packageId=${packedItem?.package_id}&confirm=RTS`
          : "pack failed - do NOT proceed to rts",
        raw: resp,
      });
    }

    // ---------- WRITE: rts (keyed on package_id) ----------
    if (mode === "rts") {
      const confirm = req.nextUrl.searchParams.get("confirm") || "";
      const live = await readLive();
      const packageId = req.nextUrl.searchParams.get("packageId") || String(live.packageId || "");

      if (live.liveStatus !== "packed") {
        return NextResponse.json(
          {
            error: "Refusing to RTS: live status is not 'packed'. Pack it first.",
            liveStatus: live.liveStatus,
            dbStatus: item.status,
          },
          { status: 409 }
        );
      }
      if (!packageId) {
        return NextResponse.json(
          { error: "No package_id. It comes back from pack. Pass &packageId=FP... if you have it.", live },
          { status: 409 }
        );
      }

      const payload = JSON.stringify({ packages: [{ package_id: packageId }] });

      if (confirm !== "RTS") {
        return NextResponse.json({
          mode: "rts",
          dryRun: true,
          note: "Nothing was sent. Re-run with &confirm=RTS to mark ready-to-ship for real.",
          store: store.storeName,
          orderItemId,
          packageId,
          liveStatus: live.liveStatus,
          wouldSend: { method: "POST", path: "/order/package/rts", readyToShipReq: JSON.parse(payload) },
        });
      }

      const resp = await callPost("/order/package/rts", { readyToShipReq: payload }, token, appKey, appSecret);
      const u = unwrap(resp);
      const pkg = u.data?.packages?.[0] ?? null;
      const ok = String(pkg?.item_err_code ?? "") === "0";
      return NextResponse.json({
        mode: "rts",
        dryRun: false,
        sentPayload: JSON.parse(payload),
        ok,
        itemErrCode: pkg?.item_err_code ?? null,
        itemMsg: pkg?.msg ?? null,
        packageId: pkg?.package_id ?? packageId,
        ...u,
        nextStep: ok
          ? `/api/daraz/shipping-label?mode=compose&orderItemId=${orderItemId}`
          : "rts failed - the label will not be printable",
        raw: resp,
      });
    }

    return NextResponse.json(
      { error: "Unknown mode. Use: status | providers | packtest | pack | rts" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
});
