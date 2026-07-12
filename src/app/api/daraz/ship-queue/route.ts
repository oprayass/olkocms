export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/with-tenant";

// Item-level feed for the Shipping screen.
// to-ship is keyed on DarazOrder.darazOrderId, but pack / rts / print are all
// keyed on DarazOrderItem.orderItemId - so this returns ITEMS, not orders.
// Neither model uses a Prisma @relation, so the join to DarazOrder is manual.
// Read-only.

const QUEUE_STATUSES = ["pending", "packed", "ready_to_ship"];

export const GET = withTenant(async () => {
  try {
    const items = await prisma.darazOrderItem.findMany({
      where: { status: { in: QUEUE_STATUSES } },
      select: {
        orderItemId: true,
        darazOrderId: true,
        itemName: true,
        sku: true,
        status: true,
        price: true,
        storeId: true,
        trackingNo: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const orderIds = Array.from(new Set(items.map((i) => i.darazOrderId)));
    const orders = await prisma.darazOrder.findMany({
      where: { darazOrderId: { in: orderIds } },
      select: {
        darazOrderId: true,
        customerName: true,
        customerPhone: true,
        orderDate: true,
      },
    });
    const byOrder = new Map(orders.map((o) => [o.darazOrderId, o]));

    const rows = items.map((i) => {
      const o = byOrder.get(i.darazOrderId);
      return {
        orderItemId: i.orderItemId,
        darazOrderId: i.darazOrderId,
        itemName: i.itemName || "-",
        sku: i.sku || "",
        status: i.status || "",
        price: i.price ?? 0,
        storeId: i.storeId,
        trackingNo: i.trackingNo || "",
        customerName: o?.customerName || "-",
        customerPhone: o?.customerPhone || "",
        orderDate: o?.orderDate ? o.orderDate.toISOString() : null,
      };
    });

    const counts = {
      pending: rows.filter((r) => r.status === "pending").length,
      packed: rows.filter((r) => r.status === "packed").length,
      ready_to_ship: rows.filter((r) => r.status === "ready_to_ship").length,
    };

    return NextResponse.json({ rows, count: rows.length, counts });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 200) }, { status: 500 });
  }
});
