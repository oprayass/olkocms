'use client'
import { useState } from 'react'

const mockStaff = [
  { id:1, name:'Suman Shrestha', email:'suman@olkocms.com', phone:'9841111001', role:'Manager', status:'Active', orders:45, messages:120, joinDate:'2025-01-15' },
  { id:2, name:'Priya Maharjan', email:'priya@olkocms.com', phone:'9841111002', role:'Sales', status:'Active', orders:32, messages:89, joinDate:'2025-03-20' },
  { id:3, name:'Rohan Tamang', email:'rohan@olkocms.com', phone:'9841111003', role:'Support', status:'Active', orders:18, messages:210, joinDate:'2025-06-10' },
  { id:4, name:'Anisha Karki', email:'anisha@olkocms.com', phone:'9841111004', role:'Sales', status:'Inactive', orders:27, messages:65, joinDate:'2025-02-01' },
]

const roleColors: Record<string,string> = {
  Manager:'bg-violet-500/20 text-violet-400 border border-violet-500/30',
  Sales:'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Support:'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Admin:'bg-amber-500/20 text-amber-400 border border-amber-500/30',
}

export default function StaffPage() {
  const [staff, setStaff] = useState(mockStaff)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', phone:'', role:'Sales' })

  const addStaff = () => {
    if (!form.name || !form.email) return
    setStaff([...staff, { id: staff.length+1, ...form, status:'Active', orders:0, messages:0, joinDate: new Date().toISOString().split('T')[0] }])
    setForm({ name:'', email:'', phone:'', role:'Sales' })
    setShowAdd(false)
  }

  const toggleStatus = (id: number) => {
    setStaff(staff.map(s => s.id === id ? {...s, status: s.status==='Active'?'Inactive':'Active'} : s))
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Staff</h1>
          <p className='text-gray-400 mt-1'>Manage your team members</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className='bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all'>+ Add Staff</button>
      </div>

      <div className='grid grid-cols-3 gap-4 mb-6'>
        {[
          { label:'Total Staff', value: staff.length, icon:'👥', color:'from-violet-600 to-violet-800' },
          { label:'Active', value: staff.filter(s=>s.status==='Active').length, icon:'✅', color:'from-emerald-500 to-emerald-700' },
          { label:'Inactive', value: staff.filter(s=>s.status==='Inactive').length, icon:'⏸️', color:'from-gray-600 to-gray-800' },
        ].map(s => (
          <div key={s.label} className={'bg-gradient-to-br '+s.color+' rounded-2xl p-4'}>
            <div className='text-2xl mb-1'>{s.icon}</div>
            <div className='text-2xl font-bold text-white'>{s.value}</div>
            <div className='text-sm text-white/70'>{s.label}</div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-6'>
          <h2 className='text-white font-medium mb-4'>Add New Staff</h2>
          <div className='grid grid-cols-2 gap-3'>
            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder='Full Name' className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder='Email' className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder='Phone' className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className='bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
              {['Sales','Support','Manager','Admin'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className='flex gap-2 mt-3'>
            <button onClick={addStaff} className='px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm'>Add Staff</button>
            <button onClick={() => setShowAdd(false)} className='px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm'>Cancel</button>
          </div>
        </div>
      )}

      <div className='space-y-3'>
        {staff.map(s => (
          <div key={s.id} className='bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center gap-4'>
            <div className='w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0'>
              {s.name.charAt(0)}
            </div>
            <div className='flex-1'>
              <div className='flex items-center gap-2 mb-1'>
                <p className='text-white font-medium'>{s.name}</p>
                <span className={'text-xs px-2 py-0.5 rounded-full '+roleColors[s.role]}>{s.role}</span>
                <span className={'text-xs px-2 py-0.5 rounded-full '+(s.status==='Active'?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30':'bg-gray-500/20 text-gray-400 border border-gray-500/30')}>{s.status}</span>
              </div>
              <p className='text-gray-400 text-xs'>{s.email} • {s.phone}</p>
              <p className='text-gray-500 text-xs mt-1'>Joined: {s.joinDate}</p>
            </div>
            <div className='flex gap-4 text-center'>
              <div>
                <p className='text-white font-bold'>{s.orders}</p>
                <p className='text-gray-500 text-xs'>Orders</p>
              </div>
              <div>
                <p className='text-white font-bold'>{s.messages}</p>
                <p className='text-gray-500 text-xs'>Messages</p>
              </div>
            </div>
            <button onClick={() => toggleStatus(s.id)} className={'px-3 py-1.5 rounded-lg text-xs transition-all '+(s.status==='Active'?'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30':'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30')}>
              {s.status==='Active'?'Deactivate':'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}