'use client'
import { useState, useEffect } from 'react'

const statusColors: Record<string,string> = {
  Pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Confirmed: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
  Processing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Delivered: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const emptyForm = { orderId:'', customerName:'', phone:'', address:'', product:'', quantity:'1', price:'', status:'Pending', courier:'', trackingNo:'', platform:'FB' }

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => { setOrders(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/orders/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) })
    setOrders(orders.map(o => o.id === id ? {...o, status} : o))
  }

  const saveOrder = async () => {
    if (!form.customerName || !form.phone || !form.product || !form.price) return
    setSaving(true)
    const orderData = { ...form, quantity: parseInt(form.quantity), price: parseFloat(form.price), orderId: form.orderId || '#'+Date.now() }
    const res = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(orderData) })
    const newOrder = await res.json()
    setOrders([newOrder, ...orders])
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
  }

  const filtered = orders.filter(o => {
    const matchSearch = o.customerName?.toLowerCase().includes(search.toLowerCase()) || o.orderId?.includes(search) || o.phone?.includes(search)
    const matchFilter = filter === 'All' || o.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Orders</h1>
          <p className='text-gray-400 mt-1'>Manage all your orders</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className='bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all'>
          {showForm ? '✕ Cancel' : '+ New Order'}
        </button>
      </div>

      {showForm && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6'>
          <h2 className='text-white font-medium mb-4'>New Order</h2>
          <div className='grid grid-cols-3 gap-3'>
            {[
              {l:'Order ID', k:'orderId', p:'#1001 (auto if empty)'},
              {l:'Customer Name', k:'customerName', p:'Ram Bahadur'},
              {l:'Phone', k:'phone', p:'9841000000'},
              {l:'Address', k:'address', p:'Kathmandu, Nepal'},
              {l:'Product', k:'product', p:'Jacket'},
              {l:'Price (Rs)', k:'price', p:'2500'},
            ].map(f => (
              <div key={f.k}>
                <label className='text-gray-400 text-xs mb-1 block'>{f.l}</label>
                <input value={form[f.k as keyof typeof form]} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.p} className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
              </div>
            ))}
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Quantity</label>
              <input type='number' value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            </div>
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Platform</label>
              <select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                {['FB','IG','WA','Direct'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Courier</label>
              <select value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                <option value=''>Select Courier</option>
                {['Nepal Can Move','Upaya Courier','Fab Bud','Delivery Sansar'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Tracking No</label>
              <input value={form.trackingNo} onChange={e=>setForm({...form,trackingNo:e.target.value})} placeholder='NCM001234' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            </div>
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Status</label>
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                {['Pending','Confirmed','Processing','Delivered','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className='flex gap-3 mt-4'>
            <button onClick={saveOrder} disabled={saving} className='px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-all'>
              {saving ? '⏳ Saving...' : '💾 Save Order'}
            </button>
            <button onClick={() => { setForm(emptyForm); setShowForm(false) }} className='px-5 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm transition-all'>Cancel</button>
          </div>
        </div>
      )}

      <div className='flex gap-3 mb-4 flex-wrap'>
        <input type='text' placeholder='Search by name, phone, order ID...' value={search} onChange={e=>setSearch(e.target.value)} className='bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm flex-1 min-w-48 outline-none focus:border-violet-500' />
        {['All','Pending','Confirmed','Processing','Delivered','Cancelled'].map(s => (
          <button key={s} onClick={()=>setFilter(s)} className={'px-3 py-2 rounded-xl text-xs font-medium transition-all '+(filter===s?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className='text-center py-20 text-gray-400'>⏳ Loading orders...</div>
      ) : (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-800'>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Order</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Customer</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Product</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Amount</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Status</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Courier</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Platform</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Update</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className='border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors'>
                  <td className='px-4 py-3'><p className='text-white font-medium'>{o.orderId}</p><p className='text-gray-500 text-xs'>{new Date(o.createdAt).toLocaleDateString()}</p></td>
                  <td className='px-4 py-3'><p className='text-white'>{o.customerName}</p><p className='text-gray-400 text-xs'>{o.phone}</p></td>
                  <td className='px-4 py-3'><p className='text-white'>{o.product}</p><p className='text-gray-400 text-xs'>Qty: {o.quantity}</p></td>
                  <td className='px-4 py-3 text-white'>Rs {o.price?.toLocaleString()}</td>
                  <td className='px-4 py-3'><span className={'text-xs px-2 py-1 rounded-full '+(statusColors[o.status]||'')}>{o.status}</span></td>
                  <td className='px-4 py-3'><p className='text-white text-xs'>{o.courier||'-'}</p><p className='text-gray-400 text-xs'>{o.trackingNo||''}</p></td>
                  <td className='px-4 py-3'><span className='text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300'>{o.platform||'-'}</span></td>
                  <td className='px-4 py-3'>
                    <select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} className='bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-xs outline-none'>
                      {['Pending','Confirmed','Processing','Delivered','Cancelled'].map(s=>(<option key={s} value={s}>{s}</option>))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div className='text-center py-12 text-gray-500'>No orders found</div>}
        </div>
      )}
      <div className='mt-4 flex gap-4 text-sm text-gray-400'>
        <span>Total: <span className='text-white font-medium'>{filtered.length}</span> orders</span>
        <span>Revenue: <span className='text-white font-medium'>Rs {filtered.reduce((a,o)=>a+(o.price*o.quantity),0).toLocaleString()}</span></span>
      </div>
    </div>
  )
}