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
      recentOrders,
      recentMessages,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: 'Pending' } }),
      prisma.message.count(),
      prisma.message.count({ where: { status: 'new' } }),
      prisma.followup.count(),
      prisma.followup.count({ where: { status: 'Overdue' } }),
      prisma.followup.count({ where: { followupDate: today.toISOString().split('T')[0] } }),
      prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.message.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ])

    const revenueToday = await prisma.order.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { price: true }
    })

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
      recentOrders,
      recentMessages,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}