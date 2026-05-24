import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const senderId = searchParams.get("senderId")
  const phone = searchParams.get("phone")

  if (!senderId && !phone) return NextResponse.json({ messages: [], total: 0 })

  try {
    let finalSenderId = senderId
    if (!senderId && phone) {
      const order = await prisma.order.findFirst({ where: { phone }, select: { senderId: true } })
      finalSenderId = order?.senderId || null
    }
    if (!finalSenderId) return NextResponse.json({ messages: [], total: 0 })

    const messages = await prisma.message.findMany({
      where: { senderId: finalSenderId },
      orderBy: { createdAt: "asc" },
      take: 100,
    })
    return NextResponse.json({ messages, total: messages.length })
  } catch (error) {
    console.error("Customer messages error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}