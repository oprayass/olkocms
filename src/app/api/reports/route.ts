import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [orders, messages, shipments] = await Promise.all([
      prisma.order.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.message.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.shipment.findMany({ orderBy: { createdAt: 'desc' } }),
    ])

    const totalRevenue = orders.reduce((sum, o) => sum + o.price, 0)
    const totalOrders = orders.length
    const delivered = orders.filter(o => o.status === 'Delivered').length
    const pending = orders.filter(o => o.status === 'Pending').length
    const cancelled = orders.filter(o => o.status === 'Cancelled').length
    const deliveryRate = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
    const totalMessages = messages.length
    const repliedMessages = messages.filter(m => m.replied).length
    const aiReplied = messages.filter(m => m.aiReplied).length

    const platformStats = orders.reduce((acc: Record<string, number>, o) => {
      const platform = o.platform || 'Unknown'
      acc[platform] = (acc[platform] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      totalRevenue,
      totalOrders,
      delivered,
      pending,
      cancelled,
      deliveryRate,
      avgOrderValue,
      totalMessages,
      repliedMessages,
      aiReplied,
      platformStats,
      orders,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}