import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.staff.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const staff = await prisma.staff.update({
      where: { id: params.id },
      data: body
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}