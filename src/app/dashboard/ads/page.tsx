'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const platformColors: Record<string, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-600',
  tiktok: 'bg-gray-800',
}

const statusStyle: Record<string, string> = {
  Active: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Paused: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Ended: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('campaigns')
  const [showAdd, setShowAdd] = useState(false)
  const [showExpense, setShowExpense] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', platform: 'facebook', budget: '', productId: '' })
  const [expenseForm, setExpenseForm] = useState({ type: 'Daily Ad Spend', amount: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCampaigns() }, [])

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/ad-campaigns')
      const data = await res.json()
      setCampaigns(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const addCampaign = async () => {
    if (!form.name || !form.budget) return
    setSaving(true)
    try {
      await fetch('/api/ad-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget: parseFloat(form.budget) })
      })
      setForm({ name: '', platform: 'facebook', budget: '', productId: '' })
      setShowAdd(false)
      fetchCampaigns()
    } finally { setSaving(false) }
  }

  const addExpense = async (campaignId: string) => {
    if (!expenseForm.amount) return
    setSaving(true)
    try {
      await fetch('/api/ad-campaigns/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, ...expenseForm, amount: parseFloat(expenseForm.amount) })
      })
      setExpenseForm({ type: 'Daily Ad Spend', amount: '', description: '' })
      setShowExpense(null)
      fetchCampaigns()
    } finally { setSaving(false) }
  }

  const toggleStatus = async (id: string, status: string) => {
    const newStatus = status === 'Active' ? 'Paused' : 'Active'
    await fetch(`/api/ad-campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    fetchCampaigns()
  }

  const totalBudget = campaigns.reduce((a, c) => a + (c.budget || 0), 0)
  const totalSpent = campaigns.reduce((a, c) => a + (c.spent || 0), 0)
  const totalRevenue = campaigns.reduce((a, c) => a + (c.orders?.reduce((x: number, o: any) => x + (o.revenue || 0), 0) || 0), 0)
  const overallROAS = totalSpent > 0 ? (totalRevenue / totalSpent).toFixed(2) : '0.00'

  const chartData = campaigns.map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '...' : c.name,
    Spent: c.spent || 0,
    Revenue: c.orders?.reduce((x: number, o: any) => x + (o.revenue || 0), 0) || 0,
    ROAS: c.spent > 0 ? +((c.orders?.reduce((x: number, o: any) => x + (o.revenue || 0), 0) || 0) / c.spent).toFixed(2) : 0,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ad Campaigns</h1>
          <p className="text-gray-400 mt-1">Track your Facebook & Instagram ads performance</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
          {showAdd ? '✕ Cancel' : '+ New Campaign'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Budget', value: `Rs ${totalBudget.toLocaleString()}`, color: 'from-violet-600 to-violet-800' },
          { label: 'Total Spent', value: `Rs ${totalSpent.toLocaleString()}`, color: 'from-red-500 to-red-700' },
          { label: 'Total Revenue', value: `Rs ${totalRevenue.toLocaleString()}`, color: 'from-emerald-500 to-emerald-700' },
          { label: 'Overall ROAS', value: `${overallROAS}x`, color: 'from-blue-500 to-blue-700' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4`}>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-6">
          <h2 className="text-white font-medium mb-4">New Campaign</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-gray-400 text-xs mb-1 block">Campaign Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Jacket Summer Campaign" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Platform</label>
              <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                {['facebook', 'instagram', 'tiktok'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Total Budget (Rs)</label>
              <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                placeholder="10000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addCampaign} disabled={saving}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {['campaigns', 'performance'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={'px-4 py-2 rounded-xl text-sm font-medium transition-all ' + (tab === t ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}>
            {t === 'campaigns' ? '📋 Campaigns' : '📊 Performance'}
          </button>
        ))}
      </div>

      {tab === 'campaigns' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-20 text-gray-400">Loading...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No campaigns yet — create one!</div>
          ) : campaigns.map(c => {
            const revenue = c.orders?.reduce((x: number, o: any) => x + (o.revenue || 0), 0) || 0
            const roas = c.spent > 0 ? (revenue / c.spent).toFixed(2) : '0.00'
            const spentPct = c.budget > 0 ? Math.min((c.spent / c.budget) * 100, 100) : 0
            return (
              <div key={c.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`${platformColors[c.platform] || 'bg-gray-600'} w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold`}>
                      {c.platform.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{c.name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{c.platform} · {new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusStyle[c.status] || statusStyle['Active']}`}>{c.status}</span>
                    <button onClick={() => toggleStatus(c.id, c.status)}
                      className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700 transition-all">
                      {c.status === 'Active' ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => setShowExpense(showExpense === c.id ? null : c.id)}
                      className="text-xs px-3 py-1.5 bg-violet-600/20 text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-600/30 transition-all">
                      + Expense
                    </button>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Budget', value: `Rs ${(c.budget || 0).toLocaleString()}` },
                    { label: 'Spent', value: `Rs ${(c.spent || 0).toLocaleString()}`, color: 'text-red-400' },
                    { label: 'Revenue', value: `Rs ${revenue.toLocaleString()}`, color: 'text-emerald-400' },
                    { label: 'ROAS', value: `${roas}x`, color: parseFloat(roas) >= 2 ? 'text-emerald-400' : 'text-red-400' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-gray-400 text-xs">{m.label}</p>
                      <p className={`text-lg font-bold mt-1 ${m.color || 'text-white'}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Budget Progress */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Budget Used</span>
                    <span>{spentPct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                      style={{ width: `${spentPct}%` }} />
                  </div>
                </div>

                {/* Expense Form */}
                {showExpense === c.id && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                    <p className="text-white text-sm font-medium mb-3">Add Expense</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Type</label>
                        <select value={expenseForm.type} onChange={e => setExpenseForm({ ...expenseForm, type: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm outline-none">
                          {['Daily Ad Spend', 'Boost Post', 'Influencer', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Amount (Rs)</label>
                        <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          placeholder="500" className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">Note</label>
                        <input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                          placeholder="Optional" className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
                      </div>
                    </div>
                    <button onClick={() => addExpense(c.id)} disabled={saving}
                      className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm disabled:opacity-50">
                      {saving ? 'Saving...' : 'Add Expense'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'performance' && (
        <div className="space-y-5">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-white font-medium mb-4">Spent vs Revenue by Campaign</h3>
            {chartData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="Spent" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Revenue" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-white font-medium mb-4">ROAS by Campaign</h3>
            {chartData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="ROAS" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}