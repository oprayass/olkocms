import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const order = await prisma.order.findUnique({ where: { id: params.id } })
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const order = await prisma.order.update({
      where: { id: params.id },
      data: body
    })
    await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'order_confirm',
        description: `Order #${order.orderId} को status "${body.status}" मा update भयो`,
        entityType: 'order',
        entityId: params.id,
        performedBy: 'staff',
        staffName: 'Staff',
        isAI: false,
      })
    })
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.order.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}