'use client'
import { useState } from 'react'

const mockMessages = [
  { id: 1, name: 'Bikash Thapa', platform: 'FB', msg: 'Bhai yo jacket ko price kati ho?', time: '2 min ago', replied: false, aiReply: '' },
  { id: 2, name: 'Anita Gurung', platform: 'IG', msg: 'Order kahile aaucha?', time: '15 min ago', replied: true, aiReply: 'Namaste! Tapaaiko order 2-3 din ma deliver hola.' },
  { id: 3, name: 'Suresh KC', platform: 'WA', msg: 'Cash on delivery huncha?', time: '1 hr ago', replied: false, aiReply: '' },
  { id: 4, name: 'Priya Shrestha', platform: 'FB', msg: 'What is the return policy?', time: '2 hr ago', replied: false, aiReply: '' },
  { id: 5, name: 'Ramesh Oli', platform: 'IG', msg: 'Bhai available xa?', time: '3 hr ago', replied: true, aiReply: 'Namaste! Ho available xa, order garnu hola!' },
  { id: 6, name: 'Sunita Tamang', platform: 'WA', msg: 'Discount dinus na bhai', time: '4 hr ago', replied: false, aiReply: '' },
]

const platformStyle: Record<string,string> = {
  FB: 'bg-blue-600',
  IG: 'bg-gradient-to-br from-pink-500 to-purple-600',
  WA: 'bg-emerald-600',
}

const platformLabel: Record<string,string> = {
  FB: 'Facebook',
  IG: 'Instagram',
  WA: 'WhatsApp',
}

export default function MessagesPage() {
  const [messages, setMessages] = useState(mockMessages)
  const [selected, setSelected] = useState(mockMessages[0])
  const [filter, setFilter] = useState('All')
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = messages.filter(m => filter === 'All' || m.platform === filter)

  const generateAIReply = async (msg: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      })
      const data = await response.json()
      setReplyText(data.reply)
    } catch {
      setReplyText('Error generating reply. Please try again.')
    }
    setLoading(false)
  }

  const sendReply = (id: number) => {
    setMessages(messages.map(m =>
      m.id === id ? { ...m, replied: true, aiReply: replyText } : m
    ))
    setSelected(prev => ({ ...prev, replied: true, aiReply: replyText }))
    setReplyText('')
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
            {['All','FB','IG','WA'].map(p => (
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
            {filtered.map(m => (
              <div
                key={m.id}
                onClick={() => { setSelected(m); setReplyText('') }}
                className={'p-3 rounded-xl cursor-pointer transition-all border ' +
                  (selected.id === m.id ? 'bg-violet-600/20 border-violet-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-600')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ' + platformStyle[m.platform]}>
                    {m.platform}
                  </div>
                  <span className="text-white text-sm font-medium flex-1">{m.name}</span>
                  {!m.replied && <span className="w-2 h-2 rounded-full bg-violet-500"></span>}
                </div>
                <p className="text-gray-400 text-xs truncate">{m.msg}</p>
                <p className="text-gray-600 text-xs mt-1">{m.time}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-gray-900 rounded-2xl border border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center gap-3">
            <div className={'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ' + platformStyle[selected.platform]}>
              {selected.platform}
            </div>
            <div>
              <p className="text-white font-medium">{selected.name}</p>
              <p className="text-gray-400 text-xs">{platformLabel[selected.platform]} • {selected.time}</p>
            </div>
            <div className="ml-auto">
              {selected.replied
                ? <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Replied</span>
                : <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending</span>
              }
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-sm">
                <p className="text-white text-sm">{selected.msg}</p>
                <p className="text-gray-500 text-xs mt-1">{selected.time}</p>
              </div>
            </div>
            {selected.replied && selected.aiReply && (
              <div className="flex justify-end">
                <div className="bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-sm">
                  <p className="text-white text-sm">{selected.aiReply}</p>
                  <p className="text-violet-200 text-xs mt-1">You • Just now</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-800 space-y-3">
            {!selected.replied && (
              <button
                onClick={() => generateAIReply(selected.msg)}
                disabled={loading}
                className="w-full py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-medium hover:bg-violet-600/30 transition-all disabled:opacity-50"
              >
                {loading ? 'Generating AI Reply...' : '🤖 Generate AI Reply'}
              </button>
            )}
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
                disabled={!replyText}
                className="px-4 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}