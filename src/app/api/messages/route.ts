import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async () => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(messages)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
})

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const message = await prisma.message.create({ data: body })
    return NextResponse.json(message)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
  }
})