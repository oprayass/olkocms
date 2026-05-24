'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const statusStyle: Record<string, string> = {
  Delivered: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Processing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

export default function ReportsPage() {
  const [tab, setTab] = useState('overview')
  const [reportData, setReportData] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [platformFilter, setPlatformFilter] = useState('All')

  useEffect(() => {
    Promise.all([
      fetch('/api/reports').then(r => r.json()),
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/ad-campaigns').then(r => r.json()),
    ]).then(([rep, ord, camp]) => {
      setReportData(rep)
      setOrders(Array.isArray(ord) ? ord : [])
      setCampaigns(Array.isArray(camp) ? camp : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>
  if (!reportData) return <div className="text-center py-20 text-gray-400">Failed to load</div>

  const allOrders: any[] = reportData.orders || []

  // P&L Calculations
  const deliveredOrders = allOrders.filter((o: any) => o.status === 'Delivered')
  const totalRevenue = deliveredOrders.reduce((a: number, o: any) => a + (o.price * o.quantity), 0)
  const totalCost = deliveredOrders.reduce((a: number, o: any) => a + ((o.costPrice || 0) * o.quantity), 0)
  const totalShipping = deliveredOrders.reduce((a: number, o: any) => a + (o.shippingCharge || 0), 0)
  const totalCustShipping = deliveredOrders.reduce((a: number, o: any) => a + (o.customerShippingCharge || 0), 0)
  const totalAdSpent = campaigns.reduce((a: number, c: any) => a + (c.spent || 0), 0)
  const grossProfit = totalRevenue - totalCost
  const netProfit = grossProfit - totalShipping + totalCustShipping - totalAdSpent
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0'

  // Failed & Cancelled
  const failedOrders = allOrders.filter((o: any) => o.isFailedDelivery || o.isCancelledAtDoor)
  const failedCost = failedOrders.reduce((a: number, o: any) => a + (o.shippingCharge || 0), 0)

  // Platform pie
  const platformMap: Record<string, number> = {}
  allOrders.forEach((o: any) => { const p = o.platform || 'Unknown'; platformMap[p] = (platformMap[p] || 0) + 1 })
  const platformColors: Record<string, string> = { FB: '#3b82f6', facebook: '#3b82f6', IG: '#ec4899', WA: '#10b981', Direct: '#f59e0b', Unknown: '#6b7280' }
  const platformData = Object.entries(platformMap).map(([name, value]) => ({ name, value, color: platformColors[name] || '#6b7280' }))

  // Status pie
  const statusColors2: Record<string, string> = { Delivered: '#10b981', Processing: '#3b82f6', Pending: '#f59e0b', Cancelled: '#ef4444' }
  const statusMap: Record<string, number> = {}
  allOrders.forEach((o: any) => { statusMap[o.status] = (statusMap[o.status] || 0) + 1 })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value, color: statusColors2[name] || '#6b7280' }))

  // Weekly chart
  const last7: any[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayOrders = allOrders.filter((o: any) => o.createdAt?.startsWith(dateStr))
    const dayDelivered = dayOrders.filter((o: any) => o.status === 'Delivered')
    last7.push({
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      orders: dayOrders.length,
      revenue: dayDelivered.reduce((a: number, o: any) => a + (o.price * o.quantity), 0),
      profit: dayDelivered.reduce((a: number, o: any) => a + ((o.price - (o.costPrice || 0)) * o.quantity) - (o.shippingCharge || 0) + (o.customerShippingCharge || 0), 0),
      delivered: dayDelivered.length,
      cancelled: dayOrders.filter((o: any) => o.status === 'Cancelled').length,
    })
  }

  // Filtered orders for datewise tab
  const filteredOrders = allOrders
    .filter((o: any) => { const d = o.createdAt?.split('T')[0] || ''; return d >= fromDate && d <= toDate })
    .filter((o: any) => statusFilter === 'All' || o.status === statusFilter)
    .filter((o: any) => platformFilter === 'All' || o.platform === platformFilter)
    .sort((a: any, b: any) => {
      const av = a[sortBy]; const bv = b[sortBy]
      if (sortDir === 'asc') return av > bv ? 1 : -1
      return av < bv ? 1 : -1
    })

  const dateRevenue = filteredOrders.filter((o: any) => o.status === 'Delivered').reduce((a: number, o: any) => a + (o.price * o.quantity), 0)
  const dateCost = filteredOrders.filter((o: any) => o.status === 'Delivered').reduce((a: number, o: any) => a + ((o.costPrice || 0) * o.quantity), 0)
  const dateProfit = filteredOrders.filter((o: any) => o.status === 'Delivered').reduce((a: number, o: any) => a + ((o.price - (o.costPrice || 0)) * o.quantity) - (o.shippingCharge || 0) + (o.customerShippingCharge || 0), 0)

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-gray-400 mt-1">Track your business performance & P&L</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { k: 'overview', l: '📊 Overview' },
          { k: 'pnl', l: '💰 P&L' },
          { k: 'datewise', l: '📅 Date Wise' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={'px-5 py-2 rounded-xl text-sm font-medium transition-all ' + (tab === t.k ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}>
            {t.l}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Total Revenue', value: 'Rs ' + totalRevenue.toLocaleString(), color: 'from-emerald-500 to-emerald-700' },
              { label: 'Total Orders', value: reportData.totalOrders, color: 'from-violet-600 to-violet-800' },
              { label: 'Gross Profit', value: 'Rs ' + grossProfit.toLocaleString(), color: 'from-teal-500 to-teal-700' },
              { label: 'Net Profit', value: 'Rs ' + netProfit.toLocaleString(), color: netProfit >= 0 ? 'from-blue-500 to-blue-700' : 'from-red-600 to-red-800' },
              { label: 'Profit Margin', value: profitMargin + '%', color: 'from-amber-500 to-amber-700' },
              { label: 'Delivery Rate', value: reportData.deliveryRate + '%', color: 'from-pink-500 to-pink-700' },
            ].map(s => (
              <div key={s.label} className={'bg-gradient-to-br ' + s.color + ' rounded-2xl p-4'}>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-white/70 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Revenue & Profit — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={v => 'Rs ' + Math.round(v / 1000) + 'k'} />
                  <Tooltip formatter={(v: number, name: string) => ['Rs ' + v.toLocaleString(), name]} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Orders — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Orders by Platform</h2>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={platformData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
                      {platformData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v + ' orders', 'Count']} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {platformData.map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }}></div>
                      <span className="text-gray-400 text-sm">{p.name}</span>
                      <span className="text-white font-medium ml-auto">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Order Status</h2>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
                      {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v + ' orders', 'Count']} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {statusData.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }}></div>
                      <span className="text-gray-400 text-sm">{s.name}</span>
                      <span className="text-white font-medium ml-auto">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h2 className="text-white font-medium mb-3">Messages Stats</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Messages', value: reportData.totalMessages, color: 'text-blue-400' },
                { label: 'Replied', value: reportData.repliedMessages, color: 'text-emerald-400' },
                { label: 'AI Replied', value: reportData.aiReplied, color: 'text-violet-400' },
              ].map(s => (
                <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className={'text-2xl font-bold ' + s.color}>{s.value}</div>
                  <div className="text-gray-400 text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* P&L TAB */}
      {tab === 'pnl' && (
        <div className="space-y-5">
          {/* P&L Summary */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-white font-semibold mb-5">Profit & Loss Summary</h2>
            <div className="space-y-3">
              {[
                { label: 'Total Revenue (Delivered)', value: totalRevenue, color: 'text-emerald-400', sign: '+' },
                { label: 'Product Cost', value: -totalCost, color: 'text-red-400', sign: '-', display: totalCost },
                { label: 'Courier Shipping Cost', value: -totalShipping, color: 'text-red-400', sign: '-', display: totalShipping },
                { label: 'Customer Shipping Collected', value: totalCustShipping, color: 'text-emerald-400', sign: '+' },
                { label: 'Ad Spent (All Campaigns)', value: -totalAdSpent, color: 'text-red-400', sign: '-', display: totalAdSpent },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-800">
                  <span className="text-gray-400 text-sm">{item.label}</span>
                  <span className={`font-medium ${item.color}`}>
                    {item.sign} Rs {((item.display !== undefined ? item.display : Math.abs(item.value))).toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between py-3 bg-gray-800/50 rounded-xl px-3 mt-2">
                <span className="text-white font-bold">Net Profit</span>
                <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Rs {netProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3">
                <span className="text-gray-400 text-sm">Profit Margin</span>
                <span className={`font-medium ${parseFloat(profitMargin) >= 20 ? 'text-emerald-400' : parseFloat(profitMargin) >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                  {profitMargin}%
                </span>
              </div>
            </div>
          </div>

          {/* Failed Delivery Cost */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h2 className="text-white font-medium mb-4">Failed/Cancelled at Door Analysis</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Failed Delivery', value: allOrders.filter((o: any) => o.isFailedDelivery).length, color: 'text-gray-400' },
                { label: 'Cancelled at Door', value: allOrders.filter((o: any) => o.isCancelledAtDoor).length, color: 'text-red-400' },
                { label: 'Shipping Loss', value: 'Rs ' + failedCost.toLocaleString(), color: 'text-red-400' },
                { label: 'Exchange Orders', value: allOrders.filter((o: any) => o.isExchange).length, color: 'text-blue-400' },
              ].map(s => (
                <div key={s.label} className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign P&L */}
          {campaigns.length > 0 && (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Campaign P&L</h2>
              <div className="space-y-3">
                {campaigns.map(c => {
                  const campOrders = orders.filter((o: any) => o.campaignId === c.id && o.status === 'Delivered')
                  const campRevenue = campOrders.reduce((a: number, o: any) => a + (o.price * o.quantity), 0)
                  const campCost = campOrders.reduce((a: number, o: any) => a + ((o.costPrice || 0) * o.quantity), 0)
                  const campShipping = campOrders.reduce((a: number, o: any) => a + (o.shippingCharge || 0), 0)
                  const campProfit = campRevenue - campCost - campShipping - (c.spent || 0)
                  const roas = c.spent > 0 ? (campRevenue / c.spent).toFixed(2) : '0.00'
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                      <div>
                        <p className="text-white font-medium text-sm">{c.name}</p>
                        <p className="text-gray-400 text-xs">Ad Spent: Rs {(c.spent || 0).toLocaleString()} · ROAS: {roas}x</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm">Rev: Rs {campRevenue.toLocaleString()}</p>
                        <p className={`text-sm font-medium ${campProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Profit: Rs {campProfit.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DATEWISE TAB */}
      {tab === 'datewise' && (
        <div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-5">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <p className="text-gray-400 text-xs mb-1">From Date</p>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">To Date</p>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Status</p>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                  {['All', 'Delivered', 'Processing', 'Pending', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Platform</p>
                <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                  {['All', 'FB', 'IG', 'WA', 'Direct'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Revenue', value: 'Rs ' + dateRevenue.toLocaleString(), color: 'from-emerald-500 to-emerald-700' },
              { label: 'Orders', value: filteredOrders.length, color: 'from-violet-600 to-violet-800' },
              { label: 'Delivered', value: filteredOrders.filter((o: any) => o.status === 'Delivered').length, color: 'from-teal-500 to-teal-700' },
              { label: 'Profit', value: 'Rs ' + dateProfit.toLocaleString(), color: dateProfit >= 0 ? 'from-blue-500 to-blue-700' : 'from-red-500 to-red-700' },
            ].map(s => (
              <div key={s.label} className={'bg-gradient-to-br ' + s.color + ' rounded-2xl p-4'}>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-white/70 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    { k: 'orderId', l: 'Order' },
                    { k: 'customerName', l: 'Customer' },
                    { k: 'product', l: 'Product' },
                    { k: 'price', l: 'Sale' },
                    { k: 'costPrice', l: 'Cost' },
                    { k: 'profit', l: 'Profit' },
                    { k: 'status', l: 'Status' },
                    { k: 'platform', l: 'Platform' },
                    { k: 'createdAt', l: 'Date' },
                  ].map(col => (
                    <th key={col.k} onClick={() => toggleSort(col.k)}
                      className="text-left text-gray-400 font-medium px-4 py-3 cursor-pointer hover:text-white transition-colors select-none">
                      {col.l}{sortIcon(col.k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o: any) => {
                  const profit = ((o.price - (o.costPrice || 0)) * o.quantity) - (o.shippingCharge || 0) + (o.customerShippingCharge || 0)
                  return (
                    <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{o.orderId}</td>
                      <td className="px-4 py-3 text-white">{o.customerName}</td>
                      <td className="px-4 py-3 text-gray-300">{o.product}</td>
                      <td className="px-4 py-3 text-white">Rs {(o.price * o.quantity).toLocaleString()}</td>
                      <td className="px-4 py-3 text-orange-400">Rs {((o.costPrice || 0) * o.quantity).toLocaleString()}</td>
                      <td className={`px-4 py-3 font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Rs {profit.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={'text-xs px-2 py-1 rounded-full ' + (statusStyle[o.status] || '')}>{o.status}</span></td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">{o.platform || '-'}</span></td>
                      <td className="px-4 py-3 text-gray-400">{o.createdAt?.split('T')[0]}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <div className="text-center py-12 text-gray-500">No orders found</div>}
          </div>
          <div className="mt-3 text-sm text-gray-400">
            Showing <span className="text-white font-medium">{filteredOrders.length}</span> orders · Revenue: <span className="text-white font-medium">Rs {dateRevenue.toLocaleString()}</span> · Profit: <span className={dateProfit >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>Rs {dateProfit.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}