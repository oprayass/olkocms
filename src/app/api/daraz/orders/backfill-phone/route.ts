export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withExplicitTenant } from "@/lib/with-tenant";
import crypto from "crypto";

// TEMP BACKFILL ENDPOINT — phone capture for orders beyond the 100/fetch cap.
// Fetches ONE page (offset-based) from /orders/get and writes only the phone
// fields. Never touches lastOrderFetch, status, tracking, or any other column.
// Main-admin gated, tenant-scoped. DELETE after backfill is complete.

function normalizePhone(raw: string | null | undefined): { normalized: string | null; raw: string | null } {
  if (!raw) return { normalized: null, raw: null };
  const cleanedRaw = String(raw).trim();
  if (!cleanedRaw) return { normalized: null, raw: null };
  let digits = cleanedRaw.replace(/[^0-9]/g, "");
  if (digits.length === 13 && digits.startsWith("977")) digits = digits.slice(3);
  if (digits.length === 11 && digits.startsWith("977")) digits = digits.slice(3);
  const normalized = digits.length === 10 ? digits : null;
  return { normalized, raw: cleanedRaw };
}

function signRequest(apiPath: string, params: Record<string, string>, appSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  let concat = "";
  for (const k of sortedKeys) concat += k + params[k];
  return crypto.createHmac("sha256", appSecret).update(apiPath + concat, "utf8").digest("hex").toUpperCase();
}

function extractPhone(o: any): string | null {
  return (
    o.address_shipping?.phone ||
    o.address_shipping?.phone2 ||
    o.address_billing?.phone ||
    o.address_billing?.phone2 ||
    null
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sessionSubId = ((session.user as any)?.subscriptionId as string | null) ?? null;
    if (!sessionSubId) return NextResponse.json({ error: "No subscription bound" }, { status: 403 });

    const storeId = req.nextUrl.searchParams.get("store");
    const offset = req.nextUrl.searchParams.get("offset") || "0";
    if (!storeId) return NextResponse.json({ error: "store param required" }, { status: 400 });

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();

    return await withExplicitTenant(sessionSubId, async () => {
      const store = await prisma.darazStore.findFirst({
        where: { id: storeId, isActive: true },
      });
      if (!store || !store.accessToken) {
        return NextResponse.json({ error: "Store not found or no token" }, { status: 404 });
      }

      const apiPath = "/orders/get";
      const params: Record<string, string> = {
        access_token: store.accessToken,
        app_key: appKey,
        created_after: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        limit: "100",
        offset: String(offset),
        sign_method: "sha256",
        sort_by: "created_at",
        sort_direction: "DESC",
        timestamp: Date.now().toString(),
      };
      const sign = signRequest(apiPath, params, appSecret);
      const sortedKeys = Object.keys(params).sort();
      const query =
        sortedKeys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${sign}`;
      const url = `https://api.daraz.com.np/rest${apiPath}?${query}`;

      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      const orders = data?.data?.orders || [];

      let updated = 0;
      let skipped = 0;
      let noPhone = 0;

      for (const o of orders) {
        const darazOrderId = String(o.order_id);
        const rawPhone = extractPhone(o);
        const { normalized, raw } = normalizePhone(rawPhone);
        if (!normalized && !raw) {
          noPhone += 1;
          continue;
        }
        const existing = await prisma.darazOrder.findUnique({
          where: { darazOrderId },
          select: { customerPhone: true, customerPhoneRaw: true },
        });
        if (!existing) {
          skipped += 1; // order not in our DB (outside our other fetches) — skip
          continue;
        }
        const changes: Record<string, string> = {};
        if (normalized && normalized !== existing.customerPhone) changes.customerPhone = normalized;
        if (raw && raw !== existing.customerPhoneRaw) changes.customerPhoneRaw = raw;
        if (Object.keys(changes).length === 0) {
          skipped += 1;
          continue;
        }
        await prisma.darazOrder.update({ where: { darazOrderId }, data: changes });
        updated += 1;
      }

      return NextResponse.json({
        success: true,
        store: store.storeName,
        offset: Number(offset),
        fetched: orders.length,
        updated,
        skipped,
        noPhone,
        apiCode: data?.code,
      });
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
}
