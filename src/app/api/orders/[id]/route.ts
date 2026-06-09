import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: params.id } })
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
})

export const PATCH = withTenant(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json()
    const order = await prisma.order.update({
      where: { id: params.id },
      data: body
    })
    // internal fetch removed; write the activity log directly (scoped).
    // a logging failure must not break the order update.
    try {
      await prisma.activityLog.create({
        data: {
          action: 'order_confirm',
          description: `Order #${order.orderId} status updated to "${body.status}"`,
          entityType: 'order',
          entityId: params.id,
          performedBy: 'staff',
          staffName: 'Staff',
          isAI: false,
        }
      })
    } catch (logErr) {
      console.error('activity log failed', logErr)
    }
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
})

export const DELETE = withTenant(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    await prisma.order.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
})