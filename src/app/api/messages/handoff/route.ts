import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { senderId, pageId, staffName } = await req.json()

    await prisma.aIConversation.updateMany({
      where: { senderId, pageId },
      data: { resolved: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}