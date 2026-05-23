'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const sc: Record<string, string> = {
  Pending: 'bg-amber-500/20 text-amber-400',
  Delivered: 'bg-emerald-500/20 text-emerald-400',
  Processing: 'bg-blue-500/20 text-blue-400',
  Confirmed: 'bg-violet-500/20 text-violet-400',
  Cancelled: 'bg-red-500/20 text-red-400',
}

export function RecentOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => setOrders(data.slice(0, 5)))
  }, [])

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
        <button
          onClick={() => router.push('/dashboard/orders')}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          View All →
        </button>
      </div>
      {orders.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No orders yet</p>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div
              key={o.id}
              onClick={() => router.push('/dashboard/orders')}
              className="flex items-center justify-between bg-gray-800/50 rounded-xl p-3 cursor-pointer hover:bg-gray-800 transition-all"
            >
              <div>
                <p className="text-white font-medium">{o.customerName}</p>
                <p className="text-gray-400 text-sm">{o.product}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm">Rs {o.price?.toLocaleString()}</p>
                <span className={`${sc[o.status] || 'bg-gray-500/20 text-gray-400'} text-xs px-2 py-1 rounded-full`}>
                  {o.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}