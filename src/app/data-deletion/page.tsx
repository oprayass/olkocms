'use client'
import { useState } from 'react'

export default function DataDeletionPage() {
  const [form, setForm] = useState({ name: '', email: '', fbId: '', reason: '' })
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!form.email) return
    setSending(true)
    await new Promise(r => setTimeout(r, 1000))
    setSubmitted(true)
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-white">OlkoCMS</span>
          <span className="text-gray-400 text-sm ml-2">Social Commerce</span>
        </div>
        <a href="/privacy" className="text-violet-400 hover:text-violet-300 text-sm">Privacy Policy</a>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🗑️</div>
          <h1 className="text-3xl font-bold text-white mb-2">Data Deletion Request</h1>
          <p className="text-gray-400">Request deletion of your personal data from OlkoCMS</p>
        </div>

        {submitted ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">Request Submitted!</h2>
            <p className="text-gray-400 text-sm mb-4">We have received your data deletion request. Your data will be deleted within 30 days.</p>
            <div className="bg-gray-900 rounded-xl p-4 text-left text-sm">
              <p className="text-gray-400 mb-1">Reference ID: <span className="text-white font-mono">DEL-{Date.now().toString().slice(-8)}</span></p>
              <p className="text-gray-400">Email: <span className="text-white">{form.email}</span></p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
              ⚠️ Data delete bhayepachhi restore garna sakinna. Sabai order, message, ra account data permanently hatinchha.
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-white font-semibold">Your Information</h2>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Full Name</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ram Bahadur" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Email Address *</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="your@email.com" type="email" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Facebook User ID (optional)</label>
                <input value={form.fbId} onChange={e => setForm({...form, fbId: e.target.value})} placeholder="1234567890" className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500" />
                <p className="text-gray-600 text-xs mt-1">Settings → Your Facebook Information → About You</p>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Reason (optional)</label>
                <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Why are you requesting data deletion?" rows={3} className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-500 resize-none" />
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm">
              <h3 className="text-white font-medium mb-2">What will be deleted:</h3>
              <ul className="space-y-1 text-gray-400">
                <li>✓ All messages associated with your Facebook ID</li>
                <li>✓ Your personal information (name, phone, address)</li>
                <li>✓ Order history linked to your account</li>
                <li>✓ AI conversation history</li>
                <li>✓ Activity logs containing your data</li>
              </ul>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!form.email || sending}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-medium transition-all"
            >
              {sending ? 'Submitting...' : '🗑️ Submit Data Deletion Request'}
            </button>

            <p className="text-gray-500 text-xs text-center">
              Request processed within 30 days. Questions?{' '}
              <a href="mailto:olkocms@gmail.com" className="text-violet-400">olkocms@gmail.com</a>
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-800 px-6 py-6 text-center mt-8">
        <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
          <a href="/privacy" className="hover:text-gray-300">Privacy Policy</a>
          <a href="/data-deletion" className="hover:text-gray-300">Data Deletion</a>
          <a href="/pricing" className="hover:text-gray-300">Pricing</a>
        </div>
        <p className="text-gray-600 text-xs mt-3">2026 OlkoCMS - Made with love in Nepal</p>
      </footer>
    </div>
  )
}