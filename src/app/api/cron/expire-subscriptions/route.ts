import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Vercel cron वा manual trigger को लागि secret check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    let trialExpired = 0
    let subscriptionExpired = 0

    // Trial → Expired
    const trialSubs = await prisma.subscription.findMany({
      where: { status: 'Trial', trialEndsAt: { lt: now } }
    })
    if (trialSubs.length > 0) {
      await prisma.subscription.updateMany({
        where: { status: 'Trial', trialEndsAt: { lt: now } },
        data: { status: 'Expired' }
      })
      trialExpired = trialSubs.length
    }

    // Active → Expired
    const activeSubs = await prisma.subscription.findMany({
      where: { status: 'Active', currentPeriodEnd: { lt: now } }
    })
    if (activeSubs.length > 0) {
      await prisma.subscription.updateMany({
        where: { status: 'Active', currentPeriodEnd: { lt: now } },
        data: { status: 'Expired' }
      })
      subscriptionExpired = activeSubs.length
    }

    return NextResponse.json({
      success: true,
      trialExpired,
      subscriptionExpired,
      total: trialExpired + subscriptionExpired,
      checkedAt: now.toISOString()
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}