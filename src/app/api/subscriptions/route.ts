import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const subs = await prisma.subscription.findMany({
      include: { plan: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(subs)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { businessName, email, phone, planId, billingCycle } = body

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const currentPeriodEnd = new Date()
    if (billingCycle === 'yearly') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1)
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)
    }

    const sub = await prisma.subscription.create({
      data: {
        businessName,
        email,
        phone: phone || null,
        planId,
        billingCycle: billingCycle || 'monthly',
        status: 'Trial',
        trialEndsAt,
        currentPeriodEnd,
      },
      include: { plan: true }
    })
    return NextResponse.json(sub)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}