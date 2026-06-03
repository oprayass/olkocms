import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Fields this helper manages. orderItemId is the unique key, never "updated".
const FORWARD_FIELDS = [
  "darazOrderId",
  "itemName",
  "sku",
  "status",
  "price",
  "storeId",
  "trackingNo",
  "shipmentProvider",
  "cancelReturnInitiator",
  "deliveredAt",
] as const;

const REVERSE_FIELDS = [
  "returnTrackingNo",
  "reverseOrderId",
  "reverseOrderLineId",
  "ofcStatus",
  "reverseStatus",
  "whqcDecision",
  "returnReason",
  "refundAmount",
  "requestType",
  "shippingType",
] as const;

const MANAGED_FIELDS = [...FORWARD_FIELDS, ...REVERSE_FIELDS] as const;

export type OrderItemInput = {
  orderItemId: string;
} & Partial<Record<(typeof MANAGED_FIELDS)[number], unknown>>;

export type UpsertAction = "created" | "updated" | "skipped";

export type UpsertResult = {
  action: UpsertAction;
  orderItemId: string;
  changed: string[];
};

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    const ta =
      a instanceof Date ? a.getTime() : a == null ? null : new Date(a as string).getTime();
    const tb =
      b instanceof Date ? b.getTime() : b == null ? null : new Date(b as string).getTime();
    return ta === tb;
  }
  return a === b;
}

/**
 * Incremental write rule for the central DarazOrderItem table.
 * - Look up by orderItemId (the @unique key).
 * - Not found  -> create from all provided fields (NEW).
 * - Found      -> only fields that are PROVIDED (not undefined), NON-NULL,
 *                 and DIFFERENT from stored count as a change.
 *                 No change -> skip (no write). Some change -> update only those.
 * Null/undefined incoming values never wipe existing data, so a forward
 * source can never erase reverse fields and vice-versa.
 */
export async function upsertOrderItem(incoming: OrderItemInput): Promise<UpsertResult> {
  const orderItemId = incoming.orderItemId;
  if (!orderItemId) {
    throw new Error("upsertOrderItem: orderItemId is required");
  }

  const existing = await prisma.darazOrderItem.findUnique({
    where: { orderItemId },
  });

  // Only the managed fields the caller actually provided (not undefined, not null).
  const provided: Record<string, unknown> = {};
  for (const field of MANAGED_FIELDS) {
    const v = (incoming as Record<string, unknown>)[field];
    if (v !== undefined && v !== null) {
      provided[field] = v;
    }
  }

  if (!existing) {
    await prisma.darazOrderItem.create({
      data: { orderItemId, ...provided } as Prisma.DarazOrderItemUncheckedCreateInput,
    });
    return { action: "created", orderItemId, changed: Object.keys(provided) };
  }

  const changes: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(provided)) {
    if (!valuesEqual(value, (existing as Record<string, unknown>)[field])) {
      changes[field] = value;
    }
  }

  if (Object.keys(changes).length === 0) {
    return { action: "skipped", orderItemId, changed: [] };
  }

  await prisma.darazOrderItem.update({
    where: { orderItemId },
    data: changes as Prisma.DarazOrderItemUncheckedUpdateInput,
  });
  return { action: "updated", orderItemId, changed: Object.keys(changes) };
}

export type BatchSummary = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  results: UpsertResult[];
};

/**
 * Batch wrapper. Sequential (Neon pooler + Vercel friendly).
 * Returns counts so a route/cron can report new-vs-changed-vs-skipped.
 */
export async function upsertOrderItems(items: OrderItemInput[]): Promise<BatchSummary> {
  const summary: BatchSummary = {
    total: items.length,
    created: 0,
    updated: 0,
    skipped: 0,
    results: [],
  };
  for (const item of items) {
    const r = await upsertOrderItem(item);
    if (r.action === "created") summary.created += 1;
    else if (r.action === "updated") summary.updated += 1;
    else summary.skipped += 1;
    summary.results.push(r);
  }
  return summary;
}