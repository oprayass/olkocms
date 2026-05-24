'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X, User, Bot, Loader2 } from 'lucide-react'

const sc: Record<string, string> = {
  Pending: 'bg-amber-500/20 text-amber-400',
  Delivered: 'bg-emerald-500/20 text-emerald-400',
  Processing: 'bg-blue-500/20 text-blue-400',
  Confirmed: 'bg-violet-500/20 text-violet-400',
  Cancelled: 'bg-red-500/20 text-red-400',
}

function MsgDrawer({ customerName, senderId, phone }: { customerName: string, senderId?: string, phone?: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const q = senderId ? `senderId=${encodeURIComponent(senderId)}` : phone ? `phone=${encodeURIComponent(phone)}` : ''
      if (!q) { setLoading(false); return }
      const res = await fetch(`/api/messages/customer?${q}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) fetchMessages() }, [open])
  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, open])

  const formatTime = (d: string) => new Date(d).toLocaleString('ne-NP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 py-0.5 rounded-full transition-all border border-transparent hover:border-blue-500/30 mt-1">
        <MessageCircle className="w-3 h-3" />
        <span>Messages</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md h-[72vh] bg-gray-900 border border-gray-700 rounded-tl-2xl rounded-tr-2xl md:rounded-2xl md:mb-4 md:mr-4 flex flex-col shadow-2xl"
            style={{ animation: 'slideUp 0.2s ease-out' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 rounded-tl-2xl rounded-tr-2xl md:rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                  {customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{customerName}</p>
                  {phone && <p className="text-gray-400 text-xs">{phone}</p>}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white hover:bg-gray-700 p-1.5 rounded-full transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                  <p className="text-gray-400 text-sm">Messages लोड हुँदैछ...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <MessageCircle className="w-12 h-12 text-gray-700" />
                  <p className="text-gray-500 text-sm text-center">{customerName} सँग कुनै message छैन</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">{messages.length} messages</span>
                  </div>
                  {messages.map((msg: any) => {
                    const isStaff = msg.sender === 'staff'
                    const isBot = msg.sender === 'bot'
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isStaff ? 'justify-end' : 'justify-start'}`}>
                        {!isStaff && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${isBot ? 'bg-violet-800' : 'bg-gray-700'}`}>
                            {isBot ? <Bot className="w-3.5 h-3.5 text-violet-300" /> : <User className="w-3.5 h-3.5 text-blue-400" />}
                          </div>
                        )}
                        <div className="max-w-[75%] space-y-0.5">
                          <p className={`text-xs text-gray-500 ${isStaff ? 'text-right' : ''}`}>{isBot ? 'AI Bot' : isStaff ? 'Staff' : customerName}</p>
                          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isStaff ? 'bg-blue-600 text-white rounded-tr-none' : isBot ? 'bg-violet-900/60 text-violet-100 rounded-tl-none' : 'bg-gray-700 text-white rounded-tl-none'}`}>{msg.message}</div>
                          <p className={`text-xs text-gray-600 ${isStaff ? 'text-right' : ''}`}>{formatTime(msg.createdAt)}</p>
                        </div>
                        {isStaff && <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1"><User className="w-3.5 h-3.5 text-white" /></div>}
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </>
  )
}

export function RecentOrders() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(data => setOrders(data.slice(0, 5)))
  }, [])
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
        <button onClick={() => router.push('/dashboard/orders')} className="text-xs text-violet-400 hover:text-violet-300">
          View All →
        </button>
      </div>
      {orders.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No orders yet</p>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="bg-gray-800/50 rounded-xl p-3 hover:bg-gray-800 transition-all">
              <div className="flex items-center justify-between">
                <div onClick={() => router.push('/dashboard/orders')} className="cursor-pointer flex-1">
                  <p className="text-white font-medium">{o.customerName}</p>
                  <p className="text-gray-400 text-sm">{o.product}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">Rs {o.price?.toLocaleString()}</p>
                  <span className={`${sc[o.status] || 'bg-gray-500/20 text-gray-400'} text-xs px-2 py-1 rounded-full`}>
                    {o.status}
                  </span>
                </div>
              </div>
              <MsgDrawer customerName={o.customerName} senderId={o.senderId} phone={o.phone} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}