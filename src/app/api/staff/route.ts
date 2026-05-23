import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, phone, role, password } = body
    if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    const staff = await prisma.staff.create({
      data: {
        name,
        email,
        phone,
        role: role || 'Sales',
        password: password || null,
        status: 'Active',
        joinDate: new Date().toISOString().split('T')[0]
      }
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}