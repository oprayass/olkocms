export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function sign(apiPath: string, params: Record<string, string>, secret: string): string {
  const keys = Object.keys(params).sort();
  let c = "";
  for (const k of keys) c += k + params[k];
  return crypto.createHmac("sha256", secret).update(apiPath + c, "utf8").digest("hex").toUpperCase();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const field = searchParams.get("field") || "ReverseOrderLineCreatedTimeRange";
    const startMs = searchParams.get("start") || String(new Date("2025-01-01").getTime());
    const endMs = searchParams.get("end") || String(new Date("2025-03-01").getTime());

    const appKey = (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (process.env.DARAZ_APP_SECRET || "").trim();
    const store = await prisma.darazStore.findFirst({ where: { isActive: true, accessToken: { not: null }, storeName: "yagyapremiums@gmail.com" } });
    if (!store) return NextResponse.json({ error: "store not found" });

    const apiPath = "/reverse/getreverseordersforseller";
    const params: Record<string, string> = {
      access_token: store.accessToken!, app_key: appKey, sign_method: "sha256",
      timestamp: Date.now().toString(), page_size: "50", page_no: "1",
      [field + "Start"]: startMs, [field + "End"]: endMs,
    };
    const s = sign(apiPath, params, appSecret);
    const keys = Object.keys(params).sort();
    const q = keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join("&") + `&sign=${s}`;
    const data = await (await fetch(`https://api.daraz.com.np/rest${apiPath}?${q}`, { method: "POST" })).json();

    return NextResponse.json({
      field, startMs, endMs,
      code: data?.code, message: data?.message,
      total: data?.result?.total, scanned: data?.result?.items?.length,
      sample: data?.result?.items?.slice(0, 2),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error).substring(0, 300) }, { status: 500 });
  }
}