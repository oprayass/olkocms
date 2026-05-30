import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveStoreName } from "@/lib/storeMap";

export async function GET() {
  try {
    const alerts = await prisma.darazAlert.findMany({
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(
      alerts.map(async (alert) => {
        let orderDetails = null;

        // 1. DarazOrder बाट खोज्ने
        if (alert.darazOrderId && alert.darazOrderId !== "unknown") {
          const order = await prisma.darazOrder.findFirst({
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
          if (order) {
            orderDetails = {
              ...order,
              storeName: resolveStoreName(order.storeId),
            };
          }
        }

        // 2. DarazOrder मा नभेटिए DarazScan बाट खोज्ने
        if (!orderDetails && alert.darazOrderId && alert.darazOrderId !== "unknown") {
          const scan = await prisma.darazScan.findFirst({
            where: { darazOrderId: alert.darazOrderId },
            select: {
              darazOrderId: true,
              itemName: true,
              productName: true,
              price: true,
              quantity: true,
              trackingNo: true,
              storeId: true,
              scannedBy: true,
              createdAt: true,
            },
          });
          if (scan) {
            orderDetails = {
              darazOrderId: scan.darazOrderId ?? alert.darazOrderId,
              product: scan.itemName ?? scan.productName ?? null,
              customerName: null,
              price: scan.price ?? null,
              quantity: scan.quantity ?? 1,
              status: null,
              trackingNo: scan.trackingNo ?? null,
              storeId: scan.storeId ?? null,
              storeName: resolveStoreName(scan.storeId),
              orderDate: scan.createdAt?.toISOString() ?? null,
              fromScan: true,
            };
          }
        }

        return { ...alert, orderDetails };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0,150) }, { status: 500 });
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