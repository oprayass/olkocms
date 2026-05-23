'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const couriers = ['Nepal Can Move', 'Upaya Courier', 'Fab Bud', 'Delivery Sansar']

const courierColors: Record<string,string> = {
  'Nepal Can Move': 'bg-red-600',
  'Upaya Courier': 'bg-blue-600',
  'Fab Bud': 'bg-orange-500',
  'Delivery Sansar': 'bg-emerald-600',
}

const statusStyle: Record<string,string> = {
  'Pending Pickup':'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  'Picked Up':'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'In Transit':'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Delivered':'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'Failed':'bg-red-500/20 text-red-400 border border-red-500/30',
}

export default function CourierPage() {
  const [tab, setTab] = useState('tracking')
  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [courierFilter, setCourierFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [customDate, setCustomDate] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const thisMonth = today.slice(0, 7)

  useEffect(() => {
    fetch('/api/courier')
      .then(r => r.json())
      .then(data => { setShipments(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/courier', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    setShipments(shipments.map(s => s.id === id ? {...s, status} : s))
  }

  const filtered = shipments.filter(s => {
    const matchStatus = filter === 'All' || s.status === filter
    const matchCourier = courierFilter === 'All' || s.courier === courierFilter
    const matchSearch = s.customer?.toLowerCase().includes(search.toLowerCase()) ||
      s.tracking?.includes(search) || s.orderId?.includes(search)
    const dateStr = s.createdAt?.split('T')[0] || ''
    let matchDate = true
    if (dateFilter === 'today') matchDate = dateStr === today
    if (dateFilter === 'yesterday') matchDate = dateStr === yesterday
    if (dateFilter === 'month') matchDate = dateStr.startsWith(thisMonth)
    if (dateFilter === 'custom' && customDate) matchDate = dateStr === customDate
    return matchStatus && matchCourier && matchSearch && matchDate
  })

  const totalToday = shipments.filter(s => s.createdAt?.startsWith(today)).reduce((a,s) => a + (s.charge||0), 0)
  const totalYest = shipments.filter(s => s.createdAt?.startsWith(yesterday)).reduce((a,s) => a + (s.charge||0), 0)
  const totalMonth = shipments.filter(s => s.createdAt?.startsWith(thisMonth)).reduce((a,s) => a + (s.charge||0), 0)

  const stats = couriers.map(c => {
    const all = shipments.filter(s => s.courier === c)
    const delivered = all.filter(s => s.status === 'Delivered')
    const failed = all.filter(s => s.status === 'Failed')
    const active = all.filter(s => !['Delivered','Failed'].includes(s.status))
    const rate = all.length > 0 ? Math.round((delivered.length / all.length) * 100) : 0
    const todayCharge = all.filter(s => s.createdAt?.startsWith(today)).reduce((a,s) => a+(s.charge||0), 0)
    const yestCharge = all.filter(s => s.createdAt?.startsWith(yesterday)).reduce((a,s) => a+(s.charge||0), 0)
    const monthCharge = all.filter(s => s.createdAt?.startsWith(thisMonth)).reduce((a,s) => a+(s.charge||0), 0)
    const totalCharge = all.reduce((a,s) => a+(s.charge||0), 0)
    return { name:c, total:all.length, delivered:delivered.length, failed:failed.length, active:active.length, rate, todayCharge, yestCharge, monthCharge, totalCharge }
  })

  const chartData = stats.map(s => ({ name: s.name.split(' ')[0], delivered: s.delivered, failed: s.failed, active: s.active, rate: s.rate }))

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Courier Management</h1>
          <p className="text-gray-400 mt-1">Track shipments and courier performance</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[{k:'tracking',l:'📦 Tracking'},{k:'performance',l:'📊 Performance'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={'px-5 py-2 rounded-xl text-sm font-medium transition-all '+(tab===t.k?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{t.l}</button>
        ))}
      </div>

      {tab === 'tracking' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { label:"Today's Charges", value:'Rs '+totalToday.toLocaleString(), icon:'📅', color:'from-violet-600 to-violet-800' },
              { label:"Yesterday's Charges", value:'Rs '+totalYest.toLocaleString(), icon:'🗓️', color:'from-blue-500 to-blue-700' },
              { label:"This Month's Charges", value:'Rs '+totalMonth.toLocaleString(), icon:'💰', color:'from-emerald-500 to-emerald-700' },
            ].map(s => (
              <div key={s.label} className={'bg-gradient-to-br '+s.color+' rounded-2xl p-4'}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-sm text-white/70">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mb-4 flex-wrap">
            <input type="text" placeholder="Search customer, tracking, order..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm w-64 outline-none focus:border-violet-500" />
            <select value={courierFilter} onChange={e=>setCourierFilter(e.target.value)} className="bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
              <option value="All">All Couriers</option>
              {couriers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Date</option>
            </select>
            {dateFilter === 'custom' && (
              <input type="date" value={customDate} onChange={e=>setCustomDate(e.target.value)} className="bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
            )}
            {['All','Pending Pickup','Picked Up','In Transit','Delivered','Failed'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={'px-3 py-2 rounded-xl text-xs font-medium transition-all '+(filter===f?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{f}</button>
            ))}
          </div>

          {shipments.length === 0 ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
              <p className="text-gray-500 mb-2">No shipments yet</p>
              <p className="text-gray-600 text-xs">Orders confirm bhayepachi shipment yahaa dekhinchha</p>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Order</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Customer</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Courier</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Tracking</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Charge</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">ETA</th>
                    <th className="text-left text-gray-400 font-medium px-4 py-3">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3"><p className="text-white font-medium">{s.orderId}</p><p className="text-gray-500 text-xs">{s.product}</p></td>
                      <td className="px-4 py-3"><p className="text-white">{s.customer}</p><p className="text-gray-400 text-xs">{s.phone}</p></td>
                      <td className="px-4 py-3"><span className={'text-xs px-2 py-1 rounded-full text-white font-medium '+(courierColors[s.courier]||'bg-gray-600')}>{s.courier?.split(' ')[0]}</span></td>
                      <td className="px-4 py-3 text-white font-mono text-xs">{s.tracking||'-'}</td>
                      <td className="px-4 py-3 text-white">Rs {s.charge||0}</td>
                      <td className="px-4 py-3"><span className={'text-xs px-2 py-1 rounded-full '+(statusStyle[s.status]||'')}>{s.status}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{s.estimated||'-'}</td>
                      <td className="px-4 py-3">
                        <select value={s.status} onChange={e=>updateStatus(s.id,e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-xs outline-none">
                          {['Pending Pickup','Picked Up','In Transit','Delivered','Failed'].map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="text-center py-12 text-gray-500">No shipments found</div>}
            </div>
          )}
          <div className="mt-3 flex gap-4 text-sm text-gray-400">
            <span>Showing: <span className="text-white font-medium">{filtered.length}</span> shipments</span>
            <span>Total Charges: <span className="text-white font-medium">Rs {filtered.reduce((a,s)=>a+(s.charge||0),0).toLocaleString()}</span></span>
          </div>
        </div>
      )}

      {tab === 'performance' && (
        <div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Delivery Rate by Courier</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{fontSize:11}} />
                  <YAxis stroke="#6b7280" tick={{fontSize:11}} unit="%" />
                  <Tooltip formatter={(v: number) => [v+'%', 'Delivery Rate']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Bar dataKey="rate" fill="#8b5cf6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
              <h2 className="text-white font-medium mb-4">Orders by Courier</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{fontSize:11}} />
                  <YAxis stroke="#6b7280" tick={{fontSize:11}} />
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Bar dataKey="delivered" name="Delivered" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="active" name="Active" fill="#f59e0b" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            {stats.map(s => (
              <div key={s.name} className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className={'text-xs px-3 py-1 rounded-full text-white font-medium '+(courierColors[s.name]||'bg-gray-600')}>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Delivery Rate:</span>
                    <span className={'text-lg font-bold '+(s.rate>=80?'text-emerald-400':s.rate>=60?'text-amber-400':'text-red-400')}>{s.rate}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 mb-4">
                  <div className={'h-2 rounded-full transition-all '+(s.rate>=80?'bg-emerald-500':s.rate>=60?'bg-amber-500':'bg-red-500')} style={{width:s.rate+'%'}}></div>
                </div>
                <div className="grid grid-cols-5 gap-4 text-center">
                  <div><p className="text-white font-bold text-lg">{s.total}</p><p className="text-gray-500 text-xs">Total</p></div>
                  <div><p className="text-emerald-400 font-bold text-lg">{s.delivered}</p><p className="text-gray-500 text-xs">Delivered</p></div>
                  <div><p className="text-amber-400 font-bold text-lg">{s.active}</p><p className="text-gray-500 text-xs">Active</p></div>
                  <div><p className="text-red-400 font-bold text-lg">{s.failed}</p><p className="text-gray-500 text-xs">Failed</p></div>
                  <div><p className="text-white font-bold text-lg">Rs {s.totalCharge.toLocaleString()}</p><p className="text-gray-500 text-xs">Total Charges</p></div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-800">
                  <div className="text-center"><p className="text-white text-sm font-medium">Rs {s.todayCharge.toLocaleString()}</p><p className="text-gray-500 text-xs">Today</p></div>
                  <div className="text-center"><p className="text-white text-sm font-medium">Rs {s.yestCharge.toLocaleString()}</p><p className="text-gray-500 text-xs">Yesterday</p></div>
                  <div className="text-center"><p className="text-white text-sm font-medium">Rs {s.monthCharge.toLocaleString()}</p><p className="text-gray-500 text-xs">This Month</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}