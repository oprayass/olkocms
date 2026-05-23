'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const statusStyle: Record<string,string> = {
  Delivered:'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Processing:'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Pending:'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Cancelled:'bg-red-500/20 text-red-400 border border-red-500/30',
}

export default function ReportsPage() {
  const [tab, setTab] = useState('overview')
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [platformFilter, setPlatformFilter] = useState('All')

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(d => { setReportData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>
  if (!reportData) return <div className="text-center py-20 text-gray-400">Failed to load</div>

  const allOrders: any[] = reportData.orders || []

  // Platform pie data
  const platformMap: Record<string, number> = {}
  allOrders.forEach((o: any) => {
    const p = o.platform || 'Unknown'
    platformMap[p] = (platformMap[p] || 0) + 1
  })
  const platformColors: Record<string, string> = { FB:'#3b82f6', facebook:'#3b82f6', IG:'#ec4899', WA:'#10b981', Direct:'#f59e0b', Unknown:'#6b7280' }
  const platformData = Object.entries(platformMap).map(([name, value]) => ({ name, value, color: platformColors[name] || '#6b7280' }))

  // Status pie data
  const statusColors2: Record<string, string> = { Delivered:'#10b981', Processing:'#3b82f6', Pending:'#f59e0b', Cancelled:'#ef4444' }
  const statusMap: Record<string, number> = {}
  allOrders.forEach((o: any) => { statusMap[o.status] = (statusMap[o.status] || 0) + 1 })
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value, color: statusColors2[name] || '#6b7280' }))

  // Weekly chart data (last 7 days)
  const last7: any[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayOrders = allOrders.filter((o: any) => o.createdAt?.startsWith(dateStr))
    last7.push({
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((a: number, o: any) => a + (o.price * o.quantity), 0),
      delivered: dayOrders.filter((o: any) => o.status === 'Delivered').length,
      cancelled: dayOrders.filter((o: any) => o.status === 'Cancelled').length,
    })
  }

  // Datewise filtered orders
  const filteredOrders = allOrders
    .filter((o: any) => {
      const d = o.createdAt?.split('T')[0] || ''
      return d >= fromDate && d <= toDate
    })
    .filter((o: any) => statusFilter === 'All' || o.status === statusFilter)
    .filter((o: any) => platformFilter === 'All' || o.platform === platformFilter)
    .sort((a: any, b: any) => {
      const av = a[sortBy]; const bv = b[sortBy]
      if (sortDir === 'asc') return av > bv ? 1 : -1
      return av < bv ? 1 : -1
    })

  const dateRevenue = filteredOrders.reduce((a: number, o: any) => a + (o.price * o.quantity), 0)

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
          <p className="text-gray-400 mt-1">Track your business performance</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[{k:'overview',l:'📊 Overview'},{k:'datewise',l:'📅 Date Wise'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={'px-5 py-2 rounded-xl text-sm font-medium transition-all '+(tab===t.k?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{t.l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              {label:'Total Revenue', value:'Rs '+reportData.totalRevenue?.toLocaleString(), icon:'💰', color:'from-emerald-500 to-emerald-700'},
              {label:'Total Orders', value:reportData.totalOrders, icon:'📦', color:'from-violet-600 to-violet-800'},
              {label:'Avg Order Value', value:'Rs '+reportData.avgOrderValue?.toLocaleString(), icon:'📊', color:'from-blue-500 to-blue-700'},
              {label:'Delivered', value:reportData.delivered, icon:'✅', color:'from-teal-500 to-teal-700'},
              {label:'Cancelled', value:reportData.cancelled, icon:'❌', color:'from-red-500 to-red-700'},
              {label:'Delivery Rate', value:reportData.deliveryRate+'%', icon:'🚚', color:'from-amber-500 to-amber-700'},
            ].map(s => (
              <div key={s.label} className={'bg-gradient-to-br '+s.color+' rounded-2xl p-4'}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-white/70 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Revenue - Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#6b7280" tick={{fontSize:11}} />
                  <YAxis stroke="#6b7280" tick={{fontSize:11}} tickFormatter={v => 'Rs '+Math.round(v/1000)+'k'} />
                  <Tooltip formatter={(v: number) => ['Rs '+v.toLocaleString(),'Revenue']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{fill:'#8b5cf6'}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Orders vs Delivered - Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={last7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="day" stroke="#6b7280" tick={{fontSize:11}} />
                  <YAxis stroke="#6b7280" tick={{fontSize:11}} />
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Bar dataKey="orders" name="Orders" fill="#8b5cf6" radius={[4,4,0,0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4,4,0,0]} />
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
                      {platformData.map((e,i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v:number) => [v+' orders','Count']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {platformData.map(p => (
                    <div key={p.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{background:p.color}}></div>
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
                      {statusData.map((e,i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v:number) => [v+' orders','Count']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {statusData.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{background:s.color}}></div>
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
                {label:'Total Messages', value:reportData.totalMessages, color:'text-blue-400'},
                {label:'Replied', value:reportData.repliedMessages, color:'text-emerald-400'},
                {label:'AI Replied', value:reportData.aiReplied, color:'text-violet-400'},
              ].map(s => (
                <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className={'text-2xl font-bold '+s.color}>{s.value}</div>
                  <div className="text-gray-400 text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'datewise' && (
        <div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-5">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <p className="text-gray-400 text-xs mb-1">From Date</p>
                <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">To Date</p>
                <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Status</p>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                  {['All','Delivered','Processing','Pending','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Platform</p>
                <select value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                  {['All','FB','IG','WA','Direct'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-4">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-xl font-bold text-white">Rs {dateRevenue.toLocaleString()}</div>
              <div className="text-xs text-white/70">Total Revenue</div>
            </div>
            <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl p-4">
              <div className="text-2xl mb-1">📦</div>
              <div className="text-xl font-bold text-white">{filteredOrders.length}</div>
              <div className="text-xs text-white/70">Total Orders</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-4">
              <div className="text-2xl mb-1">✅</div>
              <div className="text-xl font-bold text-white">{filteredOrders.filter((o:any)=>o.status==='Delivered').length}</div>
              <div className="text-xs text-white/70">Delivered</div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    {k:'orderId',l:'Order'},
                    {k:'customerName',l:'Customer'},
                    {k:'product',l:'Product'},
                    {k:'price',l:'Amount'},
                    {k:'status',l:'Status'},
                    {k:'platform',l:'Platform'},
                    {k:'createdAt',l:'Date'},
                  ].map(col => (
                    <th key={col.k} onClick={() => toggleSort(col.k)} className="text-left text-gray-400 font-medium px-4 py-3 cursor-pointer hover:text-white transition-colors select-none">
                      {col.l}{sortIcon(col.k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o:any) => (
                  <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{o.orderId}</td>
                    <td className="px-4 py-3 text-white">{o.customerName}</td>
                    <td className="px-4 py-3 text-gray-300">{o.product}</td>
                    <td className="px-4 py-3 text-white">Rs {(o.price*o.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={'text-xs px-2 py-1 rounded-full '+statusStyle[o.status]}>{o.status}</span></td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">{o.platform||'-'}</span></td>
                    <td className="px-4 py-3 text-gray-400">{o.createdAt?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <div className="text-center py-12 text-gray-500">No orders found for selected date range</div>}
          </div>
          <div className="mt-3 text-sm text-gray-400">
            Showing <span className="text-white font-medium">{filteredOrders.length}</span> orders • Total: <span className="text-white font-medium">Rs {dateRevenue.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}