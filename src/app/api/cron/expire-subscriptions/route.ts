import { prismaUnscoped } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Secret gate for Vercel cron / manual trigger. The !CRON_SECRET check
  // closes the "Bearer undefined" hole when the env var is unset.
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // INTENTIONAL cross-tenant operation: this route manages the tenants
  // themselves (Subscription is platform-level, not tenant data), so it
  // uses prismaUnscoped explicitly per the multi-tenant engineering standard.
  try {
    const now = new Date()
    let trialExpired = 0
    let subscriptionExpired = 0

    // Trial -> Expired
    const trialSubs = await prismaUnscoped.subscription.findMany({
      where: { status: 'Trial', trialEndsAt: { lt: now } }
    })
    if (trialSubs.length > 0) {
      await prismaUnscoped.subscription.updateMany({
        where: { status: 'Trial', trialEndsAt: { lt: now } },
        data: { status: 'Expired' }
      })
      trialExpired = trialSubs.length
    }

    // Active -> Expired
    const activeSubs = await prismaUnscoped.subscription.findMany({
      where: { status: 'Active', currentPeriodEnd: { lt: now } }
    })
    if (activeSubs.length > 0) {
      await prismaUnscoped.subscription.updateMany({
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
