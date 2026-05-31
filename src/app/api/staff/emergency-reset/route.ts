import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { secret, email, newPassword } = await req.json();

    const RESET_SECRET = process.env.RESET_SECRET || "olko-emergency-reset-2024";
    if (secret !== RESET_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
    }
    if (!email || !newPassword) {
      return NextResponse.json({ error: "email and newPassword required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    // Staff मा खोज्ने, नभए User
    const staff = await prisma.staff.findUnique({ where: { email } });
    if (staff) {
      await prisma.staff.update({ where: { id: staff.id }, data: { password: hash } });
      return NextResponse.json({ success: true, message: `Password reset for staff ${email}` });
    }

    const user = await prisma.user.findFirst({ where: { email } });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
      return NextResponse.json({ success: true, message: `Password reset for user ${email}` });
    }

    return NextResponse.json({ error: "Account not found in staff or user" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}