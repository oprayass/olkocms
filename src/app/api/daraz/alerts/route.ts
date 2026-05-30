import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STORE_NAMES: Record<string, string> = {
  yagyapremiums: "Yagya Premiums",
  budgetdealsnepal: "Budget Deal",
  blackdragonnepal: "Black Dragon",
  dealmeonsnepal: "Deal Me",
  firstdrop79: "New Idea",
  gadgetfinder2020: "Raibaar Infotel",
  gadgetsfindernepal: "Batuk Mart",
  selfcarenepa: "Premium Lifestyle",
  tb200247: "Best Gadget Nepal",
};

export async function GET() {
  try {
    const alerts = await prisma.darazAlert.findMany({
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(
      alerts.map(async (alert) => {
        let order = null;
        if (alert.darazOrderId && alert.darazOrderId !== "unknown") {
          order = await prisma.darazOrder.findFirst({
            where: { darazOrderId: alert.darazOrderId },
            select: {
              darazOrderId: true,
              product: true,
              customerName: true,
              price: true,
              quantity: true,
              status: true,
              trackingNo: true,
              storeId: true,
              orderDate: true,
            },
          });
        }
        return {
          ...alert,
          orderDetails: order
            ? {
                ...order,
                storeName: STORE_NAMES[order.storeId ?? ""] ?? order.storeId ?? "Unknown Store",
              }
            : null,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const alert = await prisma.darazAlert.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "resolved" ? new Date() : null,
      },
    });
    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const deleted = await prisma.darazAlert.deleteMany({});
    return NextResponse.json({ deleted: deleted.count });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}