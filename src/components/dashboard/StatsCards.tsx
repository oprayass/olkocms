'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function StatsCards() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
  }, [])

  const stats = [
    {
      label: 'Orders Today',
      value: data ? data.todayOrders : '...',
      icon: '📦',
      color: 'from-violet-600 to-violet-800',
      href: '/dashboard/orders',
    },
    {
      label: 'Pending Orders',
      value: data ? data.pendingOrders : '...',
      icon: '⏳',
      color: 'from-amber-500 to-amber-700',
      href: '/dashboard/orders?status=Pending',
    },
    {
      label: 'Messages',
      value: data ? data.newMessages : '...',
      icon: '💬',
      color: 'from-blue-500 to-blue-700',
      href: '/dashboard/messages',
    },
    {
      label: 'Revenue Today',
      value: data ? `Rs ${data.revenueToday.toLocaleString()}` : '...',
      icon: '💰',
      color: 'from-emerald-500 to-emerald-700',
      href: '/dashboard/reports',
    },
    {
      label: 'Follow-ups Today',
      value: data ? data.todayFollowups : '...',
      icon: '🔔',
      color: 'from-pink-500 to-pink-700',
      href: '/dashboard/followups?filter=Today',
    },
    {
      label: 'Overdue Follow-ups',
      value: data ? data.overdueFollowups : '...',
      icon: '⚠️',
      color: 'from-red-500 to-red-700',
      href: '/dashboard/followups?filter=Overdue',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          onClick={() => router.push(stat.href)}
          className={'bg-gradient-to-br ' + stat.color + ' rounded-2xl p-4 shadow-lg cursor-pointer hover:scale-105 transition-transform'}
        >
          <div className="text-2xl mb-2">{stat.icon}</div>
          <div className="text-xl font-bold text-white">{stat.value}</div>
          <div className="text-xs text-white/70 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}