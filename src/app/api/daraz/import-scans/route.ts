import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const importType = formData.get("type") as string; // "outbound" | "inbound" | "claim"

    if (!file || !importType) {
      return NextResponse.json({ error: "file and type required" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });

    let created = 0;
    let skipped = 0;
    let notFound = 0;

    for (const row of rows) {
      // Order number — different column names
      const orderNum = String(
        row["Order Number"] ?? row["Order number "] ?? row["Order Number "] ?? ""
      ).trim().replace(/\.0$/, "");

      if (!orderNum || orderNum === "null") { skipped++; continue; }

      // DarazOrder मा match खोज्ने
      const darazOrder = await prisma.darazOrder.findFirst({
        where: { darazOrderId: orderNum },
      });

      const timestamp = row["Timestamp"] as Date | null;
      const scanDate = timestamp ? new Date(timestamp) : new Date();

      if (importType === "outbound") {
        // Duplicate check
        const exists = await prisma.darazScan.findFirst({
          where: { darazOrderId: orderNum, scanType: "outbound" },
        });
        if (exists) { skipped++; continue; }

        await prisma.darazScan.create({
          data: {
            scanType: "outbound",
            darazOrderId: orderNum,
            trackingNo: darazOrder?.trackingNo ?? null,
            productName: darazOrder?.product ?? null,
            itemName: darazOrder?.product ?? null,
            storeId: darazOrder?.storeId ?? null,
            scannedBy: "excel-import",
            createdAt: scanDate,
          },
        });
        created++;

      } else if (importType === "inbound") {
        const exists = await prisma.darazScan.findFirst({
          where: { darazOrderId: orderNum, scanType: "inbound" },
        });
        if (exists) { skipped++; continue; }

        const productName = String(row["Product Name "] ?? row["Product Name"] ?? "").trim();
        const storeName = String(row["Store Name"] ?? row["Store Name "] ?? "").trim();
        const price = parseFloat(String(row["Product Price *"] ?? row["product price "] ?? "0")) || null;
        const qty = parseInt(String(row["Quantity "] ?? row["Product Quantity"] ?? "1")) || 1;

        await prisma.darazScan.create({
          data: {
            scanType: "inbound",
            darazOrderId: orderNum,
            trackingNo: darazOrder?.trackingNo ?? null,
            productName: productName || darazOrder?.product || null,
            itemName: productName || darazOrder?.product || null,
            price: price,
            quantity: qty,
            storeId: darazOrder?.storeId ?? storeName ?? null,
            scannedBy: String(row["Checked By"] ?? "excel-import").trim(),
            createdAt: scanDate,
          },
        });
        created++;

      } else if (importType === "claim") {
        const exists = await prisma.darazClaim.findFirst({
          where: { darazOrderId: orderNum },
        });
        if (exists) { skipped++; continue; }

        const productName = String(row["Product Name "] ?? row["Product Name"] ?? "").trim();
        const storeName = String(row["Store Name "] ?? row["Store Name"] ?? "").trim();
        const price = parseFloat(String(row["product price "] ?? "0")) || null;
        const qty = parseInt(String(row["Product Quantity"] ?? "1")) || 1;
        const qcReason = String(row["Daraz QC Reason"] ?? "").trim() || null;
        const customerReason = String(row["Customer return Reason "] ?? "").trim() || null;
        const claimDateRaw = row["Claim Raised  Date "] as Date | null;
        const returnDateRaw = row["Return Recived Date"] as Date | null;

        await prisma.darazClaim.create({
          data: {
            trackingNo: darazOrder?.trackingNo ?? orderNum,
            darazOrderId: orderNum,
            itemName: productName || darazOrder?.product || null,
            price: price,
            quantity: qty,
            storeId: darazOrder?.storeId ?? storeName ?? null,
            qcComment: qcReason,
            customerComment: customerReason,
            claimDate: claimDateRaw ? new Date(claimDateRaw) : null,
            orderDate: returnDateRaw ? new Date(returnDateRaw) : null,
            claimDecision: "undecided",
            scannedBy: "excel-import",
          },
        });
        created++;
        if (!darazOrder) notFound++;
      }

      if (!darazOrder) notFound++;
    }

    return NextResponse.json({ created, skipped, notFound, total: rows.length });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}