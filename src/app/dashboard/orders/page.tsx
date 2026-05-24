'use client'
import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, User, Bot, Loader2 } from 'lucide-react'

const statusColors: Record<string,string> = {
  Pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Confirmed: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
  Processing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Delivered: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
}

const emptyForm = {
  orderId:'', customerName:'', phone:'', address:'', product:'', quantity:'1',
  price:'', costPrice:'', shippingCharge:'', customerShippingCharge:'',
  status:'Pending', courier:'', trackingNo:'', platform:'FB', campaignId:'', adId:'',
  isSameDay: false, isCancelledAtDoor: false, isExchange: false, isFailedDelivery: false
}

function CustomerMessageDrawer({ customerName, phone, senderId }: { customerName: string, phone?: string, senderId?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    setLoading(true)
    try {
      let query = ''
      if (senderId) query = `senderId=${encodeURIComponent(senderId)}`
      else if (phone) query = `phone=${encodeURIComponent(phone)}`
      else { setLoading(false); return }
      const res = await fetch(`/api/messages/customer?${query}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) fetchMessages() }, [open])
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  const handleSend = async () => {
    if (!replyText.trim() || !senderId) return
    setSending(true)
    try {
      await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: replyText, sender: 'staff', senderId }) })
      setReplyText('')
      await fetchMessages()
    } catch (e) { console.error(e) }
    finally { setSending(false) }
  }

  const formatTime = (d: string) => new Date(d).toLocaleString('ne-NP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true) }} className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 py-0.5 rounded-full transition-all border border-transparent hover:border-blue-500/30">
        <MessageCircle className="w-3 h-3" /><span>Messages</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md h-[72vh] bg-gray-900 border border-gray-700 rounded-tl-2xl rounded-tr-2xl md:rounded-2xl md:mb-4 md:mr-4 flex flex-col shadow-2xl" style={{ animation: 'slideUp 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 rounded-tl-2xl rounded-tr-2xl md:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">{customerName.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="text-white font-semibold text-sm">{customerName}</p>
                  {phone && <p className="text-gray-400 text-xs">{phone}</p>}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white hover:bg-gray-700 p-1.5 rounded-full"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                  <p className="text-gray-400 text-sm">Messages load हुँदैछ...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <MessageCircle className="w-12 h-12 text-gray-700" />
                  <p className="text-gray-500 text-sm text-center">{customerName} सँग कुनै message छैन</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">{messages.length} messages</span>
                  </div>
                  {messages.map((msg: any) => {
                    const isStaff = msg.sender === 'staff'
                    const isBot = msg.sender === 'bot'
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isStaff ? 'justify-end' : 'justify-start'}`}>
                        {!isStaff && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isBot ? 'bg-violet-800' : 'bg-gray-700'}`}>
                            {isBot ? <Bot className="w-3.5 h-3.5 text-violet-300" /> : <User className="w-3.5 h-3.5 text-blue-400" />}
                          </div>
                        )}
                        <div className="max-w-[75%] space-y-0.5">
                          <p className={`text-xs text-gray-500 ${isStaff ? 'text-right' : ''}`}>{isBot ? 'AI Bot' : isStaff ? 'Staff' : customerName}</p>
                          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isStaff ? 'bg-blue-600 text-white rounded-tr-none' : isBot ? 'bg-violet-900/60 text-violet-100 rounded-tl-none' : 'bg-gray-700 text-white rounded-tl-none'}`}>{msg.message || msg.content}</div>
                          <p className={`text-xs text-gray-600 ${isStaff ? 'text-right' : ''}`}>{formatTime(msg.createdAt)}</p>
                        </div>
                        {isStaff && <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1"><User className="w-3.5 h-3.5 text-white" /></div>}
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50">
              {senderId ? (
                <>
                  <div className="flex items-center gap-2">
                    <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Reply लेख्नुस्..." className="flex-1 bg-gray-700 text-white text-sm rounded-xl px-4 py-2.5 border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-400" />
                    <button onClick={handleSend} disabled={!replyText.trim() || sending} className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-xl flex items-center justify-center disabled:cursor-not-allowed">
                      {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 text-center">Enter — Facebook मा reply जान्छ</p>
                </>
              ) : (
                <p className="text-xs text-gray-600 text-center py-1">Facebook ID नभएकोले reply पठाउन मिल्दैन</p>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editOrder, setEditOrder] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(data => { setOrders(Array.isArray(data) ? data : []); setLoading(false) }).catch(() => setLoading(false))
    fetch('/api/ad-campaigns').then(r => r.json()).then(data => setCampaigns(Array.isArray(data) ? data : []))
  }, [])

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/orders/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) })
    setOrders(orders.map(o => o.id === id ? {...o, status} : o))
  }

  const toggleFlag = async (id: string, field: string, value: boolean) => {
    await fetch('/api/orders/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ [field]: value }) })
    setOrders(orders.map(o => o.id === id ? {...o, [field]: value} : o))
  }

  const saveOrder = async () => {
    if (!form.customerName || !form.phone || !form.product || !form.price) return
    setSaving(true)
    const orderData = {
      ...form,
      quantity: parseInt(form.quantity),
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      shippingCharge: form.shippingCharge ? parseFloat(form.shippingCharge) : null,
      customerShippingCharge: form.customerShippingCharge ? parseFloat(form.customerShippingCharge) : null,
      orderId: form.orderId || '#'+Date.now()
    }
    const res = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(orderData) })
    const newOrder = await res.json()
    setOrders([newOrder, ...orders])
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
  }

  const filtered = orders.filter(o => {
    const matchSearch = o.customerName?.toLowerCase().includes(search.toLowerCase()) || o.orderId?.includes(search) || o.phone?.includes(search)
    const matchFilter = filter === 'All' || o.status === filter || (filter === 'SameDay' && o.isSameDay) || (filter === 'Exchange' && o.isExchange) || (filter === 'CancelledDoor' && o.isCancelledAtDoor) || (filter === 'Failed' && o.isFailedDelivery)
    return matchSearch && matchFilter
  })

  const formFields = [
    {l:'Order ID', k:'orderId', p:'#1001 (auto)'},
    {l:'Customer Name', k:'customerName', p:'Ram Bahadur'},
    {l:'Phone', k:'phone', p:'9841000000'},
    {l:'Address', k:'address', p:'Kathmandu'},
    {l:'Product', k:'product', p:'Jacket'},
    {l:'Sale Price (Rs)', k:'price', p:'2500'},
    {l:'Cost Price (Rs)', k:'costPrice', p:'1500'},
    {l:'Courier Shipping (Rs)', k:'shippingCharge', p:'100'},
    {l:'Customer Shipping (Rs)', k:'customerShippingCharge', p:'0'},
  ]

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Orders</h1>
          <p className='text-gray-400 mt-1'>Manage all your orders</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className='bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all'>{showForm ? 'X Cancel' : '+ New Order'}</button>
      </div>

      <div className='grid grid-cols-5 gap-3 mb-5'>
        {[
          { label: 'Total', value: orders.length, color: 'from-violet-600 to-violet-800' },
          { label: 'Same Day', value: orders.filter(o=>o.isSameDay).length, color: 'from-orange-500 to-orange-700' },
          { label: 'Exchange', value: orders.filter(o=>o.isExchange).length, color: 'from-blue-500 to-blue-700' },
          { label: 'Cancelled at Door', value: orders.filter(o=>o.isCancelledAtDoor).length, color: 'from-red-500 to-red-700' },
          { label: 'Failed Delivery', value: orders.filter(o=>o.isFailedDelivery).length, color: 'from-gray-600 to-gray-800' },
        ].map(s => (
          <div key={s.label} className={'bg-gradient-to-br '+s.color+' rounded-2xl p-3 text-center cursor-pointer'} onClick={() => setFilter(s.label === 'Total' ? 'All' : s.label === 'Same Day' ? 'SameDay' : s.label === 'Cancelled at Door' ? 'CancelledDoor' : s.label === 'Failed Delivery' ? 'Failed' : s.label)}>
            <div className='text-2xl font-bold text-white'>{s.value}</div>
            <div className='text-xs text-white/70 mt-1'>{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6'>
          <h2 className='text-white font-medium mb-4'>New Order</h2>
          <div className='grid grid-cols-3 gap-3'>
            {formFields.map(f => (
              <div key={f.k}>
                <label className='text-gray-400 text-xs mb-1 block'>{f.l}</label>
                <input value={form[f.k as keyof typeof form] as string} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.p} className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
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
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Ad Campaign</label>
              <select value={form.campaignId} onChange={e=>setForm({...form,campaignId:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                <option value=''>No Campaign</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Ad ID</label>
              <input value={form.adId} onChange={e=>setForm({...form,adId:e.target.value})} placeholder='FB Ad ID' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            </div>
            <div className='flex items-center gap-4 col-span-3 mt-1 flex-wrap'>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input type='checkbox' checked={form.isSameDay} onChange={e=>setForm({...form,isSameDay:e.target.checked})} className='w-4 h-4 accent-orange-500' />
                <span className='text-sm text-white'>⚡ Same Day</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input type='checkbox' checked={form.isCancelledAtDoor} onChange={e=>setForm({...form,isCancelledAtDoor:e.target.checked})} className='w-4 h-4 accent-red-500' />
                <span className='text-sm text-white'>🚪 Cancelled at Door</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input type='checkbox' checked={form.isExchange} onChange={e=>setForm({...form,isExchange:e.target.checked})} className='w-4 h-4 accent-blue-500' />
                <span className='text-sm text-white'>🔄 Exchange</span>
              </label>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input type='checkbox' checked={form.isFailedDelivery} onChange={e=>setForm({...form,isFailedDelivery:e.target.checked})} className='w-4 h-4 accent-gray-500' />
                <span className='text-sm text-white'>❌ Failed Delivery</span>
              </label>
            </div>
          </div>
          <div className='flex gap-3 mt-4'>
            <button onClick={saveOrder} disabled={saving} className='px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium'>{saving ? 'Saving...' : 'Save Order'}</button>
            <button onClick={() => { setForm(emptyForm); setShowForm(false) }} className='px-5 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm'>Cancel</button>
          </div>
        </div>
      )}

      <div className='flex gap-3 mb-4 flex-wrap'>
        <input type='text' placeholder='Search by name, phone, order ID...' value={search} onChange={e=>setSearch(e.target.value)} className='bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm flex-1 min-w-48 outline-none focus:border-violet-500' />
        {['All','Pending','Confirmed','Processing','Delivered','Cancelled','SameDay','Exchange','CancelledDoor','Failed'].map(s => (
          <button key={s} onClick={()=>setFilter(s)} className={'px-3 py-2 rounded-xl text-xs font-medium transition-all '+(filter===s?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>
            {s === 'SameDay' ? '⚡ Same Day' : s === 'Exchange' ? '🔄 Exchange' : s === 'CancelledDoor' ? '🚪 At Door' : s === 'Failed' ? '❌ Failed' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className='text-center py-20 text-gray-400'>Loading orders...</div>
      ) : (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-800'>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Order</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Customer</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Product</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Pricing</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Shipping</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Campaign</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Status</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Flags</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Courier</th>
                <th className='text-left text-gray-400 font-medium px-4 py-3'>Update</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className='border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors'>
                  <td className='px-4 py-3'>
                    <p className='text-white font-medium'>{o.orderId}</p>
                    <p className='text-gray-500 text-xs'>{new Date(o.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className='px-4 py-3'>
                    <p className='text-white'>{o.customerName}</p>
                    <p className='text-gray-400 text-xs mb-1'>{o.phone}</p>
                    <CustomerMessageDrawer customerName={o.customerName} phone={o.phone} senderId={o.senderId} />
                  </td>
                  <td className='px-4 py-3'>
                    <p className='text-white'>{o.product}</p>
                    <p className='text-gray-400 text-xs'>Qty: {o.quantity}</p>
                  </td>
                  <td className='px-4 py-3'>
                    <p className='text-white text-xs'>Sale: Rs {o.price?.toLocaleString()}</p>
                    {o.costPrice && <p className='text-gray-400 text-xs'>Cost: Rs {o.costPrice?.toLocaleString()}</p>}
                    {o.costPrice && <p className='text-emerald-400 text-xs'>Profit: Rs {((o.price - o.costPrice) * o.quantity)?.toLocaleString()}</p>}
                  </td>
                  <td className='px-4 py-3'>
                    {o.shippingCharge && <p className='text-red-400 text-xs'>Courier: Rs {o.shippingCharge}</p>}
                    {o.customerShippingCharge !== null && o.customerShippingCharge !== undefined && <p className='text-blue-400 text-xs'>Customer: Rs {o.customerShippingCharge}</p>}
                  </td>
                  <td className='px-4 py-3'>
                    {o.campaignId ? (
                      <p className='text-violet-400 text-xs'>{campaigns.find(c => c.id === o.campaignId)?.name || o.campaignId}</p>
                    ) : <p className='text-gray-600 text-xs'>-</p>}
                    {o.adId && <p className='text-gray-500 text-xs'>Ad: {o.adId}</p>}
                  </td>
                  <td className='px-4 py-3'><span className={'text-xs px-2 py-1 rounded-full '+(statusColors[o.status]||'')}>{o.status}</span></td>
                  <td className='px-4 py-3'>
                    <div className='flex flex-col gap-1'>
                      <label className='flex items-center gap-1.5 cursor-pointer'>
                        <input type='checkbox' checked={o.isSameDay||false} onChange={e=>toggleFlag(o.id,'isSameDay',e.target.checked)} className='w-3 h-3 accent-orange-500' />
                        <span className='text-xs text-gray-400'>⚡ Same Day</span>
                      </label>
                      <label className='flex items-center gap-1.5 cursor-pointer'>
                        <input type='checkbox' checked={o.isCancelledAtDoor||false} onChange={e=>toggleFlag(o.id,'isCancelledAtDoor',e.target.checked)} className='w-3 h-3 accent-red-500' />
                        <span className='text-xs text-gray-400'>🚪 At Door</span>
                      </label>
                      <label className='flex items-center gap-1.5 cursor-pointer'>
                        <input type='checkbox' checked={o.isExchange||false} onChange={e=>toggleFlag(o.id,'isExchange',e.target.checked)} className='w-3 h-3 accent-blue-500' />
                        <span className='text-xs text-gray-400'>🔄 Exchange</span>
                      </label>
                      <label className='flex items-center gap-1.5 cursor-pointer'>
                        <input type='checkbox' checked={o.isFailedDelivery||false} onChange={e=>toggleFlag(o.id,'isFailedDelivery',e.target.checked)} className='w-3 h-3 accent-gray-500' />
                        <span className='text-xs text-gray-400'>❌ Failed</span>
                      </label>
                    </div>
                  </td>
                  <td className='px-4 py-3'><p className='text-white text-xs'>{o.courier||'-'}</p><p className='text-gray-400 text-xs'>{o.trackingNo||''}</p></td>
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
      <div className='mt-4 flex gap-4 text-sm text-gray-400 flex-wrap'>
        <span>Total: <span className='text-white font-medium'>{filtered.length}</span></span>
        <span>Revenue: <span className='text-white font-medium'>Rs {filtered.reduce((a,o)=>a+(o.price*o.quantity),0).toLocaleString()}</span></span>
        <span>Profit: <span className='text-emerald-400 font-medium'>Rs {filtered.filter(o=>o.costPrice).reduce((a,o)=>a+((o.price-o.costPrice)*o.quantity),0).toLocaleString()}</span></span>
        <span>Same Day: <span className='text-orange-400 font-medium'>{filtered.filter(o=>o.isSameDay).length}</span></span>
        <span>At Door: <span className='text-red-400 font-medium'>{filtered.filter(o=>o.isCancelledAtDoor).length}</span></span>
        <span>Failed: <span className='text-gray-400 font-medium'>{filtered.filter(o=>o.isFailedDelivery).length}</span></span>
      </div>
    </div>
  )
}