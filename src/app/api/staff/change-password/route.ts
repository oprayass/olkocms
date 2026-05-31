import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

function isHashed(pw: string): boolean {
  return /^\$2[aby]\$/.test(pw);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new password both required" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    // Staff मा खोज्ने, नभए User
    const staff = await prisma.staff.findUnique({ where: { email } });
    const account = staff || await prisma.user.findFirst({ where: { email } });
    if (!account || !account.password) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    const isStaff = !!staff;

    let ok = false;
    if (isHashed(account.password)) {
      ok = await bcrypt.compare(currentPassword, account.password);
    } else {
      ok = account.password === currentPassword;
    }
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    if (isStaff) {
      await prisma.staff.update({ where: { id: account.id }, data: { password: newHash } });
    } else {
      await prisma.user.update({ where: { id: account.id }, data: { password: newHash } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}