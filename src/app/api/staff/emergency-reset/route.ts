import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

// Emergency password reset — secret key required
// Usage: POST { secret, email, newPassword }
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

    const staff = await prisma.staff.findUnique({ where: { email } });
    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.staff.update({ where: { id: staff.id }, data: { password: hash } });

    return NextResponse.json({ success: true, message: `Password reset for ${email}` });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}