import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { resolveStoreCuid } from "@/lib/storeMap";

export const dynamic = "force-dynamic";

function safeFloat(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

function safeInt(val: unknown, def = 1): number {
  if (val === null || val === undefined || val === "") return def;
  const n = parseInt(String(val));
  return isNaN(n) ? def : n;
}

function safeStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s === "" || s === "null" ? null : s;
}

function safeDate(val: unknown): Date | null {
  if (!val) return null;
  try {
    const d = new Date(val as string);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const importType = formData.get("type") as string;

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
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const orderNum = safeStr(
          row["Order Number"] ?? row["Order number "] ?? row["Order Number "]
        )?.replace(/\.0$/, "");

        if (!orderNum) { skipped++; continue; }

        const darazOrder = await prisma.darazOrder.findFirst({
          where: { darazOrderId: orderNum },
        });
        if (!darazOrder) notFound++;

        const scanDate = safeDate(row["Timestamp"]) ?? new Date();

        if (importType === "outbound") {
          const exists = await prisma.darazScan.findFirst({
            where: { darazOrderId: orderNum, scanType: "outbound" },
          });
          if (exists) { skipped++; continue; }

          await prisma.darazScan.create({
            data: {
              scanType: "outbound",
              darazOrderId: orderNum,
              trackingNo: darazOrder?.trackingNo ?? null,
              itemName: darazOrder?.product ?? null,
              storeId: darazOrder?.storeId ?? null,
              scannedBy: "excel-import",
            },
          });
          created++;

        } else if (importType === "inbound") {
          const exists = await prisma.darazScan.findFirst({
            where: { darazOrderId: orderNum, scanType: "inbound" },
          });
          if (exists) { skipped++; continue; }

          await prisma.darazScan.create({
            data: {
              scanType: "inbound",
              darazOrderId: orderNum,
              trackingNo: darazOrder?.trackingNo ?? null,
              itemName: safeStr(row["Product Name "] ?? row["Product Name"]) ?? darazOrder?.product ?? null,
              price: safeFloat(row["Product Price *"] ?? row["product price "]),
              quantity: safeInt(row["Quantity "] ?? row["Product Quantity"]),
              storeId: darazOrder?.storeId ?? resolveStoreCuid(safeStr(row["Store Name"] ?? row["Store Name "])) ?? safeStr(row["Store Name"] ?? row["Store Name "]),
              scannedBy: safeStr(row["Checked By"]) ?? "excel-import",
            },
          });
          created++;

        } else if (importType === "claim") {
          const exists = await prisma.darazClaim.findFirst({
            where: { darazOrderId: orderNum },
          });
          if (exists) { skipped++; continue; }

          await prisma.darazClaim.create({
            data: {
              trackingNo: darazOrder?.trackingNo ?? orderNum,
              darazOrderId: orderNum,
              itemName: safeStr(row["Product Name "] ?? row["Product Name"]) ?? darazOrder?.product ?? null,
              price: safeFloat(row["product price "]),
              quantity: safeInt(row["Product Quantity"]),
              storeId: darazOrder?.storeId ?? resolveStoreCuid(safeStr(row["Store Name "] ?? row["Store Name"])) ?? safeStr(row["Store Name "] ?? row["Store Name"]),
              qcComment: safeStr(row["Daraz QC Reason"]),
              customerComment: safeStr(row["Customer return Reason "]),
              claimDate: safeDate(row["Claim Raised  Date "]),
              orderDate: safeDate(row["Return Recived Date"]),
              claimDecision: "undecided",
              scannedBy: "excel-import",
            },
          });
          created++;
        }
      } catch (rowErr) {
        errors.push(String(rowErr).substring(0, 100));
        if (errors.length >= 3) break;
      }
    }

    return NextResponse.json({ created, skipped, notFound, total: rows.length, errors });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 200) }, { status: 500 });
  }
}