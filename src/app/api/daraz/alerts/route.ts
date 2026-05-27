import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const alerts = await prisma.darazAlert.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(alerts)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, status, notes } = await req.json()
    const alert = await prisma.darazAlert.update({
      where: { id },
      data: { status, notes, resolvedAt: status === 'resolved' ? new Date() : null }
    })
    return NextResponse.json(alert)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
