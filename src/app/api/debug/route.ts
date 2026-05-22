import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "admin@olkocms.com" }
    })
    
    const testHash = await bcrypt.hash("password123", 10)
    const match = user?.password ? await bcrypt.compare("password123", user.password) : false
    
    return NextResponse.json({ 
      success: true, 
      hasUser: !!user,
      passwordMatch: match,
      newHash: testHash
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) })
  }
}