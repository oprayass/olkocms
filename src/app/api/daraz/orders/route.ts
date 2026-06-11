import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async () => {
  try {
    // Exclude reconciliation-fetched orders (customerName em-dash);
    // those are for reconcile only, not the Orders page.
    const orders = await prisma.darazOrder.findMany({
      where: { NOT: { customerName: "—" } },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(orders)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
})

export const POST = withTenant(async (req: Request) => {
  try {
    const data = await req.json()
    const order = await prisma.darazOrder.create({ data })
    return NextResponse.json(order)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
})