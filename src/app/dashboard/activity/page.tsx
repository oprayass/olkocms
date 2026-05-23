'use client'
import { useState, useEffect } from 'react'

const actionColors: Record<string, string> = {
  ai_reply_generated: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  ai_reply_sent: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  human_reply_sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  order_confirm: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  staff_add: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  staff_remove: 'bg-red-500/20 text-red-400 border-red-500/30',
  login: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const actionIcons: Record<string, string> = {
  ai_reply_generated: '🤖',
  ai_reply_sent: '🤖',
  human_reply_sent: '👤',
  order_confirm: '✅',
  staff_add: '➕',
  staff_remove: '🗑️',
  login: '🔐',
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetch('/api/activity?limit=100')
      .then(r => r.json())
      .then(data => { setLogs(data); setLoading(false) })
  }, [])

  const filters = ['All', 'AI', 'Human', 'Orders']

  const filtered = logs.filter(l => {
    if (filter === 'All') return true
    if (filter === 'AI') return l.isAI
    if (filter === 'Human') return !l.isAI
    if (filter === 'Orders') return l.entityType === 'order'
    return true
  })

  const aiCount = logs.filter(l => l.isAI).length
  const humanCount = logs.filter(l => !l.isAI).length

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Activity Log</h1>
        <p className="text-gray-400 text-sm">को ले के गर्यो - सबै track यहाँ</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{logs.length}</div>
          <div className="text-xs text-white/70">Total Activities</div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{humanCount}</div>
          <div className="text-xs text-white/70">Human Actions</div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-white">{aiCount}</div>
          <div className="text-xs text-white/70">AI Actions</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' +
              (filter === f ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-10">No activity yet</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => (
            <div key={log.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">
                  {actionIcons[log.action] || '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${actionColors[log.action] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                      {log.action}
                    </span>
                    {log.isAI
                      ? <span className="text-xs text-violet-400">AI</span>
                      : <span className="text-xs text-blue-400">{log.staffName || 'Staff'}</span>
                    }
                  </div>
                  <p className="text-white text-sm">{log.description}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}