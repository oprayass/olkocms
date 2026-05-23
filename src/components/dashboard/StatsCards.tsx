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

  const mainStats = [
    { label: 'Orders Today', value: data ? data.todayOrders : '...', icon: '📦', color: 'from-violet-600 to-violet-800', href: '/dashboard/orders' },
    { label: 'Pending Orders', value: data ? data.pendingOrders : '...', icon: '⏳', color: 'from-amber-500 to-amber-700', href: '/dashboard/orders?status=Pending' },
    { label: 'Messages', value: data ? data.newMessages : '...', icon: '💬', color: 'from-blue-500 to-blue-700', href: '/dashboard/messages' },
    { label: 'Revenue Today', value: data ? 'Rs ' + data.revenueToday.toLocaleString() : '...', icon: '💰', color: 'from-emerald-500 to-emerald-700', href: '/dashboard/reports' },
    { label: 'Follow-ups Today', value: data ? data.todayFollowups : '...', icon: '🔔', color: 'from-pink-500 to-pink-700', href: '/dashboard/followups?filter=Today' },
    { label: 'Overdue Follow-ups', value: data ? data.overdueFollowups : '...', icon: '⚠️', color: 'from-red-500 to-red-700', href: '/dashboard/followups?filter=Overdue' },
  ]

  const todayStats = [
    { label: 'Delivered Today', value: data ? data.todayDelivered : '...', icon: '✅', color: 'from-teal-500 to-teal-700', href: '/dashboard/orders' },
    { label: 'Cancelled at Door', value: data ? data.todayCancelledAtDoor : '...', icon: '🚪', color: 'from-red-600 to-red-800', href: '/dashboard/orders' },
    { label: 'Exchange Orders', value: data ? data.todayExchange : '...', icon: '🔄', color: 'from-orange-500 to-orange-700', href: '/dashboard/orders' },
    { label: "Today's Ad Spent", value: data ? 'Rs ' + (data.todayAdSpent || 0).toLocaleString() : '...', icon: '📢', color: 'from-indigo-500 to-indigo-700', href: '/dashboard/reports' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {mainStats.map((stat) => (
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {todayStats.map((stat) => (
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

      {data && (data.bestAd || data.worstAd) && (
        <div className="grid grid-cols-2 gap-4">
          {data.bestAd && (
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏆</span>
                <span className="text-emerald-400 text-xs font-medium">Best Performing Ad</span>
              </div>
              <p className="text-white font-semibold truncate">{data.bestAd.name}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-emerald-400 text-sm">ROAS: {data.bestAd.roas.toFixed(2)}x</span>
                <span className="text-gray-400 text-xs">Rs {data.bestAd.totalRevenue.toLocaleString()} revenue</span>
              </div>
            </div>
          )}
          {data.worstAd && data.bestAd?.id !== data.worstAd?.id && (
            <div className="bg-gradient-to-br from-red-500/20 to-red-700/20 border border-red-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📉</span>
                <span className="text-red-400 text-xs font-medium">Least Performing Ad</span>
              </div>
              <p className="text-white font-semibold truncate">{data.worstAd.name}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-red-400 text-sm">ROAS: {data.worstAd.roas.toFixed(2)}x</span>
                <span className="text-gray-400 text-xs">Rs {data.worstAd.totalSpent.toLocaleString()} spent</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}