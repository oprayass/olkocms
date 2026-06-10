import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { withTenant } from '@/lib/with-tenant'

export const PATCH = withTenant(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json()
    const content = await prisma.content.update({
      where: { id: params.id },
      data: body,
    })
    return NextResponse.json(content)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
})

export const DELETE = withTenant(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    await prisma.content.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
})