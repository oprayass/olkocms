import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { withTenant } from "@/lib/with-tenant"

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const { senderId, pageId, staffName } = await req.json()
    await prisma.aIConversation.updateMany({
      where: { senderId, pageId },
      data: { resolved: true }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
})