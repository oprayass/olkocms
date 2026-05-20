'use client'
import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const couriers = ['Nepal Can Move', 'Upaya Courier', 'Fab Bud', 'Delivery Sansar']

const courierColors: Record<string,string> = {
  'Nepal Can Move': 'bg-red-600',
  'Upaya Courier': 'bg-blue-600',
  'Fab Bud': 'bg-orange-500',
  'Delivery Sansar': 'bg-emerald-600',
}

const mockShipments = [
  { id:1, orderId:'#1001', customer:'Ram Bahadur', phone:'9841000001', product:'Jacket', courier:'Nepal Can Move', tracking:'NCM001234', status:'Delivered', charge:150, date:'2026-05-20', estimated:'2026-05-21' },
  { id:2, orderId:'#1002', customer:'Sita Devi', phone:'9841000002', product:'Saree', courier:'Upaya Courier', tracking:'UPC005678', status:'Delivered', charge:120, date:'2026-05-20', estimated:'2026-05-22' },
  { id:3, orderId:'#1003', customer:'Hari Prasad', phone:'9841000003', product:'Shoes', courier:'Fab Bud', tracking:'FAB009012', status:'In Transit', charge:100, date:'2026-05-19', estimated:'2026-05-22' },
  { id:4, orderId:'#1004', customer:'Gita Kumari', phone:'9841000004', product:'Bag', courier:'Delivery Sansar', tracking:'DS003456', status:'Pending Pickup', charge:130, date:'2026-05-20', estimated:'2026-05-23' },
  { id:5, orderId:'#1005', customer:'Bikash Thapa', phone:'9841000005', product:'Watch', courier:'Nepal Can Move', tracking:'NCM007890', status:'Failed', charge:150, date:'2026-05-19', estimated:'2026-05-21' },
  { id:6, orderId:'#1006', customer:'Kabita Magar', phone:'9841000006', product:'Dress', courier:'Upaya Courier', tracking:'UPC001122', status:'Delivered', charge:120, date:'2026-05-18', estimated:'2026-05-20' },
  { id:7, orderId:'#1007', customer:'Sujan Lama', phone:'9841000007', product:'Cap', courier:'Fab Bud', tracking:'FAB003344', status:'Delivered', charge:100, date:'2026-05-18', estimated:'2026-05-20' },
  { id:8, orderId:'#1008', customer:'Dipak Rai', phone:'9841000008', product:'Belt', courier:'Delivery Sansar', tracking:'DS005566', status:'In Transit', charge:130, date:'2026-05-17', estimated:'2026-05-20' },
  { id:9, orderId:'#1009', customer:'Anita Gurung', phone:'9841000009', product:'Scarf', courier:'Nepal Can Move', tracking:'NCM007788', status:'Delivered', charge:150, date:'2026-05-15', estimated:'2026-05-17' },
  { id:10, orderId:'#1010', customer:'Ramesh Oli', phone:'9841000010', product:'Wallet', courier:'Upaya Courier', tracking:'UPC009900', status:'Picked Up', charge:120, date:'2026-05-20', estimated:'2026-05-22' },
]

const statusStyle: Record<string,string> = {
  'Pending Pickup':'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  'Picked Up':'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  'In Transit':'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Delivered':'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  'Failed':'bg-red-500/20 text-red-400 border border-red-500/30',
}

const today = '2026-05-20'
const yesterday = '2026-05-19'

export default function CourierPage() {
  const [tab, setTab] = useState('tracking')
  const [filter, setFilter] = useState('All')
  const [courierFilter, setCourierFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [customDate, setCustomDate] = useState('')
  const [shipments, setShipments] = useState(mockShipments)

  const getFiltered = () => {
    return shipments.filter(s => {
      const matchStatus = filter === 'All' || s.status === filter
      const matchCourier = courierFilter === 'All' || s.courier === courierFilter
      const matchSearch = s.customer.toLowerCase().includes(search.toLowerCase()) || s.tracking.includes(search) || s.orderId.includes(search)
      let matchDate = true
      if (dateFilter === 'today') matchDate = s.date === today
      if (dateFilter === 'yesterday') matchDate = s.date === yesterday
      if (dateFilter === 'month') matchDate = s.date.startsWith('2026-05')
      if (dateFilter === 'custom' && customDate) matchDate = s.date === customDate
      return matchStatus && matchCourier && matchSearch && matchDate
    })
  }

  const filtered = getFiltered()

  const updateStatus = (id: number, status: string) => {
    setShipments(shipments.map(s => s.id === id ? {...s, status} : s))
  }

  const getCourierStats = () => {
    return couriers.map(c => {
      const all = shipments.filter(s => s.courier === c)
      const delivered = all.filter(s => s.status === 'Delivered')
      const failed = all.filter(s => s.status === 'Failed')
      const active = all.filter(s => !['Delivered','Failed'].includes(s.status))
      const totalCharge = all.reduce((a,s) => a+s.charge, 0)
      const todayCharge = all.filter(s=>s.date===today).reduce((a,s)=>a+s.charge,0)
      const yestCharge = all.filter(s=>s.date===yesterday).reduce((a,s)=>a+s.charge,0)
      const monthCharge = all.reduce((a,s)=>a+s.charge,0)
      const rate = all.length > 0 ? Math.round((delivered.length/all.length)*100) : 0
      return { name:c, total:all.length, delivered:delivered.length, failed:failed.length, active:active.length, rate, totalCharge, todayCharge, yestCharge, monthCharge }
    })
  }

  const stats = getCourierStats()
  const chartData = stats.map(s => ({ name: s.name.split(' ')[0], delivered: s.delivered, failed: s.failed, active: s.active, rate: s.rate }))

  const totalToday = shipments.filter(s=>s.date===today).reduce((a,s)=>a+s.charge,0)
  const totalYest = shipments.filter(s=>s.date===yesterday).reduce((a,s)=>a+s.charge,0)
  const totalMonth = shipments.reduce((a,s)=>a+s.charge,0)

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Courier Management</h1>
          <p className='text-gray-400 mt-1'>Track shipments and courier performance</p>
        </div>
      </div>

      <div className='flex gap-2 mb-6'>
        {['tracking','performance'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={'px-5 py-2 rounded-xl text-sm font-medium transition-all capitalize '+(tab===t?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{t === 'tracking' ? '📦 Tracking' : '📊 Performance'}</button>
        ))}
      </div>

      {tab === 'tracking' && (
        <div>
          <div className='grid grid-cols-3 gap-4 mb-5'>
            {[
              { label:"Today's Charges", value:'Rs '+totalToday.toLocaleString(), icon:'📅', color:'from-violet-600 to-violet-800' },
              { label:"Yesterday's Charges", value:'Rs '+totalYest.toLocaleString(), icon:'🗓️', color:'from-blue-500 to-blue-700' },
              { label:"This Month's Charges", value:'Rs '+totalMonth.toLocaleString(), icon:'💰', color:'from-emerald-500 to-emerald-700' },
            ].map(s => (
              <div key={s.label} className={'bg-gradient-to-br '+s.color+' rounded-2xl p-4'}>
                <div className='text-2xl mb-1'>{s.icon}</div>
                <div className='text-xl font-bold text-white'>{s.value}</div>
                <div className='text-sm text-white/70'>{s.label}</div>
              </div>
            ))}
          </div>

          <div className='flex gap-3 mb-4 flex-wrap'>
            <input type='text' placeholder='Search customer, tracking, order...' value={search} onChange={e=>setSearch(e.target.value)} className='bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm w-64 outline-none focus:border-violet-500' />
            <select value={courierFilter} onChange={e=>setCourierFilter(e.target.value)} className='bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
              <option value='All'>All Couriers</option>
              {couriers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className='bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
              <option value='all'>All Dates</option>
              <option value='today'>Today</option>
              <option value='yesterday'>Yesterday</option>
              <option value='month'>This Month</option>
              <option value='custom'>Custom Date</option>
            </select>
            {dateFilter === 'custom' && (
              <input type='date' value={customDate} onChange={e=>setCustomDate(e.target.value)} className='bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            )}
            {['All','Pending Pickup','Picked Up','In Transit','Delivered','Failed'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={'px-3 py-2 rounded-xl text-xs font-medium transition-all '+(filter===f?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{f}</button>
            ))}
          </div>

          <div className='bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-800'>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Order</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Customer</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Courier</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Tracking</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Charge</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Status</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>ETA</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Update</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className='border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors'>
                    <td className='px-4 py-3'><p className='text-white font-medium'>{s.orderId}</p><p className='text-gray-500 text-xs'>{s.product}</p></td>
                    <td className='px-4 py-3'><p className='text-white'>{s.customer}</p><p className='text-gray-400 text-xs'>{s.phone}</p></td>
                    <td className='px-4 py-3'><span className={'text-xs px-2 py-1 rounded-full text-white font-medium '+(courierColors[s.courier]||'bg-gray-600')}>{s.courier.split(' ')[0]}</span></td>
                    <td className='px-4 py-3 text-white font-mono text-xs'>{s.tracking}</td>
                    <td className='px-4 py-3 text-white'>Rs {s.charge}</td>
                    <td className='px-4 py-3'><span className={'text-xs px-2 py-1 rounded-full '+statusStyle[s.status]}>{s.status}</span></td>
                    <td className='px-4 py-3 text-gray-400 text-xs'>{s.estimated}</td>
                    <td className='px-4 py-3'>
                      <select value={s.status} onChange={e=>updateStatus(s.id,e.target.value)} className='bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-xs outline-none'>
                        {['Pending Pickup','Picked Up','In Transit','Delivered','Failed'].map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className='text-center py-12 text-gray-500'>No shipments found</div>}
          </div>
          <div className='mt-3 flex gap-4 text-sm text-gray-400'>
            <span>Showing: <span className='text-white font-medium'>{filtered.length}</span> shipments</span>
            <span>Total Charges: <span className='text-white font-medium'>Rs {filtered.reduce((a,s)=>a+s.charge,0).toLocaleString()}</span></span>
          </div>
        </div>
      )}

      {tab === 'performance' && (
        <div>
          <div className='grid grid-cols-2 gap-6 mb-6'>
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h2 className='text-white font-medium mb-4'>Delivery Rate by Courier</h2>
              <ResponsiveContainer width='100%' height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#1f2937' />
                  <XAxis dataKey='name' stroke='#6b7280' tick={{fontSize:11}} />
                  <YAxis stroke='#6b7280' tick={{fontSize:11}} unit='%' />
                  <Tooltip formatter={(v: number) => [v+'%', 'Delivery Rate']} contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Bar dataKey='rate' fill='#8b5cf6' radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h2 className='text-white font-medium mb-4'>Orders by Courier</h2>
              <ResponsiveContainer width='100%' height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#1f2937' />
                  <XAxis dataKey='name' stroke='#6b7280' tick={{fontSize:11}} />
                  <YAxis stroke='#6b7280' tick={{fontSize:11}} />
                  <Tooltip contentStyle={{background:'#111827',border:'1px solid #374151',borderRadius:'12px',color:'#fff'}} />
                  <Bar dataKey='delivered' name='Delivered' fill='#10b981' radius={[4,4,0,0]} />
                  <Bar dataKey='failed' name='Failed' fill='#ef4444' radius={[4,4,0,0]} />
                  <Bar dataKey='active' name='Active' fill='#f59e0b' radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className='space-y-4'>
            {stats.map(s => (
              <div key={s.name} className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
                <div className='flex items-center justify-between mb-4'>
                  <div className='flex items-center gap-3'>
                    <span className={'text-xs px-3 py-1 rounded-full text-white font-medium '+(courierColors[s.name]||'bg-gray-600')}>{s.name}</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-gray-400 text-sm'>Delivery Rate:</span>
                    <span className={'text-lg font-bold '+(s.rate>=80?'text-emerald-400':s.rate>=60?'text-amber-400':'text-red-400')}>{s.rate}%</span>
                  </div>
                </div>
                <div className='w-full bg-gray-800 rounded-full h-2 mb-4'>
                  <div className={'h-2 rounded-full transition-all '+(s.rate>=80?'bg-emerald-500':s.rate>=60?'bg-amber-500':'bg-red-500')} style={{width:s.rate+'%'}}></div>
                </div>
                <div className='grid grid-cols-5 gap-4 text-center'>
                  <div><p className='text-white font-bold text-lg'>{s.total}</p><p className='text-gray-500 text-xs'>Total Orders</p></div>
                  <div><p className='text-emerald-400 font-bold text-lg'>{s.delivered}</p><p className='text-gray-500 text-xs'>Delivered</p></div>
                  <div><p className='text-amber-400 font-bold text-lg'>{s.active}</p><p className='text-gray-500 text-xs'>Active</p></div>
                  <div><p className='text-red-400 font-bold text-lg'>{s.failed}</p><p className='text-gray-500 text-xs'>Failed</p></div>
                  <div><p className='text-white font-bold text-lg'>Rs {s.monthCharge.toLocaleString()}</p><p className='text-gray-500 text-xs'>Total Charges</p></div>
                </div>
                <div className='grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-800'>
                  <div className='text-center'><p className='text-white text-sm font-medium'>Rs {s.todayCharge.toLocaleString()}</p><p className='text-gray-500 text-xs'>Today</p></div>
                  <div className='text-center'><p className='text-white text-sm font-medium'>Rs {s.yestCharge.toLocaleString()}</p><p className='text-gray-500 text-xs'>Yesterday</p></div>
                  <div className='text-center'><p className='text-white text-sm font-medium'>Rs {s.monthCharge.toLocaleString()}</p><p className='text-gray-500 text-xs'>This Month</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}