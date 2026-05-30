import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // reconciliation-fetched orders (customerName "—") exclude गर्ने
    // ती Orders page मा होइन, reconcile को लागि मात्र हुन्
    const orders = await prisma.darazOrder.findMany({
      where: { NOT: { customerName: "—" } },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(orders)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const order = await prisma.darazOrder.create({ data })
    return NextResponse.json(order)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}