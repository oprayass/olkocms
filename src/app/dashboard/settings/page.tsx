'use client'
import { useState } from 'react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('business')
  const [saved, setSaved] = useState(false)

  const [business, setBusiness] = useState({
    name: 'OlkoCMS Store',
    email: 'store@olkocms.com',
    phone: '9841000000',
    address: 'Kathmandu, Nepal',
    currency: 'NPR',
    timezone: 'Asia/Kathmandu',
  })

  const [notifications, setNotifications] = useState({
    newOrder: true,
    newMessage: true,
    followupReminder: true,
    deliveryUpdate: true,
    dailyReport: false,
    weeklyReport: true,
  })

  const [social, setSocial] = useState({
    fbPageId: '',
    fbAccessToken: '',
    igAccountId: '',
    waPhoneNumber: '',
    waApiKey: '',
  })

  const [ai, setAi] = useState({
    apiKey: '',
    autoReply: false,
    replyLanguage: 'auto',
    replyTone: 'friendly',
    customPrompt: '',
  })

  const saveSettings = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const tabs = [
    { k:'business', l:'🏪 Business', },
    { k:'social', l:'📱 Social Media', },
    { k:'ai', l:'🤖 AI Settings', },
    { k:'notifications', l:'🔔 Notifications', },
    { k:'subscription', l:'💎 Subscription', },
  ]

  return (
    <div>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Settings</h1>
          <p className='text-gray-400 mt-1'>Manage your store settings</p>
        </div>
        <button onClick={saveSettings} className='bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all'>
          {saved ? '✅ Saved!' : '💾 Save Changes'}
        </button>
      </div>

      <div className='flex gap-2 mb-6 flex-wrap'>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)} className={'px-4 py-2 rounded-xl text-sm font-medium transition-all '+(activeTab===t.k?'bg-violet-600 text-white':'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-500')}>{t.l}</button>
        ))}
      </div>

      {activeTab === 'business' && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
          <h2 className='text-white font-medium mb-5'>Business Information</h2>
          <div className='grid grid-cols-2 gap-4'>
            {[
              {l:'Store Name', k:'name', p:'Your store name'},
              {l:'Business Email', k:'email', p:'store@example.com'},
              {l:'Phone Number', k:'phone', p:'98XXXXXXXX'},
              {l:'Address', k:'address', p:'City, Nepal'},
            ].map(f => (
              <div key={f.k}>
                <label className='text-gray-400 text-sm mb-1.5 block'>{f.l}</label>
                <input value={business[f.k as keyof typeof business]} onChange={e => setBusiness({...business, [f.k]: e.target.value})} placeholder={f.p} className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              </div>
            ))}
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Currency</label>
              <select value={business.currency} onChange={e => setBusiness({...business, currency: e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                <option value='NPR'>NPR — Nepali Rupee</option>
                <option value='USD'>USD — US Dollar</option>
                <option value='INR'>INR — Indian Rupee</option>
              </select>
            </div>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Timezone</label>
              <select value={business.timezone} onChange={e => setBusiness({...business, timezone: e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                <option value='Asia/Kathmandu'>Asia/Kathmandu (NPT +5:45)</option>
                <option value='Asia/Kolkata'>Asia/Kolkata (IST +5:30)</option>
                <option value='UTC'>UTC</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className='space-y-4'>
          <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
            <div className='flex items-center gap-3 mb-5'>
              <div className='w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm'>FB</div>
              <h2 className='text-white font-medium'>Facebook Integration</h2>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Page ID</label>
                <input value={social.fbPageId} onChange={e=>setSocial({...social,fbPageId:e.target.value})} placeholder='1234567890' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              </div>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Access Token</label>
                <input type='password' value={social.fbAccessToken} onChange={e=>setSocial({...social,fbAccessToken:e.target.value})} placeholder='EAAxxxxx...' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              </div>
            </div>
          </div>
          <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
            <div className='flex items-center gap-3 mb-5'>
              <div className='w-9 h-9 bg-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-sm'>IG</div>
              <h2 className='text-white font-medium'>Instagram Integration</h2>
            </div>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Account ID</label>
              <input value={social.igAccountId} onChange={e=>setSocial({...social,igAccountId:e.target.value})} placeholder='Instagram Account ID' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
            </div>
          </div>
          <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
            <div className='flex items-center gap-3 mb-5'>
              <div className='w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-sm'>WA</div>
              <h2 className='text-white font-medium'>WhatsApp Integration</h2>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Phone Number</label>
                <input value={social.waPhoneNumber} onChange={e=>setSocial({...social,waPhoneNumber:e.target.value})} placeholder='+977XXXXXXXXXX' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              </div>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>API Key</label>
                <input type='password' value={social.waApiKey} onChange={e=>setSocial({...social,waApiKey:e.target.value})} placeholder='WhatsApp API Key' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
          <h2 className='text-white font-medium mb-5'>AI Auto-Reply Settings</h2>
          <div className='space-y-5'>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Anthropic API Key</label>
              <input type='password' value={ai.apiKey} onChange={e=>setAi({...ai,apiKey:e.target.value})} placeholder='sk-ant-xxxxxxxx' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              <p className='text-gray-500 text-xs mt-1'>Get your API key from console.anthropic.com</p>
            </div>
            <div className='flex items-center justify-between p-4 bg-gray-800 rounded-xl'>
              <div>
                <p className='text-white text-sm font-medium'>Auto Reply</p>
                <p className='text-gray-400 text-xs mt-0.5'>Automatically reply to customer messages using AI</p>
              </div>
              <button onClick={() => setAi({...ai, autoReply:!ai.autoReply})} className={'w-12 h-6 rounded-full transition-all '+(ai.autoReply?'bg-violet-600':'bg-gray-600')}>
                <div className={'w-5 h-5 bg-white rounded-full transition-all mx-0.5 '+(ai.autoReply?'translate-x-6':'translate-x-0')}></div>
              </button>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Reply Language</label>
                <select value={ai.replyLanguage} onChange={e=>setAi({...ai,replyLanguage:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                  <option value='auto'>Auto Detect</option>
                  <option value='nepali'>Nepali</option>
                  <option value='english'>English</option>
                  <option value='mixed'>Mixed</option>
                </select>
              </div>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Reply Tone</label>
                <select value={ai.replyTone} onChange={e=>setAi({...ai,replyTone:e.target.value})} className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                  <option value='friendly'>Friendly</option>
                  <option value='professional'>Professional</option>
                  <option value='casual'>Casual</option>
                </select>
              </div>
            </div>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Custom Prompt (Optional)</label>
              <textarea value={ai.customPrompt} onChange={e=>setAi({...ai,customPrompt:e.target.value})} rows={3} placeholder='You are a helpful assistant for our store. Always be polite...' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500 resize-none' />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
          <h2 className='text-white font-medium mb-5'>Notification Preferences</h2>
          <div className='space-y-3'>
            {[
              {k:'newOrder', l:'New Order', d:'Get notified when a new order is placed'},
              {k:'newMessage', l:'New Message', d:'Get notified when a customer sends a message'},
              {k:'followupReminder', l:'Follow-up Reminder', d:'Remind when follow-up is due'},
              {k:'deliveryUpdate', l:'Delivery Update', d:'Get notified on delivery status changes'},
              {k:'dailyReport', l:'Daily Report', d:'Receive daily sales summary'},
              {k:'weeklyReport', l:'Weekly Report', d:'Receive weekly performance report'},
            ].map(n => (
              <div key={n.k} className='flex items-center justify-between p-4 bg-gray-800 rounded-xl'>
                <div>
                  <p className='text-white text-sm font-medium'>{n.l}</p>
                  <p className='text-gray-400 text-xs mt-0.5'>{n.d}</p>
                </div>
                <button onClick={() => setNotifications({...notifications, [n.k]: !notifications[n.k as keyof typeof notifications]})} className={'w-12 h-6 rounded-full transition-all '+(notifications[n.k as keyof typeof notifications]?'bg-violet-600':'bg-gray-600')}>
                  <div className={'w-5 h-5 bg-white rounded-full transition-all mx-0.5 '+(notifications[n.k as keyof typeof notifications]?'translate-x-6':'translate-x-0')}></div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'subscription' && (
        <div>
          <div className='bg-violet-600/10 border border-violet-500/30 rounded-2xl p-6 mb-6'>
            <div className='flex items-center gap-3 mb-2'>
              <span className='text-2xl'>💎</span>
              <div>
                <p className='text-white font-bold text-lg'>Current Plan: Free</p>
                <p className='text-violet-400 text-sm'>Upgrade to unlock all features</p>
              </div>
            </div>
          </div>
          <div className='grid grid-cols-3 gap-4'>
            {[
              { name:'Starter', price:'Rs 999', period:'/month', color:'from-gray-700 to-gray-900', features:['100 Orders/month','FB + IG Integration','Basic Reports','Email Support'] },
              { name:'Professional', price:'Rs 2,499', period:'/month', color:'from-violet-700 to-violet-900', features:['Unlimited Orders','FB + IG + WA Integration','AI Auto Reply (1000 msgs)','Advanced Reports','Priority Support'], popular:true },
              { name:'Enterprise', price:'Rs 4,999', period:'/month', color:'from-blue-700 to-blue-900', features:['Unlimited Everything','All Integrations','Unlimited AI Replies','Custom Reports','Dedicated Support','Multi-store'] },
            ].map(plan => (
              <div key={plan.name} className={'bg-gradient-to-br '+plan.color+' rounded-2xl p-6 border '+(plan.popular?'border-violet-400':'border-gray-700')}>
                {plan.popular && <span className='text-xs bg-violet-500 text-white px-2 py-1 rounded-full mb-3 inline-block'>Most Popular</span>}
                <h3 className='text-white font-bold text-lg'>{plan.name}</h3>
                <div className='flex items-baseline gap-1 my-3'>
                  <span className='text-2xl font-bold text-white'>{plan.price}</span>
                  <span className='text-gray-400 text-sm'>{plan.period}</span>
                </div>
                <ul className='space-y-2 mb-5'>
                  {plan.features.map(f => (
                    <li key={f} className='text-gray-300 text-sm flex items-center gap-2'>
                      <span className='text-emerald-400'>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button className={'w-full py-2 rounded-xl text-sm font-medium transition-all '+(plan.popular?'bg-white text-violet-700 hover:bg-gray-100':'bg-gray-600 hover:bg-gray-500 text-white')}>
                  {plan.popular ? 'Upgrade Now' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}