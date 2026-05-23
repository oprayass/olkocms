import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: params.id },
      include: { plan: true, payments: { orderBy: { createdAt: 'desc' } } }
    })
    return NextResponse.json(sub)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const sub = await prisma.subscription.update({
      where: { id: params.id },
      data: body,
      include: { plan: true }
    })
    return NextResponse.json(sub)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.subscription.update({
      where: { id: params.id },
      data: { status: 'Cancelled' }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}