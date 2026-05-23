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

interface Message {
  id: string
  senderId: string
  senderName: string
  platform: string
  message: string
  timestamp: string
  replied: boolean
  replyText?: string
  aiReplied?: boolean
  pageId?: string
}

interface Thread {
  senderId: string
  senderName: string
  platform: string
  pageId?: string
  lastMessage: string
  lastTime: string
  unread: boolean
  aiReplied: boolean
  messages: Message[]
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [filter, setFilter] = useState('All')
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [handoffSending, setHandoffSending] = useState(false)
  const [handoffDone, setHandoffDone] = useState<Set<string>>(new Set())

  const buildThreads = (messages: Message[]) => {
    const threadMap = new Map<string, Thread>()
    messages.forEach(m => {
      const key = `${m.senderId}_${m.platform}`
      if (!threadMap.has(key)) {
        threadMap.set(key, {
          senderId: m.senderId,
          senderName: m.senderName,
          platform: m.platform,
          pageId: m.pageId,
          lastMessage: m.message,
          lastTime: m.timestamp,
          unread: !m.replied,
          aiReplied: m.aiReplied || false,
          messages: []
        })
      }
      const thread = threadMap.get(key)!
      thread.messages.push(m)
      if (new Date(m.timestamp) > new Date(thread.lastTime)) {
        thread.lastMessage = m.message
        thread.lastTime = m.timestamp
      }
      if (!m.replied) thread.unread = true
      if (m.aiReplied) thread.aiReplied = true
    })
    return Array.from(threadMap.values())
      .sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
  }

  const fetchMessages = () => {
    fetch('/api/messages')
      .then(r => r.json())
      .then(data => {
        setAllMessages(data)
        const newThreads = buildThreads(data)
        setThreads(newThreads)
        if (selectedThread) {
          const updated = newThreads.find(t => t.senderId === selectedThread.senderId && t.platform === selectedThread.platform)
          if (updated) setSelectedThread(updated)
        } else if (newThreads.length > 0) {
          setSelectedThread(newThreads[0])
        }
      })
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 8000)
    return () => clearInterval(interval)
  }, [])

  const filteredThreads = threads.filter(t =>
    filter === 'All' || t.platform === filter.toLowerCase() || t.platform === filter
  )

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
        staffName: isAI ? 'AI Sales Agent' : (session?.user?.name || 'Staff'),
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
        if (selectedThread?.messages[0]?.id) {
          await logActivity('ai_reply_generated', 'AI le reply generate garyeo', selectedThread.messages[0].id, true)
        }
      }
    } catch {
      setReplyText('Error generating reply.')
    }
    setLoading(false)
  }

  const sendReply = async () => {
    if (!selectedThread || !replyText) return
    setSending(true)
    try {
      const lastMsg = selectedThread.messages[selectedThread.messages.length - 1]
      await fetch(`/api/messages/${lastMsg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replied: true, replyText }),
      })
      await logActivity('human_reply_sent', `${session?.user?.name || 'Staff'} le reply pathayeo`, lastMsg.id, false)
      setReplyText('')
      fetchMessages()
    } finally {
      setSending(false)
    }
  }

  const handleHumanHandoff = async () => {
    if (!selectedThread) return
    setHandoffSending(true)
    try {
      const threadKey = `${selectedThread.senderId}_${selectedThread.platform}`

      // AIConversation resolved = true garne
      await fetch('/api/messages/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: selectedThread.senderId,
          pageId: selectedThread.pageId || '',
          staffName: session?.user?.name || 'Staff',
        })
      })

      // Activity log
      const lastMsg = selectedThread.messages[selectedThread.messages.length - 1]
      await logActivity(
        'human_handoff',
        `${session?.user?.name || 'Staff'} le human handoff liyeo - AI band`,
        lastMsg.id,
        false
      )

      setHandoffDone(prev => new Set(prev).add(threadKey))
      fetchMessages()
    } finally {
      setHandoffSending(false)
    }
  }

  const lastUnrepliedMsg = selectedThread?.messages.find(m => !m.replied)
  const threadKey = selectedThread ? `${selectedThread.senderId}_${selectedThread.platform}` : ''
  const isHandedOff = handoffDone.has(threadKey)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-gray-400 mt-1">Manage Facebook, Instagram and WhatsApp messages</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-160px)]">
        {/* Left - Thread List */}
        <div className="w-80 flex flex-col gap-3">
          <div className="flex gap-1">
            {['All', 'Facebook', 'IG', 'WA'].map(p => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ' +
                  (filter === p ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700')}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredThreads.length === 0 && (
              <p className="text-gray-500 text-sm text-center mt-8">No messages yet</p>
            )}
            {filteredThreads.map(thread => {
              const tKey = `${thread.senderId}_${thread.platform}`
              const tHandedOff = handoffDone.has(tKey)
              return (
                <div
                  key={tKey}
                  onClick={() => { setSelectedThread(thread); setReplyText('') }}
                  className={'p-3 rounded-xl cursor-pointer transition-all border ' +
                    (selectedThread?.senderId === thread.senderId && selectedThread?.platform === thread.platform
                      ? 'bg-violet-600/20 border-violet-500/50'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-600')}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ' + (platformStyle[thread.platform] || 'bg-gray-600')}>
                      {thread.senderName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate">{thread.senderName}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {tHandedOff && <span className="text-xs text-green-400">👤</span>}
                          {!tHandedOff && thread.aiReplied && <span className="text-xs text-violet-400">🤖</span>}
                          {thread.unread && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs truncate">{thread.lastMessage}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-600 text-xs">{platformLabel[thread.platform] || thread.platform}</span>
                    <span className="text-gray-600 text-xs">{new Date(thread.lastTime).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5">{thread.messages.length} messages</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right - Chat View */}
        {selectedThread ? (
          <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center gap-3">
              <div className={'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ' + (platformStyle[selectedThread.platform] || 'bg-gray-600')}>
                {selectedThread.senderName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-white font-medium">{selectedThread.senderName}</p>
                <p className="text-gray-400 text-xs">{platformLabel[selectedThread.platform]} · {selectedThread.messages.length} messages</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {isHandedOff && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">👤 Human Mode</span>
                )}
                {!isHandedOff && selectedThread.aiReplied && (
                  <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">🤖 AI</span>
                )}
                {selectedThread.unread
                  ? <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending</span>
                  : <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Replied</span>}

                {/* Human Handoff Button */}
                {!isHandedOff && selectedThread.aiReplied && (
                  <button
                    onClick={handleHumanHandoff}
                    disabled={handoffSending}
                    className="text-xs px-3 py-1.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 font-medium disabled:opacity-50 transition-all"
                  >
                    {handoffSending ? 'Taking over...' : '👤 Take Over'}
                  </button>
                )}
              </div>
            </div>

            {/* Handoff Banner */}
            {isHandedOff && (
              <div className="mx-4 mt-3 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 text-xs font-medium">👤 Human mode active — AI auto-reply band cha. Tapai le manually reply garnuhos.</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {selectedThread.messages
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((m, i) => (
                  <div key={m.id || i}>
                    <div className="flex justify-start mb-2">
                      <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-xs">
                        <p className="text-white text-sm">{m.message}</p>
                        <p className="text-gray-500 text-xs mt-1">{new Date(m.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    {m.replied && m.replyText && (
                      <div className="flex justify-end">
                        <div className="bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs">
                          <p className="text-white text-sm">{m.replyText}</p>
                          <p className="text-violet-200 text-xs mt-1">
                            {m.aiReplied ? '🤖 AI Sales Agent' : `👤 ${session?.user?.name || 'Staff'}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Reply Box */}
            <div className="p-4 border-t border-gray-800 space-y-3">
              {lastUnrepliedMsg && !isHandedOff && (
                <button
                  onClick={() => generateAIReply(lastUnrepliedMsg.message)}
                  disabled={loading}
                  className="w-full py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-600/30 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : '🤖 Generate AI Reply'}
                </button>
              )}
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={selectedThread.unread ? "Type your reply..." : "Conversation replied ✓"}
                  rows={2}
                  disabled={!selectedThread.unread}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none disabled:opacity-50"
                />
                <button
                  onClick={sendReply}
                  disabled={!replyText || sending || !selectedThread.unread}
                  className="px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center">
            <p className="text-gray-500">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  )
}