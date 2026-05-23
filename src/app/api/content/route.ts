import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const contents = await prisma.content.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(contents)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const content = await prisma.content.create({ data: body })
    return NextResponse.json(content)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}