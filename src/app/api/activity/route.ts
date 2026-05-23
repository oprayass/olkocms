import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return NextResponse.json(logs)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, description, entityType, entityId, performedBy, staffName, isAI, metadata } = body
    const log = await prisma.activityLog.create({
      data: {
        action,
        description,
        entityType: entityType || null,
        entityId: entityId || null,
        performedBy: performedBy || 'system',
        staffName: staffName || null,
        isAI: isAI || false,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    })
    return NextResponse.json(log)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 })
  }
}