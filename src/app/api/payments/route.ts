import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { subscriptionId, amount, method, reference, billingCycle } = body

    const periodStart = new Date()
    const periodEnd = new Date()
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    }

    const payment = await prisma.payment.create({
      data: {
        subscriptionId,
        amount,
        method,
        reference: reference || null,
        status: 'Completed',
        paidAt: new Date(),
        periodStart,
        periodEnd,
      }
    })

    // Subscription active garne + period extend garne
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'Active',
        currentPeriodEnd: periodEnd,
      }
    })

    return NextResponse.json(payment)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}