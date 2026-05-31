import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET() {
  const email = "admin@olkocms.com";
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true, email: true, role: true } });
  const staff = await prisma.staff.findFirst({ where: { email }, select: { id: true, email: true, role: true } });
  return NextResponse.json({ inUserTable: user, inStaffTable: staff });
}