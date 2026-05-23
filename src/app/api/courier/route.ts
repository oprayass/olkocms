import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const shipments = await prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(shipments)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch shipments' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const shipment = await prisma.shipment.create({ data: body })
    return NextResponse.json(shipment)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create shipment' }, { status: 500 })
  }
}