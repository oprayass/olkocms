import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await prisma.user.findFirst({
    where: { email: "admin@olkocms.com" },
    select: { email: true, passwordChangedAt: true, password: true },
  });
  return NextResponse.json({
    email: user?.email,
    passwordChangedAt: user?.passwordChangedAt,
    passwordIsHashed: user?.password ? /^\$2[aby]\$/.test(user.password) : null,
  });
}