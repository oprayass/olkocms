'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

const platformStyle: Record<string, string> = {
  facebook: 'bg-blue-600',
  FB: 'bg-blue-600',
  IG: 'bg-gradient-to-br from-pink-500 to-purple-600',
  WA: 'bg-emerald-600',
}

const platformLabel: Record<string, string> = {
  facebook: 'Facebook',
  FB: 'Facebook',
  IG: 'Instagram',
  WA: 'WhatsApp',
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [filter, setFilter] = useState('All')
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch('/api/messages')
      .then(r => r.json())
      .then(data => {
        setMessages(data)
        if (data.length > 0) setSelected(data[0])
      })
  }, [])

  const filtered = messages.filter(m => filter === 'All' || m.platform === filter)

  const logActivity = async (action: string, description: string, entityId: string, isAI: boolean) => {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        description,
        entityType: 'message',
        entityId,
        performedBy: isAI ? 'AI' : (session?.user?.email || 'unknown'),
        staffName: isAI ? 'AI Assistant' : (session?.user?.name || session?.user?.email || 'Staff'),
        isAI,
      })
    })
  }

  const generateAIReply = async (msg: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerMessage: msg }),
      })
      const data = await response.json()
      if (data.reply) {
        setReplyText(data.reply)
        await logActivity('ai_reply_generated', `AI ले reply generate गर्यो`, selected?.id, true)
      }
    } catch (err) {
      setReplyText('Error generating reply.')
    }
    setLoading(false)
  }

  const sendReply = async (id: string) => {
    setSending(true)
    try {
      await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replied: true, replyText }),
      })
      await logActivity(
        'human_reply_sent',
        `${session?.user?.name || 'Staff'} ले reply पठायो`,
        id,
        false
      )
      setMessages(messages.map(m => m.id === id ? { ...m, replied: true, replyText } : m))
      setSelected((prev: any) => ({ ...prev, replied: true, replyText }))
      setReplyText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-gray-400 mt-1">Manage Facebook, Instagram and WhatsApp messages</p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-180px)]">
        <div className="w-80 flex flex-col gap-3">
          <div className="flex gap-2">
            {['All', 'facebook', 'IG', 'WA'].map(p => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                  (filter === p ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-500')}
              >
                {p === 'All' ? 'All' : platformLabel[p]}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filtered.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-8">No messages yet</p>
            )}
            {filtered.map(m => (
              <div
                key={m.id}
                onClick={() => { setSelected(m); setReplyText('') }}
                className={'p-3 rounded-xl cursor-pointer transition-all border ' +
                  (selected?.id === m.id ? 'bg-violet-600/20 border-violet-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-600')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ' + (platformStyle[m.platform] || 'bg-gray-600')}>
                    {m.platform?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium flex-1 truncate">{m.senderName}</span>
                  {!m.replied && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                </div>
                <p className="text-gray-400 text-xs truncate">{m.message}</p>
                <p className="text-gray-600 text-xs mt-1">{new Date(m.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
              <div className={'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ' + (platformStyle[selected.platform] || 'bg-gray-600')}>
                {selected.platform?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium">{selected.senderName}</p>
                <p className="text-gray-400 text-xs">{platformLabel[selected.platform]} · {new Date(selected.timestamp).toLocaleString()}</p>
              </div>
              <div className="ml-auto">
                {selected.replied
                  ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Replied</span>
                  : <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending</span>}
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-sm">
                  <p className="text-white text-sm">{selected.message}</p>
                  <p className="text-gray-500 text-xs mt-1">{new Date(selected.timestamp).toLocaleString()}</p>
                </div>
              </div>
              {selected.replied && selected.replyText && (
                <div className="flex justify-end">
                  <div className="bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-sm">
                    <p className="text-white text-sm">{selected.replyText}</p>
                    <p className="text-violet-200 text-xs mt-1">{session?.user?.name || 'Staff'}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-800 space-y-3">
              {!selected.replied && (
                <button
                  onClick={() => generateAIReply(selected.message)}
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-600/30 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate AI Reply'}
                </button>
              )}
              {!selected.replied && (
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={2}
                    className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none"
                  />
                  <button
                    onClick={() => sendReply(selected.id)}
                    disabled={!replyText || sending}
                    className="px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium"
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              )}
              {selected.replied && (
                <p className="text-center text-gray-600 text-xs">Replied</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
            <p className="text-gray-500">Select a message to view</p>
          </div>
        )}
      </div>
    </div>
  )
}