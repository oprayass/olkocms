'use client'
import { useState, useEffect } from 'react'

const statusStyle: Record<string, string> = {
  Trial: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Expired: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Cancelled: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

const planColors: Record<string, string> = {
  Starter: 'from-blue-500 to-blue-700',
  Growth: 'from-violet-600 to-violet-800',
  Pro: 'from-amber-500 to-amber-700',
}

const emptyForm = {
  businessName: '', email: '', phone: '',
  planId: '', billingCycle: 'monthly',
}

const emptyPayment = {
  subscriptionId: '', amount: '', method: 'eSewa', reference: '', billingCycle: 'monthly',
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('list')
  const [showForm, setShowForm] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('All')
  const [selectedSub, setSelectedSub] = useState<any>(null)

  const fetchAll = () => {
    Promise.all([
      fetch('/api/subscriptions').then(r => r.json()),
      fetch('/api/plans').then(r => r.json()),
    ]).then(([s, p]) => {
      setSubs(Array.isArray(s) ? s : [])
      setPlans(Array.isArray(p) ? p : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchAll() }, [])

  const saveSub = async () => {
    if (!form.businessName || !form.email || !form.planId) return
    setSaving(true)
    await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    fetchAll()
  }

  const savePayment = async () => {
    if (!paymentForm.subscriptionId || !paymentForm.amount) return
    setSaving(true)
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...paymentForm, amount: parseFloat(paymentForm.amount) })
    })
    setPaymentForm(emptyPayment)
    setShowPayment(false)
    setSaving(false)
    fetchAll()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    fetchAll()
  }

  const filtered = subs.filter(s => filter === 'All' || s.status === filter)

  const totalMRR = subs
    .filter(s => s.status === 'Active')
    .reduce((a, s) => a + (s.billingCycle === 'yearly' ? s.plan?.priceYearly / 12 : s.plan?.priceMonthly), 0)

  const daysLeft = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / 86400000))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <p className="text-gray-400 mt-1">Manage client subscriptions and payments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowPayment(!showPayment); setShowForm(false) }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            💳 Record Payment
          </button>
          <button onClick={() => { setShowForm(!showForm); setShowPayment(false) }} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + New Subscription
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Clients', value: subs.length, icon: '🏢', color: 'from-violet-600 to-violet-800' },
          { label: 'Active', value: subs.filter(s => s.status === 'Active').length, icon: '✅', color: 'from-emerald-500 to-emerald-700' },
          { label: 'Trial', value: subs.filter(s => s.status === 'Trial').length, icon: '⏳', color: 'from-blue-500 to-blue-700' },
          { label: 'MRR', value: 'Rs ' + Math.round(totalMRR).toLocaleString(), icon: '💰', color: 'from-amber-500 to-amber-700' },
        ].map(s => (
          <div key={s.label} className={'bg-gradient-to-br ' + s.color + ' rounded-2xl p-4'}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {plans.map(p => {
          const planSubs = subs.filter(s => s.planId === p.id)
          const active = planSubs.filter(s => s.status === 'Active').length
          return (
            <div key={p.id} className={'bg-gradient-to-br ' + (planColors[p.name] || 'from-gray-600 to-gray-800') + ' rounded-2xl p-4'}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-lg">{p.name}</span>
                <span className="text-white/70 text-sm">Rs {p.priceMonthly.toLocaleString()}/mo</span>
              </div>
              <div className="text-3xl font-bold text-white">{planSubs.length}</div>
              <div className="text-white/70 text-xs mt-1">{active} active · {planSubs.length - active} trial/other</div>
            </div>
          )
        })}
      </div>

      {/* New Subscription Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-5">
          <h2 className="text-white font-medium mb-4">New Subscription</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Business Name *</label>
              <input value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} placeholder="Nepali Babu Store" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Email *</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="store@gmail.com" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="9841000000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Plan *</label>
              <select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                <option value="">Select Plan</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — Rs {p.priceMonthly}/mo</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Billing Cycle</label>
              <select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly (2 months free)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveSub} disabled={saving} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
              {saving ? 'Saving...' : 'Create Subscription (14 day trial)'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="px-5 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Payment Form */}
      {showPayment && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-5">
          <h2 className="text-white font-medium mb-4">Record Payment</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Client *</label>
              <select value={paymentForm.subscriptionId} onChange={e => {
                const sub = subs.find(s => s.id === e.target.value)
                setPaymentForm({ ...paymentForm, subscriptionId: e.target.value, billingCycle: sub?.billingCycle || 'monthly', amount: sub?.billingCycle === 'yearly' ? sub?.plan?.priceYearly : sub?.plan?.priceMonthly })
              }} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                <option value="">Select Client</option>
                {subs.filter(s => s.status !== 'Cancelled').map(s => (
                  <option key={s.id} value={s.id}>{s.businessName} — {s.plan?.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Amount (Rs) *</label>
              <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="999" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Payment Method</label>
              <select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none">
                {['eSewa', 'Khalti', 'Bank Transfer', 'Cash'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Reference No</label>
              <input value={paymentForm.reference} onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder="TXN123456" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={savePayment} disabled={saving} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
              {saving ? 'Saving...' : '💳 Confirm Payment'}
            </button>
            <button onClick={() => { setShowPayment(false); setPaymentForm(emptyPayment) }} className="px-5 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['All', 'Trial', 'Active', 'Expired', 'Cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={'px-3 py-2 rounded-xl text-xs font-medium transition-all ' + (filter === f ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}>{f}</button>
        ))}
      </div>

      {/* Subscriptions List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No subscriptions yet</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-white font-semibold">{s.businessName}</p>
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (planColors[s.plan?.name] ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-gray-500/20 text-gray-400')}>{s.plan?.name}</span>
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (statusStyle[s.status] || '')}>{s.status}</span>
                    {s.status === 'Trial' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        ⏰ {daysLeft(s.trialEndsAt)} days left
                      </span>
                    )}
                    {s.status === 'Active' && (
                      <span className="text-xs text-gray-500">
                        renews {new Date(s.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs">{s.email} {s.phone ? '· ' + s.phone : ''}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Rs {s.billingCycle === 'yearly' ? s.plan?.priceYearly?.toLocaleString() + '/yr' : s.plan?.priceMonthly?.toLocaleString() + '/mo'}
                    {' · '}{s.billingCycle}
                    {s.payments?.length > 0 && ' · Last paid: ' + new Date(s.payments[0]?.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <select value={s.status} onChange={e => updateStatus(s.id, e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-2 py-1 text-xs outline-none">
                    {['Trial', 'Active', 'Expired', 'Cancelled'].map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}