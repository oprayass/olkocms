'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const pc: Record<string, string> = {
  facebook: 'bg-blue-600',
  FB: 'bg-blue-600',
  IG: 'bg-pink-600',
  WA: 'bg-emerald-600',
}

export function RecentMessages() {
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/messages')
      .then(r => r.json())
      .then(data => setMessages(data.slice(0, 5)))
  }, [])

  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recent Messages</h2>
        <button
          onClick={() => router.push('/dashboard/messages')}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          View All →
        </button>
      </div>
      {messages.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No messages yet</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              onClick={() => router.push('/dashboard/messages')}
              className="flex items-start gap-3 bg-gray-800/50 rounded-xl p-3 cursor-pointer hover:bg-gray-800 transition-all"
            >
              <div className={`${pc[m.platform] || 'bg-gray-600'} w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {m.platform?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-white font-medium text-sm">{m.senderName}</p>
                  {!m.replied && <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0"></span>}
                </div>
                <p className="text-gray-400 text-sm truncate">{m.message}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${m.replied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {m.replied ? 'Replied' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}