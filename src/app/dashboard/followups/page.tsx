'use client'
import { useState, useEffect } from 'react'

const ss: Record<string,string> = {
  Overdue:'bg-red-500/20 text-red-400 border border-red-500/30',
  Today:'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Upcoming:'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Done:'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
}
const ps: Record<string,string> = { FB:'bg-blue-600', IG:'bg-pink-600', WA:'bg-emerald-600' }

export default function FollowupsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ customerName:'', phone:'', platform:'FB', lastMsg:'', followupDate:'', notes:'' })

  useEffect(() => {
    fetch('/api/followups')
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = items.filter(f => filter === 'All' || f.status === filter)

  const markDone = async (id: string) => {
    await fetch('/api/followups/'+id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status:'Done' }) })
    setItems(items.map(f => f.id === id ? {...f, status:'Done'} : f))
  }

  const addFollowup = async () => {
    if (!form.customerName || !form.phone || !form.followupDate) return
    const today = new Date().toISOString().split('T')[0]
    const status = form.followupDate < today ? 'Overdue' : form.followupDate === today ? 'Today' : 'Upcoming'
    const res = await fetch('/api/followups', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...form, status}) })
    const newItem = await res.json()
    setItems([newItem, ...items])
    setForm({ customerName:'', phone:'', platform:'FB', lastMsg:'', followupDate:'', notes:'' })
    setShowAdd(false)
  }

  const counts = {
    Overdue: items.filter(f=>f.status==='Overdue').length,
    Today: items.filter(f=>f.status==='Today').length,
    Upcoming: items.filter(f=>f.status==='Upcoming').length,
    Done: items.filter(f=>f.status==='Done').length,
  }

  if (loading) return <div className='text-center py-20 text-gray-400'>⏳ Loading...</div>

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div><h1 className='text-2xl font-bold text-white'>Follow-ups</h1><p className='text-gray-400 mt-1'>Track customer follow-ups</p></div>
        <button onClick={() => setShowAdd(!showAdd)} className='bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all'>{showAdd ? '✕ Cancel' : '+ Add Follow-up'}</button>
      </div>

      {showAdd && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-5'>
          <h2 className='text-white font-medium mb-4'>New Follow-up</h2>
          <div className='grid grid-cols-3 gap-3'>
            {[{l:'Customer Name',k:'customerName',p:'Ram Bahadur'},{l:'Phone',k:'phone',p:'9841000000'},{l:'Last Message',k:'lastMsg',p:'Jacket ko price sodheko'},{l:'Notes',k:'notes',p:'Interested in jacket'}].map(f=>(
              <div key={f.k}>
                <label className='text-gray-400 text-xs mb-1 block'>{f.l}</label>
                <input value={form[f.k as keyof typeof form]} onChange={e=>setForm({...form,[f.k]:e.target.value})} placeholder={f.p} className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
              </div>
            ))}
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Platform</label>
              <select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                {['FB','IG','WA'].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className='text-gray-400 text-xs mb-1 block'>Follow-up Date</label>
              <input type='date' value={form.followupDate} onChange={e=>setForm({...form,followupDate:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            </div>
          </div>
          <button onClick={addFollowup} className='mt-4 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm'>💾 Save</button>
        </div>
      )}

      <div className='grid grid-cols-4 gap-4 mb-5'>
        {[{l:'Overdue',c:counts.Overdue,g:'from-red-600 to-red-800',i:'⚠️'},{l:'Today',c:counts.Today,g:'from-amber-500 to-amber-700',i:'🔔'},{l:'Upcoming',c:counts.Upcoming,g:'from-blue-500 to-blue-700',i:'📅'},{l:'Done',c:counts.Done,g:'from-emerald-500 to-emerald-700',i:'✅'}].map(s=>(
          <div key={s.l} onClick={()=>setFilter(s.l)} className={'bg-gradient-to-br '+s.g+' rounded-2xl p-4 cursor-pointer'}>
            <div className='text-2xl mb-1'>{s.i}</div>
            <div className='text-2xl font-bold text-white'>{s.c}</div>
            <div className='text-sm text-white/70'>{s.l}</div>
          </div>
        ))}
      </div>

      <div className='flex gap-2 mb-4'>
        {['All','Overdue','Today','Upcoming','Done'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={'px-3 py-1.5 rounded-xl text-xs font-medium transition-all '+(filter===f?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{f}</button>
        ))}
      </div>

      <div className='space-y-3'>
        {filtered.map(f=>(
          <div key={f.id} className='bg-gray-900 rounded-2xl border border-gray-800 p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className={'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold '+(ps[f.platform]||'bg-gray-600')}>{f.platform}</div>
                <div><p className='text-white font-medium'>{f.customerName}</p><p className='text-gray-400 text-xs'>{f.phone}</p></div>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-gray-500'>📅 {f.followupDate}</span>
                <span className={'text-xs px-2 py-1 rounded-full '+ss[f.status]}>{f.status}</span>
              </div>
            </div>
            <div className='mt-3 pl-12'>
              <p className='text-gray-400 text-sm'>💬 {f.lastMsg}</p>
              <p className='text-gray-500 text-xs mt-1'>📝 {f.notes}</p>
            </div>
            <div className='mt-3 pl-12 flex gap-2'>
              <button onClick={()=>markDone(f.id)} className='px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs'>✅ Mark Done</button>
              <a href={'tel:'+f.phone} className='px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs'>📞 Call</a>
            </div>
          </div>
        ))}
        {filtered.length===0 && <div className='text-center py-12 text-gray-500'>No followups found</div>}
      </div>
    </div>
  )
}