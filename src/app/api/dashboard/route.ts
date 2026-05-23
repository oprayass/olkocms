import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalOrders,
      todayOrders,
      pendingOrders,
      totalMessages,
      newMessages,
      totalFollowups,
      overdueFollowups,
      todayFollowups,
      todayDelivered,
      todayCancelledAtDoor,
      todayExchange,
      adCampaigns,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: 'Pending' } }),
      prisma.message.count(),
      prisma.message.count({ where: { status: 'new' } }),
      prisma.followup.count(),
      prisma.followup.count({ where: { status: 'Overdue' } }),
      prisma.followup.count({ where: { followupDate: today.toISOString().split('T')[0] } }),
      prisma.order.count({ where: { status: 'Delivered', createdAt: { gte: today } } }),
      prisma.order.count({ where: { isCancelledAtDoor: true, createdAt: { gte: today } } }),
      prisma.order.count({ where: { isExchange: true, createdAt: { gte: today } } }),
      prisma.adCampaign.findMany({
        where: { status: 'Active' },
        include: {
          orders: true,
          expenses: { where: { createdAt: { gte: today } } }
        }
      }),
    ])

    const revenueToday = await prisma.order.aggregate({
      where: { createdAt: { gte: today }, status: 'Delivered' },
      _sum: { price: true }
    })

    // Ad stats
    const todayAdSpent = adCampaigns.reduce((a, c) => {
      return a + c.expenses.reduce((b: number, e: any) => b + e.amount, 0)
    }, 0)

    const campaignStats = adCampaigns.map(c => {
      const totalRevenue = c.orders.reduce((a: number, o: any) => a + o.revenue, 0)
      const totalSpent = c.expenses.reduce((a: number, e: any) => a + e.amount, 0)
      const roas = totalSpent > 0 ? totalRevenue / totalSpent : 0
      return { id: c.id, name: c.name, roas, totalRevenue, totalSpent }
    })

    campaignStats.sort((a, b) => b.roas - a.roas)
    const bestAd = campaignStats[0] || null
    const worstAd = campaignStats[campaignStats.length - 1] || null

    return NextResponse.json({
      totalOrders,
      todayOrders,
      pendingOrders,
      totalMessages,
      newMessages,
      totalFollowups,
      overdueFollowups,
      todayFollowups,
      revenueToday: revenueToday._sum.price || 0,
      todayDelivered,
      todayCancelledAtDoor,
      todayExchange,
      todayAdSpent,
      bestAd,
      worstAd,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}