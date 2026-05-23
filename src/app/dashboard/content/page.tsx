'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

const platformStyle: Record<string, string> = {
  facebook: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  instagram: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
  tiktok: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
}

const statusStyle: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  scheduled: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  posted: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
}

const emptyForm = {
  title: '',
  body: '',
  platform: 'facebook',
  status: 'draft',
  scheduledAt: '',
}

export default function ContentPage() {
  const { data: session } = useSession()
  const [contents, setContents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState('All')
  const [platformFilter, setPlatformFilter] = useState('All')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAI, setShowAI] = useState(false)

  const fetchContents = () => {
    fetch('/api/content')
      .then(r => r.json())
      .then(data => { setContents(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchContents() }, [])

  const resetForm = () => {
    setForm(emptyForm)
    setEditItem(null)
    setAiPrompt('')
    setShowAI(false)
  }

  const generateAIContent = async () => {
    if (!aiPrompt) return
    setGenerating(true)
    try {
      const response = await fetch('/api/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerMessage: aiPrompt,
          systemPrompt: "You are a social media content creator for a Nepali e-commerce business. Generate engaging social media post content based on the user's request. Write in a mix of Nepali and English (Nepanglish) that feels natural. Include emojis. Make it engaging and sales-focused. Return ONLY the post content, no explanations."
        })
      })
      const data = await response.json()
      if (data.reply) {
        setForm(prev => ({ ...prev, body: data.reply }))
      }
    } catch (e) {
      console.error(e)
    }
    setGenerating(false)
  }

  const saveContent = async () => {
    if (!form.title || !form.body) return
    setSaving(true)
    try {
      const body = {
        title: form.title,
        body: form.body,
        platform: form.platform,
        status: form.status,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        staffId: null,
      }
      if (editItem) {
        await fetch("/api/content/" + editItem.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      } else {
        await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
      resetForm()
      setShowForm(false)
      fetchContents()
    } finally {
      setSaving(false)
    }
  }

  const deleteContent = async (id: string) => {
    await fetch("/api/content/" + id, { method: 'DELETE' })
    setDeleteConfirm(null)
    fetchContents()
  }

  const markAsPosted = async (id: string) => {
    await fetch("/api/content/" + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'posted', postedAt: new Date().toISOString() })
    })
    fetchContents()
  }

  const startEdit = (item: any) => {
    setForm({
      title: item.title,
      body: item.body,
      platform: item.platform,
      status: item.status,
      scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : '',
    })
    setEditItem(item)
    setShowForm(true)
  }

  const filtered = contents.filter(c => {
    const matchStatus = filter === 'All' || c.status === filter
    const matchPlatform = platformFilter === 'All' || c.platform === platformFilter
    return matchStatus && matchPlatform
  })

  const stats = [
    { label: 'Total', value: contents.length, color: 'from-violet-600 to-violet-800' },
    { label: 'Draft', value: contents.filter(c => c.status === 'draft').length, color: 'from-gray-600 to-gray-800' },
    { label: 'Scheduled', value: contents.filter(c => c.status === 'scheduled').length, color: 'from-amber-500 to-amber-700' },
    { label: 'Posted', value: contents.filter(c => c.status === 'posted').length, color: 'from-emerald-500 to-emerald-700' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Creation</h1>
          <p className="text-gray-400 mt-1">Create and manage social media posts</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
          + New Post
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <div key={s.label} className={"bg-gradient-to-br " + s.color + " rounded-2xl p-4 text-center"}>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-white/70 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-6">
          <h2 className="text-white font-medium mb-4">{editItem ? 'Edit Post' : 'New Post'}</h2>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-gray-400 text-xs mb-1 block">Title *</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Post title..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Platform</label>
                <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-gray-400 text-xs">AI Content Generator</label>
                <button onClick={() => setShowAI(!showAI)} className="text-xs text-violet-400 hover:text-violet-300">
                  {showAI ? 'Hide' : '🤖 Use AI'}
                </button>
              </div>
              {showAI && (
                <div className="flex gap-2">
                  <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. Winter jacket sale 30% off, target women 25-40..." className="flex-1 bg-gray-800 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500" />
                  <button onClick={generateAIContent} disabled={generating || !aiPrompt} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium whitespace-nowrap">
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-1 block">Post Content *</label>
              <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="Write your post content here..." rows={6} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500 resize-none" />
              <p className="text-gray-600 text-xs mt-1">{form.body.length} characters</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="posted">Posted</option>
                </select>
              </div>
              {form.status === 'scheduled' && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Schedule Date & Time</label>
                  <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({...form, scheduledAt: e.target.value})} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={saveContent} disabled={saving || !form.title || !form.body} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
              {saving ? 'Saving...' : (editItem ? 'Update Post' : 'Save Post')}
            </button>
            <button onClick={() => { setShowForm(false); resetForm() }} className="px-5 py-2.5 bg-gray-800 text-gray-400 rounded-xl text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {['All', 'draft', 'scheduled', 'posted'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={'px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize ' + (filter === f ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}>{f}</button>
        ))}
        <div className="ml-auto">
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="bg-gray-900 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs outline-none">
            <option value="All">All Platforms</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No posts yet</p>
          <p className="text-xs text-gray-600">AI le content generate garnuhos!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <p className="text-white font-medium">{c.title}</p>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (platformStyle[c.platform] || '')}>{c.platform}</span>
                    <span className={"text-xs px-2 py-0.5 rounded-full capitalize " + (statusStyle[c.status] || '')}>{c.status}</span>
                    {c.status === 'scheduled' && c.scheduledAt && (
                      <span className="text-xs text-amber-400">🕐 {new Date(c.scheduledAt).toLocaleString()}</span>
                    )}
                    {c.status === 'posted' && c.postedAt && (
                      <span className="text-xs text-gray-500">Posted: {new Date(c.postedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-3 whitespace-pre-wrap">{c.body}</p>
                  <p className="text-gray-600 text-xs mt-2">{new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {c.status !== 'posted' && (
                  <button onClick={() => markAsPosted(c.id)} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">
                    ✓ Mark as Posted
                  </button>
                )}
                <button onClick={() => startEdit(c)} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30">Edit</button>
                <button onClick={() => navigator.clipboard.writeText(c.body)} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600">Copy</button>
                <button onClick={() => setDeleteConfirm(c.id)} className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">Delete</button>
              </div>
              {deleteConfirm === c.id && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-xs mb-2">Delete this post?</p>
                  <div className="flex gap-2">
                    <button onClick={() => deleteContent(c.id)} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs">Yes, Delete</button>
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