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
      return NextResponse.json({ error: "Current र new password दुवै चाहिन्छ" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password कम्तीमा 6 characters हुनुपर्छ" }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({ where: { email } });
    if (!staff || !staff.password) {
      return NextResponse.json({ error: "Account भेटिएन" }, { status: 404 });
    }

    // current password verify (hashed वा legacy)
    let ok = false;
    if (isHashed(staff.password)) {
      ok = await bcrypt.compare(currentPassword, staff.password);
    } else {
      ok = staff.password === currentPassword;
    }
    if (!ok) {
      return NextResponse.json({ error: "Current password गलत छ" }, { status: 403 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.staff.update({ where: { id: staff.id }, data: { password: newHash } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err).substring(0, 150) }, { status: 500 });
  }
}