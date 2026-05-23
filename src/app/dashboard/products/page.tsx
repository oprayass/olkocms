'use client'
import { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  description?: string
  price: number
  salePrice?: number
  stock: number
  weightKg?: number
  images?: string
  videoUrl?: string
  features?: string
  usage?: string
  implications?: string
  category?: string
  status: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    salePrice: '',
    stock: '',
    weightKg: '',
    category: '',
    features: '',
    usage: '',
    implications: '',
    videoUrl: '',
    status: 'Active',
  })

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const resetForm = () => setForm({
    name: '', description: '', price: '', salePrice: '',
    stock: '', weightKg: '', category: '', features: '', usage: '',
    implications: '', videoUrl: '', status: 'Active',
  })

  const saveProduct = async () => {
    if (!form.name || !form.price) return
    setSaving(true)
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        salePrice: form.salePrice ? parseFloat(form.salePrice) : null,
        stock: parseInt(form.stock) || 0,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
        category: form.category || null,
        features: form.features || null,
        usage: form.usage || null,
        implications: form.implications || null,
        videoUrl: form.videoUrl || null,
        status: form.status,
      }

      if (editProduct) {
        await fetch(`/api/products/${editProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
      resetForm()
      setShowAdd(false)
      setEditProduct(null)
      fetchProducts()
    } finally {
      setSaving(false)
    }
  }

  const deleteProduct = async (id: string) => {
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchProducts()
  }

  const startEdit = (p: Product) => {
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price.toString(),
      salePrice: p.salePrice?.toString() || '',
      stock: p.stock.toString(),
      weightKg: p.weightKg?.toString() || '',
      category: p.category || '',
      features: p.features || '',
      usage: p.usage || '',
      implications: p.implications || '',
      videoUrl: p.videoUrl || '',
      status: p.status,
    })
    setEditProduct(p)
    setShowAdd(true)
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Products</h1>
          <p className="text-gray-400 text-sm">AI le yo data bata customer questions answer garchha</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditProduct(null); setShowAdd(!showAdd) }}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
        >
          + Add Product
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total', value: products.length, color: 'from-violet-600 to-violet-800' },
          { label: 'Active', value: products.filter(p => p.status === 'Active').length, color: 'from-emerald-500 to-emerald-700' },
          { label: 'Out of Stock', value: products.filter(p => p.stock === 0).length, color: 'from-red-500 to-red-700' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/70">{s.label}</div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 mb-5">
          <h2 className="text-white font-medium mb-3">
            {editProduct ? 'Product Edit garnuhos' : 'New Product thapnuhos'}
          </h2>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Product Name *" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Category" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="Price (Rs) *" type="number" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              <input value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} placeholder="Sale Price" type="number" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              <input value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="Stock" type="number" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              <input value={form.weightKg} onChange={e => setForm({ ...form, weightKg: e.target.value })} placeholder="Weight (kg)" type="number" step="0.1" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            </div>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description - AI le yo padhera customer lai explain garchha" rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500 resize-none" />
            <textarea value={form.features} onChange={e => setForm({ ...form, features: e.target.value })} placeholder="Features (e.g. HD Display, 5000mAh battery, Waterproof)" rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500 resize-none" />
            <textarea value={form.usage} onChange={e => setForm({ ...form, usage: e.target.value })} placeholder="Usage - kasari use garne (AI le customer lai guide garchha)" rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500 resize-none" />
            <textarea value={form.implications} onChange={e => setForm({ ...form, implications: e.target.value })} placeholder="Implications - side effects, precautions, who should not use" rows={2} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500 resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.videoUrl} onChange={e => setForm({ ...form, videoUrl: e.target.value })} placeholder="Video URL (YouTube/Facebook)" className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveProduct} disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Saving...' : (editProduct ? 'Update Product' : 'Add Product')}
            </button>
            <button onClick={() => { setShowAdd(false); setEditProduct(null); resetForm() }} className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-10">Loading...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-2">No products yet</p>
          <p className="text-gray-600 text-xs">Product thapnuhos - AI le automatically customer questions answer garchha</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <div key={p.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-white font-medium">{p.name}</p>
                    {p.category && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">{p.category}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>{p.status}</span>
                    {p.stock === 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Out of Stock</span>}
                  </div>
                  {p.description && <p className="text-gray-400 text-xs mb-1 line-clamp-2">{p.description}</p>}
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold">Rs {p.price.toLocaleString()}</span>
                    {p.salePrice && <span className="text-emerald-400 text-sm">Sale: Rs {p.salePrice.toLocaleString()}</span>}
                    <span className="text-gray-500 text-xs">Stock: {p.stock}</span>
                    {p.weightKg && <span className="text-gray-500 text-xs">⚖️ {p.weightKg}kg</span>}
                  </div>
                  {p.features && <p className="text-gray-500 text-xs mt-1">✨ {p.features.slice(0, 80)}...</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEdit(p)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30">Edit</button>
                <button onClick={() => setDeleteConfirm(p.id)} className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">Delete</button>
              </div>
              {deleteConfirm === p.id && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-xs mb-2">"{p.name}" delete garne?</p>
                  <div className="flex gap-2">
                    <button onClick={() => deleteProduct(p.id)} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs">Yes, Delete</button>
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
