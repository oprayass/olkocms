export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const ORDER_IDS = ["505842544563471","505837968597925","505876845352778","505810341688398","505789557356631","505795514088416","505804865296592","505816259088037","505746385344180","505684929912792","505623990904020","505623991004020","505623991104020","505602520912066","505569912610113","505546158339733","505546158239733","505546158139733","505546158039733","505546157939733","505546157839733","505563883404314","505563883504314","505417325780745","505417325880745","505417325980745","504135909164165","504135909264165","504135909364165","503675424684156","503083613382278","503083613482278","503083613582278","503083613682278","503100369687560","502941027215723","502625899104316"];

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

async function fetchItems(orderId: string, store: any, appKey: string, appSecret: string) {
  const apiPath = "/order/items/get";
  const params: Record<string, string> = {
    access_token: store.accessToken,
    app_key: appKey,
    order_id: orderId,
    sign_method: "sha256",
    timestamp: Date.now().toString(),
  };
  const sign = signRequest(apiPath, params, appSecret);
  const sortedKeys = Object.keys(params).sort();
  const query = sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
  const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;
  const res = await fetch(url, { method: "GET" });
  return await res.json();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const BATCH = 6;
    const slice = ORDER_IDS.slice(offset, offset + BATCH);

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const stores = await prisma.darazStore.findMany({
      where: { isActive: true, accessToken: { not: null } },
    });

    const results: any[] = [];
    for (const orderId of slice) {
      let found: any = null;
      for (const store of stores) {
        const data = await fetchItems(orderId, store, appKey, appSecret);
        const items = data?.data;
        if (data?.code === "0" && Array.isArray(items) && items.length > 0) {
          found = {
            orderId,
            store: store.storeName,
            itemCount: items.length,
            items: items.map((it: any) => {
              const copy = { ...it };
              delete copy.address_billing;
              delete copy.address_shipping;
              return copy;
            }),
          };
          break;
        }
      }
      results.push(found || { orderId, store: null, itemCount: 0, note: "no match in any store" });
    }

    const nextOffset = offset + BATCH < ORDER_IDS.length ? offset + BATCH : null;
    return NextResponse.json({ offset, nextOffset, total: ORDER_IDS.length, processed: slice.length, results });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}