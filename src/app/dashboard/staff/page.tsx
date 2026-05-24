'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Staff {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  status: string
  joinDate?: string
  subscriptionId?: string
  canViewDashboard: boolean
  canViewOrders: boolean
  canConfirmOrders: boolean
  canViewMessages: boolean
  canReplyMessages: boolean
  canViewStaff: boolean
  canManageStaff: boolean
  canViewCourier: boolean
  canManageCourier: boolean
  canViewReports: boolean
  canViewPnL: boolean
  canCreateContent: boolean
  canPostContent: boolean
  canViewSettings: boolean
  canManageDaraz: boolean
}

const roleColors: Record<string, string> = {
  Manager: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
  Sales: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Support: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Admin: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
}

const permLabels: { key: keyof Staff; label: string }[] = [
  { key: 'canViewDashboard', label: 'Dashboard हेर्ने' },
  { key: 'canViewOrders', label: 'Orders हेर्ने' },
  { key: 'canConfirmOrders', label: 'Order confirm गर्ने' },
  { key: 'canViewMessages', label: 'Messages हेर्ने' },
  { key: 'canReplyMessages', label: 'Messages reply गर्ने' },
  { key: 'canViewStaff', label: 'Staff हेर्ने' },
  { key: 'canManageStaff', label: 'Staff manage गर्ने' },
  { key: 'canViewCourier', label: 'Courier हेर्ने' },
  { key: 'canManageCourier', label: 'Courier manage गर्ने' },
  { key: 'canViewReports', label: 'Reports हेर्ने' },
  { key: 'canViewPnL', label: 'P&L हेर्ने' },
  { key: 'canCreateContent', label: 'Content बनाउने' },
  { key: 'canPostContent', label: 'Content post गर्ने' },
  { key: 'canViewSettings', label: 'Settings हेर्ने' },
  { key: 'canManageDaraz', label: 'Daraz manage गर्ने' },
]

export default function StaffPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const role = user?.role || 'staff'
  const subscriptionId = user?.subscriptionId || null
  const isAdmin = role === 'admin'
  const isSubAdmin = role === 'subscriber_admin'

  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Sales', password: '' })
  const [saving, setSaving] = useState(false)

  const fetchStaff = async () => {
    try {
      const url = isAdmin ? '/api/staff' : `/api/staff?subscriptionId=${subscriptionId}`
      const res = await fetch(url)
      const data = await res.json()
      setStaff(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  const addStaff = async () => {
    if (!form.name || !form.email) return
    setSaving(true)
    try {
      const body = isSubAdmin ? { ...form, subscriptionId } : form
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setForm({ name: '', email: '', phone: '', role: 'Sales', password: '' })
        setShowAdd(false)
        fetchStaff()
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    await fetch(`/api/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: currentStatus === 'Active' ? 'Inactive' : 'Active' })
    })
    fetchStaff()
  }

  const togglePermission = async (id: string, key: string, value: boolean) => {
    await fetch(`/api/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: !value })
    })
    fetchStaff()
  }

  const deleteStaff = async (id: string) => {
    await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchStaff()
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Staff</h1>
          <p className="text-gray-400 text-sm">
            {isAdmin ? 'All staff management' : 'Your business team'}
          </p>
        </div>
        {(isAdmin || isSubAdmin) && (
          <button onClick={() => setShowAdd(!showAdd)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + Add Staff
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: staff.length, color: 'from-violet-600 to-violet-800' },
          { label: 'Active', value: staff.filter(s => s.status === 'Active').length, color: 'from-emerald-500 to-emerald-700' },
          { label: 'Inactive', value: staff.filter(s => s.status === 'Inactive').length, color: 'from-gray-600 to-gray-800' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/70">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Subscriber Admin info banner */}
      {isSubAdmin && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 text-xs text-orange-300">
          🏢 तपाईंको business का staff मात्र देखिन्छ — आफ्नो team add/manage गर्नुस्
        </div>
      )}

      {showAdd && (isAdmin || isSubAdmin) && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-5">
          <h2 className="text-white font-medium mb-3">New Staff थप्नुस्</h2>
          <div className="space-y-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full Name *" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email *" type="email" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password" type="password" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
              {['Sales', 'Support', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addStaff} disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Staff'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-10">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          {isSubAdmin ? 'तपाईंको business मा अझै staff छैन' : 'No staff added yet'}
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map(s => (
            <div key={s.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <p className="text-white font-medium text-sm">{s.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[s.role] || roleColors['Sales']}`}>{s.role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>{s.status}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{s.email}</p>
                  {s.phone && <p className="text-gray-500 text-xs">{s.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="py-2 rounded-xl text-xs font-medium bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30">
                  {expandedId === s.id ? 'Hide' : 'Permissions'}
                </button>
                <button onClick={() => toggleStatus(s.id, s.status)}
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${s.status === 'Active' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                  {s.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => setDeleteConfirm(s.id)}
                  className="py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
                  Remove
                </button>
              </div>

              {expandedId === s.id && (
                <div className="mt-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
                  <p className="text-gray-400 text-xs font-medium mb-3">Permissions</p>
                  <div className="grid grid-cols-1 gap-2">
                    {permLabels.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-gray-300 text-xs">{label}</span>
                        <button onClick={() => togglePermission(s.id, key, s[key] as boolean)}
                          className={`relative w-10 h-5 rounded-full transition-all ${s[key] ? 'bg-violet-600' : 'bg-gray-700'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s[key] ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deleteConfirm === s.id && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-xs mb-2">"{s.name}" लाई remove गर्ने?</p>
                  <div className="flex gap-2">
                    <button onClick={() => deleteStaff(s.id)} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs">Yes, Remove</button>
                    <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}