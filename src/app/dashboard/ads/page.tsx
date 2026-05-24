'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('campaigns')
  const [showAdd, setShowAdd] = useState(false)
  const [showExpense, setShowExpense] = useState<string | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [form, setForm] = useState({ name: '', platform: 'facebook', budget: '', adId: '' })
  const [expenseForm, setExpenseForm] = useState({ type: 'Daily Ad Spend', amount: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [campRes, ordRes] = await Promise.all([
        fetch('/api/ad-campaigns'),
        fetch('/api/orders')
      ])
      const campData = await campRes.json()
      const ordData = await ordRes.json()
      setCampaigns(Array.isArray(campData) ? campData : [])
      setOrders(Array.isArray(ordData) ? ordData : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const getCampaignOrders = (campaignId: string) => orders.filter(o => o.campaignId === campaignId)

  const getCampaignStats = (c: any) => {
    const campOrders = getCampaignOrders(c.id)
    const totalOrders = campOrders.length
    const delivered = campOrders.filter(o => o.status === 'Delivered').length
    const cancelled = campOrders.filter(o => o.isCancelledAtDoor).length
    const failed = campOrders.filter(o => o.isFailedDelivery).length
    const exchange = campOrders.filter(o => o.isExchange).length
    const revenue = campOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + (o.price * o.quantity), 0)
    const totalCostPrice = campOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + ((o.costPrice || 0) * o.quantity), 0)
    const totalShipping = campOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + (o.shippingCharge || 0), 0)
    const customerShipping = campOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + (o.customerShippingCharge || 0), 0)
    const adSpent = c.spent || 0
    const netProfit = revenue - totalCostPrice - totalShipping + customerShipping - adSpent
    const roas = adSpent > 0 ? (revenue / adSpent).toFixed(2) : '0.00'
    const deliveryRate = totalOrders > 0 ? ((delivered / totalOrders) * 100).toFixed(0) : '0'
    return { totalOrders, delivered, cancelled, failed, exchange, revenue, totalCostPrice, totalShipping, customerShipping, adSpent, netProfit, roas, deliveryRate }
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
      setForm({ name: '', platform: 'facebook', budget: '', adId: '' })
      setShowAdd(false)
      fetchData()
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
      fetchData()
    } finally { setSaving(false) }
  }

  const toggleStatus = async (id: string, status: string) => {
    await fetch(`/api/ad-campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status === 'Active' ? 'Paused' : 'Active' })
    })
    fetchData()
  }

  // Overall stats
  const totalBudget = campaigns.reduce((a, c) => a + (c.budget || 0), 0)
  const totalSpent = campaigns.reduce((a, c) => a + (c.spent || 0), 0)
  const allCampOrders = orders.filter(o => o.campaignId)
  const totalRevenue = allCampOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + (o.price * o.quantity), 0)
  const totalCost = allCampOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + ((o.costPrice || 0) * o.quantity), 0)
  const totalShip = allCampOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + (o.shippingCharge || 0), 0)
  const totalCustShip = allCampOrders.filter(o => o.status === 'Delivered').reduce((a, o) => a + (o.customerShippingCharge || 0), 0)
  const overallProfit = totalRevenue - totalCost - totalShip + totalCustShip - totalSpent
  const overallROAS = totalSpent > 0 ? (totalRevenue / totalSpent).toFixed(2) : '0.00'

  const chartData = campaigns.map(c => {
    const s = getCampaignStats(c)
    return {
      name: c.name.length > 10 ? c.name.slice(0, 10) + '...' : c.name,
      Spent: c.spent || 0,
      Revenue: s.revenue,
      Profit: s.netProfit,
      ROAS: parseFloat(s.roas),
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ad Campaigns</h1>
          <p className="text-gray-400 mt-1">Track your ads performance & P&L</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
          {showAdd ? '✕ Cancel' : '+ New Campaign'}
        </button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Budget', value: `Rs ${totalBudget.toLocaleString()}`, color: 'from-violet-600 to-violet-800' },
          { label: 'Spent', value: `Rs ${totalSpent.toLocaleString()}`, color: 'from-red-500 to-red-700' },
          { label: 'Revenue', value: `Rs ${totalRevenue.toLocaleString()}`, color: 'from-emerald-500 to-emerald-700' },
          { label: 'Product Cost', value: `Rs ${totalCost.toLocaleString()}`, color: 'from-orange-500 to-orange-700' },
          { label: 'Net Profit', value: `Rs ${overallProfit.toLocaleString()}`, color: overallProfit >= 0 ? 'from-teal-500 to-teal-700' : 'from-red-600 to-red-800' },
          { label: 'ROAS', value: `${overallROAS}x`, color: 'from-blue-500 to-blue-700' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add Campaign Form */}
      {showAdd && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-6">
          <h2 className="text-white font-medium mb-4">New Campaign</h2>
          <div className="grid grid-cols-4 gap-3">
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
              <label className="text-gray-400 text-xs mb-1 block">Budget (Rs)</label>
              <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                placeholder="10000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Facebook Ad ID (optional)</label>
              <input value={form.adId} onChange={e => setForm({ ...form, adId: e.target.value })}
                placeholder="120210..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            </div>
          </div>
          <button onClick={addCampaign} disabled={saving}
            className="mt-4 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Campaign'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {['campaigns', 'performance', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={'px-4 py-2 rounded-xl text-sm font-medium transition-all ' + (tab === t ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}>
            {t === 'campaigns' ? '📋 Campaigns' : t === 'performance' ? '📊 Performance' : '📦 Orders'}
          </button>
        ))}
      </div>

      {/* Campaigns Tab */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          {loading ? <div className="text-center py-20 text-gray-400">Loading...</div>
            : campaigns.length === 0 ? <div className="text-center py-20 text-gray-500">No campaigns yet!</div>
            : campaigns.map(c => {
              const s = getCampaignStats(c)
              const spentPct = c.budget > 0 ? Math.min((c.spent / c.budget) * 100, 100) : 0
              return (
                <div key={c.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`${platformColors[c.platform] || 'bg-gray-600'} w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold`}>
                        {c.platform.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{c.name}</p>
                        <p className="text-gray-400 text-xs">{c.platform} {c.adId && `· Ad: ${c.adId}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`text-xs px-2 py-1 rounded-full ${statusStyle[c.status] || statusStyle['Active']}`}>{c.status}</span>
                      <button onClick={() => toggleStatus(c.id, c.status)}
                        className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-700">
                        {c.status === 'Active' ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => setShowExpense(showExpense === c.id ? null : c.id)}
                        className="text-xs px-3 py-1.5 bg-violet-600/20 text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-600/30">
                        + Expense
                      </button>
                      <button onClick={() => setSelectedCampaign(selectedCampaign?.id === c.id ? null : c)}
                        className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30">
                        {selectedCampaign?.id === c.id ? 'Hide Orders' : 'View Orders'}
                      </button>
                    </div>
                  </div>

                  {/* P&L Grid */}
                  <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
                    {[
                      { label: 'Orders', value: s.totalOrders, color: 'text-white' },
                      { label: 'Delivered', value: s.delivered, color: 'text-emerald-400' },
                      { label: 'At Door', value: s.cancelled, color: 'text-red-400' },
                      { label: 'Failed', value: s.failed, color: 'text-gray-400' },
                      { label: 'Revenue', value: `Rs ${s.revenue.toLocaleString()}`, color: 'text-emerald-400' },
                      { label: 'Ad Spent', value: `Rs ${s.adSpent.toLocaleString()}`, color: 'text-red-400' },
                      { label: 'Shipping', value: `Rs ${(s.totalShipping - s.customerShipping).toLocaleString()}`, color: 'text-orange-400' },
                      { label: 'Net Profit', value: `Rs ${s.netProfit.toLocaleString()}`, color: s.netProfit >= 0 ? 'text-teal-400' : 'text-red-400' },
                    ].map(m => (
                      <div key={m.label} className="bg-gray-800/50 rounded-xl p-2 text-center">
                        <p className="text-gray-500 text-xs">{m.label}</p>
                        <p className={`font-bold text-sm mt-0.5 ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Rate + Budget Progress */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Delivery Rate</span>
                        <span className="text-emerald-400">{s.deliveryRate}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${s.deliveryRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Budget Used</span>
                        <span className={spentPct > 90 ? 'text-red-400' : 'text-gray-400'}>{spentPct.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                          style={{ width: `${spentPct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* ROAS Badge */}
                  <div className="flex gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full ${parseFloat(s.roas) >= 3 ? 'bg-emerald-500/20 text-emerald-400' : parseFloat(s.roas) >= 1.5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                      ROAS: {s.roas}x
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400">
                      {s.delivered}/{s.totalOrders} delivered
                    </span>
                    {s.failed > 0 && <span className="text-xs px-3 py-1 rounded-full bg-gray-700 text-gray-400">{s.failed} failed</span>}
                    {s.cancelled > 0 && <span className="text-xs px-3 py-1 rounded-full bg-red-500/10 text-red-400">{s.cancelled} at door</span>}
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

                  {/* Campaign Orders */}
                  {selectedCampaign?.id === c.id && (
                    <div className="mt-4">
                      <p className="text-white text-sm font-medium mb-3">Orders from this campaign</p>
                      {getCampaignOrders(c.id).length === 0 ? (
                        <p className="text-gray-500 text-sm">कुनै order link भएको छैन — Order page मा campaignId set गर्नुस्</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-700">
                                <th className="text-left text-gray-400 py-2 px-3">Order</th>
                                <th className="text-left text-gray-400 py-2 px-3">Customer</th>
                                <th className="text-left text-gray-400 py-2 px-3">Product</th>
                                <th className="text-left text-gray-400 py-2 px-3">Sale</th>
                                <th className="text-left text-gray-400 py-2 px-3">Cost</th>
                                <th className="text-left text-gray-400 py-2 px-3">Ship</th>
                                <th className="text-left text-gray-400 py-2 px-3">Profit</th>
                                <th className="text-left text-gray-400 py-2 px-3">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getCampaignOrders(c.id).map(o => {
                                const profit = ((o.price - (o.costPrice || 0)) * o.quantity) - (o.shippingCharge || 0) + (o.customerShippingCharge || 0)
                                return (
                                  <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                                    <td className="py-2 px-3 text-gray-300">{o.orderId}</td>
                                    <td className="py-2 px-3 text-gray-300">{o.customerName}</td>
                                    <td className="py-2 px-3 text-gray-400">{o.product}</td>
                                    <td className="py-2 px-3 text-white">Rs {(o.price * o.quantity).toLocaleString()}</td>
                                    <td className="py-2 px-3 text-orange-400">Rs {((o.costPrice || 0) * o.quantity).toLocaleString()}</td>
                                    <td className="py-2 px-3 text-red-400">Rs {(o.shippingCharge || 0)}</td>
                                    <td className={`py-2 px-3 font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Rs {profit.toLocaleString()}</td>
                                    <td className="py-2 px-3">
                                      <span className={`px-2 py-0.5 rounded-full ${o.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-400' : o.isCancelledAtDoor || o.isFailedDelivery ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {o.isFailedDelivery ? 'Failed' : o.isCancelledAtDoor ? 'At Door' : o.status}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Performance Tab */}
      {tab === 'performance' && (
        <div className="space-y-5">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-white font-medium mb-4">Spent vs Revenue vs Profit</h3>
            {chartData.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No data yet</p> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="Spent" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Profit" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
            <h3 className="text-white font-medium mb-4">ROAS by Campaign</h3>
            {chartData.length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No data yet</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="ROAS" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* All Campaign Orders Tab */}
      {tab === 'orders' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-400 font-medium px-4 py-3">Order</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Customer</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Campaign</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Sale</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Cost</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Shipping</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Profit</th>
                <th className="text-left text-gray-400 font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {allCampOrders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">No campaign orders yet</td></tr>
              ) : allCampOrders.map(o => {
                const camp = campaigns.find(c => c.id === o.campaignId)
                const profit = ((o.price - (o.costPrice || 0)) * o.quantity) - (o.shippingCharge || 0) + (o.customerShippingCharge || 0)
                return (
                  <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-4 py-3">
                      <p className="text-white">{o.orderId}</p>
                      <p className="text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{o.customerName}</td>
                    <td className="px-4 py-3 text-violet-400 text-xs">{camp?.name || '-'}</td>
                    <td className="px-4 py-3 text-white">Rs {(o.price * o.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3 text-orange-400">Rs {((o.costPrice || 0) * o.quantity).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <p className="text-red-400 text-xs">Out: Rs {o.shippingCharge || 0}</p>
                      <p className="text-blue-400 text-xs">In: Rs {o.customerShippingCharge || 0}</p>
                    </td>
                    <td className={`px-4 py-3 font-medium ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Rs {profit.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${o.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-400' : o.isCancelledAtDoor || o.isFailedDelivery ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {o.isFailedDelivery ? 'Failed' : o.isCancelledAtDoor ? 'At Door' : o.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}