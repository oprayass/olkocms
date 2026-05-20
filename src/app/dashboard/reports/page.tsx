'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

const todayData = [
  { day:'Morning', orders:8, revenue:18000, delivered:7, cancelled:0 },
  { day:'Afternoon', orders:12, revenue:28000, delivered:10, cancelled:1 },
  { day:'Evening', orders:9, revenue:22000, delivered:8, cancelled:1 },
  { day:'Night', orders:3, revenue:7000, delivered:2, cancelled:0 },
]
const daily = [
  { day:'Sun', orders:28, revenue:64000, delivered:22, cancelled:3 },
  { day:'Mon', orders:12, revenue:28000, delivered:10, cancelled:1 },
  { day:'Tue', orders:19, revenue:45000, delivered:16, cancelled:2 },
  { day:'Wed', orders:8, revenue:18000, delivered:7, cancelled:0 },
  { day:'Thu', orders:24, revenue:58000, delivered:20, cancelled:2 },
  { day:'Fri', orders:31, revenue:72000, delivered:27, cancelled:3 },
  { day:'Sat', orders:42, revenue:95000, delivered:38, cancelled:2 },
]
const monthly = [
  { month:'Jan', orders:145, revenue:320000, delivered:128, cancelled:12 },
  { month:'Feb', orders:189, revenue:415000, delivered:168, cancelled:15 },
  { month:'Mar', orders:210, revenue:490000, delivered:192, cancelled:11 },
  { month:'Apr', orders:178, revenue:398000, delivered:159, cancelled:14 },
  { month:'May', orders:234, revenue:545000, delivered:210, cancelled:18 },
]
const yearly = [
  { year:'2023', orders:1820, revenue:4200000, delivered:1620, cancelled:142 },
  { year:'2024', orders:2340, revenue:5800000, delivered:2100, cancelled:189 },
  { year:'2025', orders:2890, revenue:7200000, delivered:2600, cancelled:210 },
  { year:'2026', orders:956, revenue:2400000, delivered:857, cancelled:70 },
]

const allOrders = [
  { id:'#1001', customer:'Ram Bahadur', product:'Jacket', amount:2500, status:'Delivered', platform:'FB', date:'2026-05-20' },
  { id:'#1002', customer:'Sita Devi', product:'Saree', amount:4200, status:'Delivered', platform:'IG', date:'2026-05-20' },
  { id:'#1003', customer:'Hari Prasad', product:'Shoes', amount:1800, status:'Processing', platform:'WA', date:'2026-05-19' },
  { id:'#1004', customer:'Gita Kumari', product:'Bag', amount:3600, status:'Pending', platform:'FB', date:'2026-05-19' },
  { id:'#1005', customer:'Bikash Thapa', product:'Watch', amount:5500, status:'Delivered', platform:'IG', date:'2026-05-18' },
  { id:'#1006', customer:'Kabita Magar', product:'Dress', amount:2200, status:'Cancelled', platform:'WA', date:'2026-05-18' },
  { id:'#1007', customer:'Sujan Lama', product:'Cap', amount:800, status:'Delivered', platform:'FB', date:'2026-05-17' },
  { id:'#1008', customer:'Dipak Rai', product:'Belt', amount:1200, status:'Processing', platform:'IG', date:'2026-05-17' },
  { id:'#1009', customer:'Anita Gurung', product:'Scarf', amount:950, status:'Delivered', platform:'WA', date:'2026-05-16' },
  { id:'#1010', customer:'Ramesh Oli', product:'Wallet', amount:1800, status:'Pending', platform:'FB', date:'2026-05-16' },
]

const platformData = [
  { name:'Facebook', value:45, color:'#3b82f6' },
  { name:'Instagram', value:32, color:'#ec4899' },
  { name:'WhatsApp', value:23, color:'#10b981' },
]
const statusData = [
  { name:'Delivered', value:58, color:'#10b981' },
  { name:'Processing', value:22, color:'#3b82f6' },
  { name:'Pending', value:14, color:'#f59e0b' },
  { name:'Cancelled', value:6, color:'#ef4444' },
]
const statusStyle: Record<string,string> = {
  Delivered:'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Processing:'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Pending:'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Cancelled:'bg-red-500/20 text-red-400 border border-red-500/30',
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('today')
  const [tab, setTab] = useState('overview')
  const [fromDate, setFromDate] = useState('2026-05-16')
  const [toDate, setToDate] = useState('2026-05-20')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [platformFilter, setPlatformFilter] = useState('All')

  const data = period==='today' ? todayData : period==='weekly' ? daily : period==='monthly' ? monthly : yearly
  const xKey = period==='today' ? 'day' : period==='weekly' ? 'day' : period==='monthly' ? 'month' : 'year'
  const totalRevenue = data.reduce((a,d) => a+d.revenue, 0)
  const totalOrders = data.reduce((a,d) => a+d.orders, 0)
  const totalDelivered = data.reduce((a,d) => a+d.delivered, 0)
  const totalCancelled = data.reduce((a,d) => a+d.cancelled, 0)
  const avgOrder = totalOrders > 0 ? Math.round(totalRevenue/totalOrders) : 0
  const deliveryRate = totalOrders > 0 ? Math.round((totalDelivered/totalOrders)*100) : 0

  const filteredOrders = allOrders
    .filter(o => o.date >= fromDate && o.date <= toDate)
    .filter(o => statusFilter === 'All' || o.status === statusFilter)
    .filter(o => platformFilter === 'All' || o.platform === platformFilter)
    .sort((a,b) => {
      let av: string|number = a[sortBy as keyof typeof a] as string|number
      let bv: string|number = b[sortBy as keyof typeof b] as string|number
      if (sortDir === 'asc') return av > bv ? 1 : -1
      return av < bv ? 1 : -1
    })

  const dateRevenue = filteredOrders.reduce((a,o) => a+o.amount, 0)

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Reports & Analytics</h1>
          <p className='text-gray-400 mt-1'>Track your business performance</p>
        </div>
      </div>

      <div className='flex gap-2 mb-6'>
        {[{k:'overview',l:'📊 Overview'},{k:'datewise',l:'📅 Date Wise'}].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className={'px-5 py-2 rounded-xl text-sm font-medium transition-all '+(tab===t.k?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{t.l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className='flex gap-2 mb-5'>
            {[{k:'today',l:'📍 Today'},{k:'weekly',l:'📅 Weekly'},{k:'monthly',l:'🗓️ Monthly'},{k:'yearly',l:'📆 Yearly'}].map(p => (
              <button key={p.k} onClick={() => setPeriod(p.k)} className={'px-4 py-2 rounded-xl text-sm font-medium transition-all '+(period===p.k?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{p.l}</button>
            ))}
          </div>
          <div className='grid grid-cols-3 gap-4 mb-6'>
            {[
              {label:'Total Revenue',value:'Rs '+totalRevenue.toLocaleString(),icon:'💰',color:'from-emerald-500 to-emerald-700'},
              {label:'Total Orders',value:totalOrders,icon:'📦',color:'from-violet-600 to-violet-800'},
              {label:'Avg Order Value',value:'Rs '+avgOrder.toLocaleString(),icon:'📊',color:'from-blue-500 to-blue-700'},
              {label:'Delivered',value:totalDelivered,icon:'✅',color:'from-teal-500 to-teal-700'},
              {label:'Cancelled',value:totalCancelled,icon:'❌',color:'from-red-500 to-red-700'},
              {label:'Delivery Rate',value:deliveryRate+'%',icon:'🚚',color:'from-amber-500 to-amber-700'},
            ].map(s => (
              <div key={s.label} className={'bg-gradient-to-br '+s.color+' rounded-2xl p-4'}>
                <div className='text-2xl mb-1'>{s.icon}</div>
                <div className='text-xl font-bold text-white'>{s.value}</div>
                <div className='text-xs text-white/70 mt-1'>{s.label}</div>
              </div>
            ))}
          </div>
          <div className='grid grid-cols-2 gap-6 mb-6'>
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h2 className='text-white font-medium mb-4'>Revenue Trend</h2>
              <ResponsiveContainer width='100%' height={200}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#1f2937' />
                  <XAxis dataKey={xKey} stroke='#6b7280' tick={{fontSize:11}} />
                  <YAxis stroke='#6b7280' tick={{fontSize:11}} tickFormatter={v => 'Rs '+Math.round(v/1000)+'k'} />
                  <Tooltip formatter={(v: number) => ['Rs '+v.toLocaleString(),'Revenue']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Line type='monotone' dataKey='revenue' stroke='#8b5cf6' strokeWidth={2} dot={{fill:'#8b5cf6'}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h2 className='text-white font-medium mb-4'>Orders vs Delivered</h2>
              <ResponsiveContainer width='100%' height={200}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#1f2937' />
                  <XAxis dataKey={xKey} stroke='#6b7280' tick={{fontSize:11}} />
                  <YAxis stroke='#6b7280' tick={{fontSize:11}} />
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Bar dataKey='orders' name='Orders' fill='#8b5cf6' radius={[4,4,0,0]} />
                  <Bar dataKey='delivered' name='Delivered' fill='#10b981' radius={[4,4,0,0]} />
                  <Bar dataKey='cancelled' name='Cancelled' fill='#ef4444' radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-6'>
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h2 className='text-white font-medium mb-4'>Orders by Platform</h2>
              <div className='flex items-center gap-4'>
                <ResponsiveContainer width='50%' height={160}>
                  <PieChart><Pie data={platformData} cx='50%' cy='50%' innerRadius={45} outerRadius={75} dataKey='value'>
                    {platformData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie><Tooltip formatter={(v:number) => [v+'%','Share']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} /></PieChart>
                </ResponsiveContainer>
                <div className='space-y-2 flex-1'>
                  {platformData.map(p => (<div key={p.name} className='flex items-center gap-2'><div className='w-2.5 h-2.5 rounded-full' style={{background:p.color}}></div><span className='text-gray-400 text-sm'>{p.name}</span><span className='text-white font-medium ml-auto'>{p.value}%</span></div>))}
                </div>
              </div>
            </div>
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h2 className='text-white font-medium mb-4'>Order Status</h2>
              <div className='flex items-center gap-4'>
                <ResponsiveContainer width='50%' height={160}>
                  <PieChart><Pie data={statusData} cx='50%' cy='50%' innerRadius={45} outerRadius={75} dataKey='value'>
                    {statusData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie><Tooltip formatter={(v:number) => [v+'%','Share']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} /></PieChart>
                </ResponsiveContainer>
                <div className='space-y-2 flex-1'>
                  {statusData.map(s => (<div key={s.name} className='flex items-center gap-2'><div className='w-2.5 h-2.5 rounded-full' style={{background:s.color}}></div><span className='text-gray-400 text-sm'>{s.name}</span><span className='text-white font-medium ml-auto'>{s.value}%</span></div>))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'datewise' && (
        <div>
          <div className='bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-5'>
            <div className='flex gap-3 flex-wrap items-end'>
              <div>
                <p className='text-gray-400 text-xs mb-1'>From Date</p>
                <input type='date' value={fromDate} onChange={e=>setFromDate(e.target.value)} className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
              </div>
              <div>
                <p className='text-gray-400 text-xs mb-1'>To Date</p>
                <input type='date' value={toDate} onChange={e=>setToDate(e.target.value)} className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
              </div>
              <div>
                <p className='text-gray-400 text-xs mb-1'>Status</p>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                  {['All','Delivered','Processing','Pending','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <p className='text-gray-400 text-xs mb-1'>Platform</p>
                <select value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)} className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                  {['All','FB','IG','WA'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-3 gap-4 mb-5'>
            <div className='bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-4'>
              <div className='text-2xl mb-1'>💰</div>
              <div className='text-xl font-bold text-white'>Rs {dateRevenue.toLocaleString()}</div>
              <div className='text-xs text-white/70'>Total Revenue</div>
            </div>
            <div className='bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl p-4'>
              <div className='text-2xl mb-1'>📦</div>
              <div className='text-xl font-bold text-white'>{filteredOrders.length}</div>
              <div className='text-xs text-white/70'>Total Orders</div>
            </div>
            <div className='bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-4'>
              <div className='text-2xl mb-1'>✅</div>
              <div className='text-xl font-bold text-white'>{filteredOrders.filter(o=>o.status==='Delivered').length}</div>
              <div className='text-xs text-white/70'>Delivered</div>
            </div>
          </div>

          <div className='bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-800'>
                  {[
                    {k:'id',l:'Order'},
                    {k:'customer',l:'Customer'},
                    {k:'product',l:'Product'},
                    {k:'amount',l:'Amount'},
                    {k:'status',l:'Status'},
                    {k:'platform',l:'Platform'},
                    {k:'date',l:'Date'},
                  ].map(col => (
                    <th key={col.k} onClick={() => toggleSort(col.k)} className='text-left text-gray-400 font-medium px-4 py-3 cursor-pointer hover:text-white transition-colors select-none'>
                      {col.l}{sortIcon(col.k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(o => (
                  <tr key={o.id} className='border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors'>
                    <td className='px-4 py-3 text-white font-medium'>{o.id}</td>
                    <td className='px-4 py-3 text-white'>{o.customer}</td>
                    <td className='px-4 py-3 text-gray-300'>{o.product}</td>
                    <td className='px-4 py-3 text-white'>Rs {o.amount.toLocaleString()}</td>
                    <td className='px-4 py-3'><span className={'text-xs px-2 py-1 rounded-full '+statusStyle[o.status]}>{o.status}</span></td>
                    <td className='px-4 py-3'><span className='text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300'>{o.platform}</span></td>
                    <td className='px-4 py-3 text-gray-400'>{o.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <div className='text-center py-12 text-gray-500'>No orders found for selected date range</div>}
          </div>
          <div className='mt-3 text-sm text-gray-400'>
            Showing <span className='text-white font-medium'>{filteredOrders.length}</span> orders • Total: <span className='text-white font-medium'>Rs {dateRevenue.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}