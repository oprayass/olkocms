'use client'
import { useState } from 'react'

const mock = [
  { id:1, name:'Ram Bahadur', phone:'9841000001', platform:'FB', lastMsg:'Jacket ko price sodheko', date:'2026-05-20', status:'Overdue', notes:'Interested in jacket' },
  { id:2, name:'Gita Kumari', phone:'9841000004', platform:'IG', lastMsg:'Delivery sodhyo', date:'2026-05-21', status:'Today', notes:'Waiting for delivery' },
  { id:3, name:'Sunita Tamang', phone:'9841000006', platform:'WA', lastMsg:'Discount maageko', date:'2026-05-22', status:'Upcoming', notes:'Offer 10% discount' },
  { id:4, name:'Dipak Rai', phone:'9841000007', platform:'FB', lastMsg:'Product hereko', date:'2026-05-19', status:'Overdue', notes:'Interested in shoes' },
]

const ss: Record<string,string> = {
  Overdue:'bg-red-500/20 text-red-400 border border-red-500/30',
  Today:'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Upcoming:'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Done:'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
}
const ps: Record<string,string> = { FB:'bg-blue-600', IG:'bg-pink-600', WA:'bg-emerald-600' }

export default function FollowupsPage() {
  const [items, setItems] = useState(mock)
  const [filter, setFilter] = useState('All')
  const filtered = items.filter(f => filter === 'All' || f.status === filter)
  const markDone = (id: number) => setItems(items.map(f => f.id === id ? {...f, status:'Done'} : f))
  const counts = {
    Overdue: items.filter(f => f.status==='Overdue').length,
    Today: items.filter(f => f.status==='Today').length,
    Upcoming: items.filter(f => f.status==='Upcoming').length,
    Done: items.filter(f => f.status==='Done').length,
  }
  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Follow-ups</h1>
          <p className='text-gray-400 mt-1'>Track customer follow-ups</p>
        </div>
      </div>
      <div className='grid grid-cols-4 gap-4 mb-6'>
        {[
          {l:'Overdue', c:counts.Overdue, g:'from-red-600 to-red-800', i:'⚠️'},
          {l:'Today', c:counts.Today, g:'from-amber-500 to-amber-700', i:'🔔'},
          {l:'Upcoming', c:counts.Upcoming, g:'from-blue-500 to-blue-700', i:'📅'},
          {l:'Done', c:counts.Done, g:'from-emerald-500 to-emerald-700', i:'✅'},
        ].map(s => (
          <div key={s.l} onClick={() => setFilter(s.l)} className={'bg-gradient-to-br '+s.g+' rounded-2xl p-4 cursor-pointer'}>
            <div className='text-2xl mb-1'>{s.i}</div>
            <div className='text-2xl font-bold text-white'>{s.c}</div>
            <div className='text-sm text-white/70'>{s.l}</div>
          </div>
        ))}
      </div>
      <div className='flex gap-2 mb-4'>
        {['All','Overdue','Today','Upcoming','Done'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={'px-3 py-1.5 rounded-xl text-xs font-medium transition-all '+(filter===f?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700')}>{f}</button>
        ))}
      </div>
      <div className='space-y-3'>
        {filtered.map(f => (
          <div key={f.id} className='bg-gray-900 rounded-2xl border border-gray-800 p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className={'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold '+ps[f.platform]}>{f.platform}</div>
                <div>
                  <p className='text-white font-medium'>{f.name}</p>
                  <p className='text-gray-400 text-xs'>{f.phone}</p>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-gray-500'>📅 {f.date}</span>
                <span className={'text-xs px-2 py-1 rounded-full '+ss[f.status]}>{f.status}</span>
              </div>
            </div>
            <div className='mt-3 pl-12'>
              <p className='text-gray-400 text-sm'>💬 {f.lastMsg}</p>
              <p className='text-gray-500 text-xs mt-1'>📝 {f.notes}</p>
            </div>
            <div className='mt-3 pl-12 flex gap-2'>
              <button onClick={() => markDone(f.id)} className='px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs'>✅ Mark Done</button>
              <a href={'tel:'+f.phone} className='px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs'>📞 Call</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}