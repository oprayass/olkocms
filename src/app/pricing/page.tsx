'use client'
import { useState } from 'react'
import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    emoji: '🌱',
    priceMonthly: 999,
    priceYearly: 9999,
    color: 'from-blue-500 to-blue-700',
    border: 'border-blue-500/30',
    badge: null,
    features: [
      '1 Facebook Page',
      'AI Auto-Reply',
      'Orders Management',
      'Messages & Threads',
      'Follow-up Reminders',
      '2 Staff Accounts',
      'Basic Dashboard',
    ],
    notIncluded: [
      'Reports & Analytics',
      'Daraz Integration',
      'Priority Support',
    ]
  },
  {
    name: 'Growth',
    emoji: '🚀',
    priceMonthly: 2499,
    priceYearly: 24999,
    color: 'from-violet-600 to-violet-800',
    border: 'border-violet-500/50',
    badge: 'Most Popular',
    features: [
      '3 Facebook/Instagram Pages',
      'AI Auto-Reply + Bargaining',
      'Orders Management',
      'Messages & Threads',
      'Follow-up Reminders',
      '5 Staff Accounts',
      'Reports & Analytics',
      'Courier Management',
      'Activity Log',
    ],
    notIncluded: [
      'Daraz Integration',
      'Priority Support',
    ]
  },
  {
    name: 'Pro',
    emoji: '👑',
    priceMonthly: 4999,
    priceYearly: 49999,
    color: 'from-amber-500 to-amber-700',
    border: 'border-amber-500/30',
    badge: 'Best Value',
    features: [
      'Unlimited Pages',
      'AI Auto-Reply + Full Sales Agent',
      'Orders Management',
      'Messages & Threads',
      'Follow-up Reminders',
      'Unlimited Staff',
      'Reports & Analytics',
      'Courier Management',
      'Activity Log',
      'Daraz Integration',
      'Priority Support',
      'Custom Branding',
    ],
    notIncluded: []
  },
]

const faqs = [
  { q: 'Trial period kati dinko ho?', a: '1 dinko free trial paununhunchha. Trial ma sabai features use garna sakinchha.' },
  { q: 'Payment kasari garne?', a: 'eSewa, Khalti, Bank Transfer, wa Cash - jun suvidhajanak lagchha tyasbata payment garna sakinchha.' },
  { q: 'Facebook page kasari connect garne?', a: 'Signup pachhi hamro team le setup garidianchha. 24 ghanta bhitra live huncha.' },
  { q: 'AI le Nepali ma reply garchha?', a: 'Ho! AI le Nepali, English, ra Nepanglish tinvata bhasama reply garchha.' },
  { q: 'Plan upgrade/downgrade garna sakinchha?', a: 'Junsukai bela plan change garna sakinchha. Billing cycle anusar adjust huncha.' },
  { q: 'Data secure chha?', a: 'Sabai data encrypted chha. Tapaiको customer data 100% safe ra private chha.' },
]

export default function PricingPage() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-white">OlkoCMS</span>
          <span className="text-gray-400 text-sm ml-2">Social Commerce</span>
        </div>
        <Link href="/login" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-medium transition-all">
          Login
        </Link>
      </nav>

      <div className="text-center py-16 px-6">
        <div className="inline-block px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-sm mb-4">
          Nepal ko lagi banaiyeko
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">Simple, Transparent Pricing</h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
          Facebook ra Instagram bata orders manage garnuhos — AI le automatically customer lai reply dinchha.
        </p>
        <div className="inline-flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-2xl p-1.5">
          <button onClick={() => setBilling('monthly')} className={'px-5 py-2 rounded-xl text-sm font-medium transition-all ' + (billing === 'monthly' ? 'bg-violet-600 text-white' : 'text-gray-400')}>Monthly</button>
          <button onClick={() => setBilling('yearly')} className={'px-5 py-2 rounded-xl text-sm font-medium transition-all ' + (billing === 'yearly' ? 'bg-violet-600 text-white' : 'text-gray-400')}>
            Yearly
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">2 months free</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-3 gap-6">
          {plans.map(plan => {
            const price = billing === 'monthly' ? plan.priceMonthly : plan.priceYearly
            const perMonth = billing === 'yearly' ? Math.round(plan.priceYearly / 12) : plan.priceMonthly
            return (
              <div key={plan.name} className={'rounded-3xl border p-6 flex flex-col relative ' + (plan.badge === 'Most Popular' ? 'bg-violet-950/50 border-violet-500/50 scale-105' : 'bg-gray-900 ' + plan.border)}>
                {plan.badge && (
                  <div className={'absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ' + plan.color}>
                    {plan.badge}
                  </div>
                )}
                <div className="text-3xl mb-2">{plan.emoji}</div>
                <h2 className="text-xl font-bold text-white mb-1">{plan.name}</h2>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">Rs {price.toLocaleString()}</span>
                  <span className="text-gray-400 text-sm">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                {billing === 'yearly' && (
                  <p className="text-emerald-400 text-xs mb-3">Rs {perMonth.toLocaleString()}/mo — 2 months free!</p>
                )}
                <p className="text-gray-500 text-xs mb-5">1 day free trial • No credit card</p>
                <a href={"mailto:olkocms@gmail.com?subject=Subscription Request - " + plan.name + "&body=Name: %0APhone: %0APlan: " + plan.name + " (" + billing + ")"} className={'w-full py-3 rounded-xl text-sm font-bold text-center transition-all mb-6 block bg-gradient-to-r text-white hover:opacity-90 ' + plan.color}>
                  Start Free Trial
                </a>
                <div className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-emerald-400 text-sm">✓</span>
                      <span className="text-gray-300 text-sm">{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-gray-600 text-sm">✕</span>
                      <span className="text-gray-600 text-sm">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm mb-4">Payment Methods</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {['eSewa', 'Khalti', 'Bank Transfer', 'Cash'].map(m => (
              <span key={m} className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-300 text-sm">{m}</span>
            ))}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Ke ke features paunuhunchha?</h2>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-400 font-medium px-5 py-4">Feature</th>
                  {plans.map(p => (
                    <th key={p.name} className="text-center text-gray-400 font-medium px-4 py-4">{p.emoji} {p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Facebook Pages', vals: ['1', '3', 'Unlimited'] },
                  { feature: 'AI Auto-Reply', vals: ['✓', '✓', '✓'] },
                  { feature: 'Bargaining Flow', vals: ['✓', '✓', '✓'] },
                  { feature: 'Orders Management', vals: ['✓', '✓', '✓'] },
                  { feature: 'Messages & Threading', vals: ['✓', '✓', '✓'] },
                  { feature: 'Follow-up Reminders', vals: ['✓', '✓', '✓'] },
                  { feature: 'Staff Accounts', vals: ['2', '5', 'Unlimited'] },
                  { feature: 'Reports & Analytics', vals: ['✕', '✓', '✓'] },
                  { feature: 'Courier Management', vals: ['✕', '✓', '✓'] },
                  { feature: 'Daraz Integration', vals: ['✕', '✕', '✓'] },
                  { feature: 'Priority Support', vals: ['✕', '✕', '✓'] },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                    <td className="px-5 py-3 text-gray-300">{row.feature}</td>
                    {row.vals.map((v, j) => (
                      <td key={j} className={'px-4 py-3 text-center ' + (v === '✓' ? 'text-emerald-400' : v === '✕' ? 'text-gray-600' : 'text-white font-medium')}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3 max-w-2xl mx-auto">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-white font-medium text-sm">{faq.q}</span>
                  <span className="text-gray-400 text-lg">{openFaq === i ? '-' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-gray-400 text-sm">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center bg-gradient-to-br from-violet-600/20 to-violet-800/20 border border-violet-500/30 rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-white mb-3">Ajai suru garnuhos!</h2>
          <p className="text-gray-400 mb-6">1 dinko free trial — kunai credit card chainadaina</p>
          <div className="flex items-center justify-center gap-4">
            <a href="mailto:olkocms@gmail.com?subject=Subscription Request" className="px-8 py-3 bg-violet-600 hover:bg-violet-700 rounded-xl font-medium transition-all">Get Started</a>
            <a href="https://wa.me/9779800000000" className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-all text-gray-300">WhatsApp garnuhos</a>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 px-6 py-6 text-center">
        <p className="text-gray-500 text-sm">2026 OlkoCMS - Made with love in Nepal</p>
      </footer>
    </div>
  )
}