'use client'
import { useState, useEffect } from 'react'
import { Package, AlertTriangle, CheckCircle, Scan, RefreshCw, Plus, X } from 'lucide-react'

const scanTypeColors: Record<string, string> = {
  inbound: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  return: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  missing: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
}

const alertTypeColors: Record<string, string> = {
  'Customer Return': 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  'Failed Delivery': 'bg-red-500/20 text-red-400 border border-red-500/30',
  'Missing Item': 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
}

const emptyScan = {
  darazOrderId: '', productName: '', scanType: 'inbound', quantity: '1', scannedBy: '', notes: ''
}

const emptyOrder = {
  darazOrderId: '', customerName: '', product: '', quantity: '1', price: '', status: 'Pending', trackingNo: '', returnStatus: '', paymentStatus: ''
}

export default function DarazPage() {
  const [tab, setTab] = useState<'orders' | 'scan' | 'alerts'>('orders')
  const [orders, setOrders] = useState<any[]>([])
  const [scans, setScans] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showScanForm, setShowScanForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [scanForm, setScanForm] = useState(emptyScan)
  const [orderForm, setOrderForm] = useState(emptyOrder)
  const [saving, setSaving] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [search, setSearch] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [o, s, a] = await Promise.all([
        fetch('/api/daraz/orders').then(r => r.json()),
        fetch('/api/daraz/scan').then(r => r.json()),
        fetch('/api/daraz/alerts').then(r => r.json()),
      ])
      setOrders(Array.isArray(o) ? o : [])
      setScans(Array.isArray(s) ? s : [])
      setAlerts(Array.isArray(a) ? a : [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const saveScan = async () => {
    if (!scanForm.darazOrderId || !scanForm.productName) return
    setSaving(true)
    try {
      await fetch('/api/daraz/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scanForm, quantity: parseInt(scanForm.quantity) })
      })
      setScanSuccess(true)
      setScanForm(emptyScan)
      setTimeout(() => setScanSuccess(false), 2000)
      await fetchAll()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const saveOrder = async () => {
    if (!orderForm.darazOrderId || !orderForm.customerName || !orderForm.product) return
    setSaving(true)
    try {
      await fetch('/api/daraz/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderForm, quantity: parseInt(orderForm.quantity), price: parseFloat(orderForm.price) || 0 })
      })
      setOrderForm(emptyOrder)
      setShowOrderForm(false)
      await fetchAll()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const resolveAlert = async (id: string) => {
    await fetch('/api/daraz/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' })
    })
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: 'resolved', resolvedAt: new Date() } : a))
  }

  const unresolvedAlerts = alerts.filter(a => a.status === 'unresolved')

  const filteredOrders = orders.filter(o =>
    o.darazOrderId?.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    o.product?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredScans = scans.filter(s =>
    s.darazOrderId?.toLowerCase().includes(search.toLowerCase()) ||
    s.productName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Daraz</h1>
          <p className='text-gray-400 mt-1'>Daraz orders, scanning and warehouse management</p>
        </div>
        <div className='flex gap-2'>
          <button onClick={fetchAll} className='p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl transition-all'>
            <RefreshCw className='w-4 h-4' />
          </button>
          {tab === 'orders' && (
            <button onClick={() => setShowOrderForm(!showOrderForm)} className='bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all'>
              {showOrderForm ? 'Cancel' : '+ Add Order'}
            </button>
          )}
          {tab === 'scan' && (
            <button onClick={() => setShowScanForm(!showScanForm)} className='bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all'>
              {showScanForm ? 'Cancel' : '+ New Scan'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-4 gap-3 mb-5'>
        {[
          { label: 'Total Orders', value: orders.length, color: 'from-orange-500 to-orange-700' },
          { label: 'Total Scans', value: scans.length, color: 'from-violet-600 to-violet-800' },
          { label: 'Unresolved Alerts', value: unresolvedAlerts.length, color: unresolvedAlerts.length > 0 ? 'from-red-500 to-red-700' : 'from-gray-600 to-gray-800' },
          { label: 'Returns', value: scans.filter(s => s.scanType === 'return').length, color: 'from-amber-500 to-amber-700' },
        ].map(s => (
          <div key={s.label} className={'bg-gradient-to-br ' + s.color + ' rounded-2xl p-3 text-center'}>
            <div className='text-2xl font-bold text-white'>{s.value}</div>
            <div className='text-xs text-white/70 mt-1'>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Unresolved Alert Banner */}
      {unresolvedAlerts.length > 0 && (
        <div className='bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-5 flex items-center gap-3'>
          <AlertTriangle className='w-5 h-5 text-red-400 flex-shrink-0' />
          <div>
            <p className='text-red-400 font-medium text-sm'>{unresolvedAlerts.length} Unresolved Alert{unresolvedAlerts.length > 1 ? 's' : ''}</p>
            <p className='text-red-400/70 text-xs mt-0.5'>
              {unresolvedAlerts.slice(0, 3).map(a => `${a.darazOrderId} (${a.alertType})`).join(' • ')}
              {unresolvedAlerts.length > 3 && ` • +${unresolvedAlerts.length - 3} more`}
            </p>
          </div>
          <button onClick={() => setTab('alerts')} className='ml-auto text-xs text-red-400 hover:text-red-300 border border-red-500/30 px-3 py-1 rounded-lg'>
            View Alerts
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className='flex gap-2 mb-5'>
        {[
          { key: 'orders', label: 'Orders', count: orders.length },
          { key: 'scan', label: 'Scan Log', count: scans.length },
          { key: 'alerts', label: 'Alerts', count: unresolvedAlerts.length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ' +
              (tab === t.key ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}>
            {t.label}
            {t.count > 0 && (
              <span className={'text-xs px-1.5 py-0.5 rounded-full ' +
                (tab === t.key ? 'bg-white/20 text-white' : t.key === 'alerts' && unresolvedAlerts.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-400')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className='mb-4'>
        <input type='text' placeholder='Search orders, products, order ID...' value={search} onChange={e => setSearch(e.target.value)}
          className='w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm outline-none focus:border-violet-500' />
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <>
          {showOrderForm && (
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-5'>
              <h2 className='text-white font-medium mb-4'>Add Daraz Order</h2>
              <div className='grid grid-cols-3 gap-3'>
                {[
                  { l: 'Daraz Order ID', k: 'darazOrderId', p: 'DZR-12345' },
                  { l: 'Customer Name', k: 'customerName', p: 'Ram Bahadur' },
                  { l: 'Product', k: 'product', p: 'Jacket' },
                  { l: 'Price (Rs)', k: 'price', p: '2500' },
                  { l: 'Tracking No', k: 'trackingNo', p: 'TRK001' },
                ].map(f => (
                  <div key={f.k}>
                    <label className='text-gray-400 text-xs mb-1 block'>{f.l}</label>
                    <input value={orderForm[f.k as keyof typeof orderForm] as string} onChange={e => setOrderForm({ ...orderForm, [f.k]: e.target.value })}
                      placeholder={f.p} className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                  </div>
                ))}
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Quantity</label>
                  <input type='number' value={orderForm.quantity} onChange={e => setOrderForm({ ...orderForm, quantity: e.target.value })}
                    className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Status</label>
                  <select value={orderForm.status} onChange={e => setOrderForm({ ...orderForm, status: e.target.value })}
                    className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                    {['Pending', 'Processing', 'Shipped', 'Delivered', 'Returned', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Payment Status</label>
                  <select value={orderForm.paymentStatus} onChange={e => setOrderForm({ ...orderForm, paymentStatus: e.target.value })}
                    className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                    <option value=''>Select</option>
                    {['Pending', 'Paid', 'Refunded'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className='flex gap-3 mt-4'>
                <button onClick={saveOrder} disabled={saving} className='px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium'>
                  {saving ? 'Saving...' : 'Save Order'}
                </button>
                <button onClick={() => setShowOrderForm(false)} className='px-5 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm'>Cancel</button>
              </div>
            </div>
          )}

          <div className='bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-800'>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Daraz Order ID</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Customer</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Product</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Price</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Status</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Payment</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Tracking</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className='text-center py-12 text-gray-500'>Loading...</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr><td colSpan={8} className='text-center py-12 text-gray-500'>No Daraz orders found</td></tr>
                ) : filteredOrders.map(o => (
                  <tr key={o.id} className='border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors'>
                    <td className='px-4 py-3'><p className='text-orange-400 font-medium text-xs'>{o.darazOrderId}</p></td>
                    <td className='px-4 py-3'><p className='text-white text-sm'>{o.customerName}</p></td>
                    <td className='px-4 py-3'>
                      <p className='text-white text-sm'>{o.product}</p>
                      <p className='text-gray-400 text-xs'>Qty: {o.quantity}</p>
                    </td>
                    <td className='px-4 py-3'><p className='text-white text-xs'>Rs {o.price?.toLocaleString()}</p></td>
                    <td className='px-4 py-3'>
                      <span className={`text-xs px-2 py-1 rounded-full ${o.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : o.status === 'Returned' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : o.status === 'Cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className='px-4 py-3'>
                      {o.paymentStatus && <span className={`text-xs px-2 py-1 rounded-full ${o.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : o.paymentStatus === 'Refunded' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>{o.paymentStatus}</span>}
                    </td>
                    <td className='px-4 py-3'><p className='text-gray-400 text-xs'>{o.trackingNo || '-'}</p></td>
                    <td className='px-4 py-3'><p className='text-gray-500 text-xs'>{new Date(o.createdAt).toLocaleDateString()}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Scan Tab */}
      {tab === 'scan' && (
        <>
          {showScanForm && (
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-5'>
              <h2 className='text-white font-medium mb-4'>New Scan</h2>
              {scanSuccess && (
                <div className='flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-4'>
                  <CheckCircle className='w-4 h-4 text-emerald-400' />
                  <p className='text-emerald-400 text-sm'>Scanned successfully!</p>
                </div>
              )}
              <div className='grid grid-cols-3 gap-3'>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Daraz Order ID</label>
                  <input value={scanForm.darazOrderId} onChange={e => setScanForm({ ...scanForm, darazOrderId: e.target.value })}
                    placeholder='DZR-12345' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Product Name</label>
                  <input value={scanForm.productName} onChange={e => setScanForm({ ...scanForm, productName: e.target.value })}
                    placeholder='Jacket' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Scan Type</label>
                  <select value={scanForm.scanType} onChange={e => setScanForm({ ...scanForm, scanType: e.target.value })}
                    className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none'>
                    <option value='inbound'>Inbound (Sent to Daraz)</option>
                    <option value='return'>Customer Return</option>
                    <option value='failed'>Failed Delivery Return</option>
                    <option value='missing'>Missing Item</option>
                  </select>
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Quantity</label>
                  <input type='number' value={scanForm.quantity} onChange={e => setScanForm({ ...scanForm, quantity: e.target.value })}
                    className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Scanned By</label>
                  <input value={scanForm.scannedBy} onChange={e => setScanForm({ ...scanForm, scannedBy: e.target.value })}
                    placeholder='Staff name' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Notes</label>
                  <input value={scanForm.notes} onChange={e => setScanForm({ ...scanForm, notes: e.target.value })}
                    placeholder='Optional notes' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500' />
                </div>
              </div>
              <div className='flex gap-3 mt-4'>
                <button onClick={saveScan} disabled={saving} className='px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium'>
                  {saving ? 'Scanning...' : 'Record Scan'}
                </button>
                <button onClick={() => setShowScanForm(false)} className='px-5 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm'>Cancel</button>
              </div>
            </div>
          )}

          <div className='bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-gray-800'>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Daraz Order ID</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Product</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Scan Type</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Qty</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Scanned By</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Notes</th>
                  <th className='text-left text-gray-400 font-medium px-4 py-3'>Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className='text-center py-12 text-gray-500'>Loading...</td></tr>
                ) : filteredScans.length === 0 ? (
                  <tr><td colSpan={7} className='text-center py-12 text-gray-500'>No scan records found</td></tr>
                ) : filteredScans.map(s => (
                  <tr key={s.id} className='border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors'>
                    <td className='px-4 py-3'><p className='text-orange-400 text-xs font-medium'>{s.darazOrderId}</p></td>
                    <td className='px-4 py-3'><p className='text-white text-sm'>{s.productName}</p></td>
                    <td className='px-4 py-3'>
                      <span className={`text-xs px-2 py-1 rounded-full ${scanTypeColors[s.scanType] || ''}`}>
                        {s.scanType === 'inbound' ? 'Inbound' : s.scanType === 'return' ? 'Return' : s.scanType === 'failed' ? 'Failed' : 'Missing'}
                      </span>
                    </td>
                    <td className='px-4 py-3'><p className='text-white text-sm'>{s.quantity}</p></td>
                    <td className='px-4 py-3'><p className='text-gray-400 text-xs'>{s.scannedBy || '-'}</p></td>
                    <td className='px-4 py-3'><p className='text-gray-400 text-xs'>{s.notes || '-'}</p></td>
                    <td className='px-4 py-3'><p className='text-gray-500 text-xs'>{new Date(s.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='mt-4 flex gap-4 text-sm text-gray-400 flex-wrap'>
            <span>Total Scans: <span className='text-white font-medium'>{scans.length}</span></span>
            <span>Inbound: <span className='text-emerald-400 font-medium'>{scans.filter(s => s.scanType === 'inbound').length}</span></span>
            <span>Returns: <span className='text-amber-400 font-medium'>{scans.filter(s => s.scanType === 'return').length}</span></span>
            <span>Failed: <span className='text-red-400 font-medium'>{scans.filter(s => s.scanType === 'failed').length}</span></span>
            <span>Missing: <span className='text-orange-400 font-medium'>{scans.filter(s => s.scanType === 'missing').length}</span></span>
          </div>
        </>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && (
        <div className='space-y-3'>
          {loading ? (
            <div className='text-center py-12 text-gray-500'>Loading...</div>
          ) : alerts.length === 0 ? (
            <div className='text-center py-12 text-gray-500'>No alerts</div>
          ) : alerts.map(a => (
            <div key={a.id} className={`bg-gray-900 rounded-2xl border p-4 flex items-start gap-4 ${a.status === 'resolved' ? 'border-gray-800 opacity-60' : 'border-red-500/30'}`}>
              <div className='flex-shrink-0 mt-1'>
                {a.status === 'resolved'
                  ? <CheckCircle className='w-5 h-5 text-emerald-400' />
                  : <AlertTriangle className='w-5 h-5 text-red-400' />}
              </div>
              <div className='flex-1'>
                <div className='flex items-center gap-2 mb-1'>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${alertTypeColors[a.alertType] || 'bg-gray-700 text-gray-400'}`}>{a.alertType}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>{a.status}</span>
                </div>
                <p className='text-white text-sm font-medium'>{a.productName}</p>
                <p className='text-gray-400 text-xs mt-0.5'>Order: <span className='text-orange-400'>{a.darazOrderId}</span></p>
                {a.notes && <p className='text-gray-500 text-xs mt-1'>{a.notes}</p>}
                <p className='text-gray-600 text-xs mt-1'>{new Date(a.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                {a.resolvedAt && <p className='text-emerald-600 text-xs mt-0.5'>Resolved: {new Date(a.resolvedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
              {a.status === 'unresolved' && (
                <button onClick={() => resolveAlert(a.id)} className='flex-shrink-0 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-all'>
                  Resolve
                </button>
              )}
            </div>
          ))}

          <div className='flex gap-4 text-sm text-gray-400 pt-2'>
            <span>Total: <span className='text-white font-medium'>{alerts.length}</span></span>
            <span>Unresolved: <span className='text-red-400 font-medium'>{unresolvedAlerts.length}</span></span>
            <span>Resolved: <span className='text-emerald-400 font-medium'>{alerts.filter(a => a.status === 'resolved').length}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}
