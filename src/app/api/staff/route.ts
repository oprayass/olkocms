import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const staff = await prisma.staff.create({ data: body })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}