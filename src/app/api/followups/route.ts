import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async () => {
  try {
    const followups = await prisma.followup.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(followups)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch followups' }, { status: 500 })
  }
})

export const POST = withTenant(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const followup = await prisma.followup.create({ data: body })
    return NextResponse.json(followup)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create followup' }, { status: 500 })
  }
})