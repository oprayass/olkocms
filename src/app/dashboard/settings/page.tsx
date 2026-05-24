'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Plus, Trash2, RefreshCw } from 'lucide-react'

interface FBPage {
  id: string
  name: string
  pageId: string
  accessToken: string
  platform: 'facebook' | 'instagram'
  status: 'connected' | 'disconnected'
  igAccountId?: string
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('pages')
  const [saved, setSaved] = useState(false)
  const [pages, setPages] = useState<FBPage[]>([
    { id: '1', name: 'Nepali Babu', pageId: '344520078737283', accessToken: '', platform: 'facebook', status: 'connected' },
    { id: '2', name: 'Pink Me', pageId: '296064883592821', accessToken: '', platform: 'facebook', status: 'connected' },
  ])
  const [showAddPage, setShowAddPage] = useState(false)
  const [newPage, setNewPage] = useState({ name: '', pageId: '', accessToken: '', platform: 'facebook', igAccountId: '' })

  const [business, setBusiness] = useState({
    name: 'OlkoCMS Store',
    email: 'store@olkocms.com',
    phone: '9841000000',
    address: 'Kathmandu, Nepal',
    currency: 'NPR',
    timezone: 'Asia/Kathmandu',
  })

  const [ai, setAi] = useState({
    apiKey: '',
    autoReply: true,
    replyLanguage: 'auto',
    replyTone: 'friendly',
    customPrompt: '',
  })

  const [notifications, setNotifications] = useState({
    newOrder: true,
    newMessage: true,
    followupReminder: true,
    deliveryUpdate: true,
    dailyReport: false,
    weeklyReport: true,
  })

  const addPage = () => {
    if (!newPage.name || !newPage.pageId) return
    const page: FBPage = {
      id: Date.now().toString(),
      name: newPage.name,
      pageId: newPage.pageId,
      accessToken: newPage.accessToken,
      platform: newPage.platform as 'facebook' | 'instagram',
      status: 'connected',
      igAccountId: newPage.igAccountId || undefined,
    }
    setPages([...pages, page])
    setNewPage({ name: '', pageId: '', accessToken: '', platform: 'facebook', igAccountId: '' })
    setShowAddPage(false)
  }

  const removePage = (id: string) => setPages(pages.filter(p => p.id !== id))

  const togglePageStatus = (id: string) => {
    setPages(pages.map(p => p.id === id ? { ...p, status: p.status === 'connected' ? 'disconnected' : 'connected' } : p))
  }

  const saveSettings = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const tabs = [
    { k: 'pages', l: '📱 Connected Pages' },
    { k: 'instagram', l: '📸 Instagram' },
    { k: 'whatsapp', l: '💬 WhatsApp' },
    { k: 'business', l: '🏪 Business' },
    { k: 'ai', l: '🤖 AI Settings' },
    { k: 'notifications', l: '🔔 Notifications' },
    { k: 'subscription', l: '💳 Subscription' },
  ]

  const fbPages = pages.filter(p => p.platform === 'facebook')
  const igPages = pages.filter(p => p.platform === 'instagram')

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
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            className={'px-4 py-2 rounded-xl text-sm font-medium transition-all ' + (activeTab === t.k ? 'bg-violet-600 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700 hover:border-gray-500')}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Connected Pages Tab */}
      {activeTab === 'pages' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-white font-medium'>Facebook Pages</h2>
            <button onClick={() => setShowAddPage(!showAddPage)}
              className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm'>
              <Plus className='w-4 h-4' /> Add Page
            </button>
          </div>

          {/* Add Page Form */}
          {showAddPage && (
            <div className='bg-gray-900 rounded-2xl border border-gray-800 p-5'>
              <h3 className='text-white font-medium mb-4'>Connect New Page</h3>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Page Name</label>
                  <input value={newPage.name} onChange={e => setNewPage({ ...newPage, name: e.target.value })}
                    placeholder='My FB Page' className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Platform</label>
                  <select value={newPage.platform} onChange={e => setNewPage({ ...newPage, platform: e.target.value })}
                    className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none'>
                    <option value='facebook'>Facebook</option>
                    <option value='instagram'>Instagram</option>
                  </select>
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Page ID</label>
                  <input value={newPage.pageId} onChange={e => setNewPage({ ...newPage, pageId: e.target.value })}
                    placeholder='1234567890' className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500' />
                </div>
                <div>
                  <label className='text-gray-400 text-xs mb-1 block'>Access Token</label>
                  <input type='password' value={newPage.accessToken} onChange={e => setNewPage({ ...newPage, accessToken: e.target.value })}
                    placeholder='EAAxxxxx...' className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500' />
                </div>
                {newPage.platform === 'instagram' && (
                  <div className='col-span-2'>
                    <label className='text-gray-400 text-xs mb-1 block'>Instagram Account ID</label>
                    <input value={newPage.igAccountId} onChange={e => setNewPage({ ...newPage, igAccountId: e.target.value })}
                      placeholder='Instagram Account ID' className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500' />
                  </div>
                )}
              </div>
              <div className='flex gap-3 mt-4'>
                <button onClick={addPage} className='px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm'>Connect Page</button>
                <button onClick={() => setShowAddPage(false)} className='px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-sm'>Cancel</button>
              </div>
            </div>
          )}

          {/* Facebook Pages List */}
          <div className='space-y-3'>
            {fbPages.map(page => (
              <div key={page.id} className='bg-gray-900 rounded-2xl border border-gray-800 p-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm'>FB</div>
                    <div>
                      <p className='text-white font-medium'>{page.name}</p>
                      <p className='text-gray-400 text-xs'>Page ID: {page.pageId}</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {page.status === 'connected' ? (
                      <span className='flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full'>
                        <CheckCircle className='w-3 h-3' /> Connected
                      </span>
                    ) : (
                      <span className='flex items-center gap-1 text-xs text-red-400 bg-red-500/20 px-2 py-1 rounded-full'>
                        <XCircle className='w-3 h-3' /> Disconnected
                      </span>
                    )}
                    <button onClick={() => togglePageStatus(page.id)}
                      className='p-2 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-all'>
                      <RefreshCw className='w-3.5 h-3.5' />
                    </button>
                    <button onClick={() => removePage(page.id)}
                      className='p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all'>
                      <Trash2 className='w-3.5 h-3.5' />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instagram Tab */}
      {activeTab === 'instagram' && (
        <div className='space-y-4'>
          <div className='bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4'>
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>⏳</span>
              <div>
                <p className='text-amber-400 font-medium'>Meta Business Verification Pending</p>
                <p className='text-gray-400 text-sm mt-1'>Instagram integration will be available after Meta approves your business verification. Currently in review.</p>
              </div>
            </div>
          </div>

          <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
            <div className='flex items-center gap-3 mb-5'>
              <div className='w-9 h-9 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm'>IG</div>
              <div>
                <h2 className='text-white font-medium'>Instagram Integration</h2>
                <p className='text-gray-400 text-xs'>Connect your Instagram Business account</p>
              </div>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Instagram Business Account ID</label>
                <input placeholder='Will be available after Meta approval' disabled
                  className='w-full bg-gray-800/50 border border-gray-700 text-gray-500 placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed' />
              </div>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Access Token</label>
                <input type='password' placeholder='Will be available after Meta approval' disabled
                  className='w-full bg-gray-800/50 border border-gray-700 text-gray-500 placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed' />
              </div>
            </div>

            <div className='mt-5 p-4 bg-gray-800/50 rounded-xl'>
              <p className='text-white text-sm font-medium mb-3'>Instagram Integration Features (Coming Soon):</p>
              <ul className='space-y-2'>
                {[
                  'Instagram DM auto-reply with AI',
                  'Story mention notifications',
                  'Comment auto-response',
                  'Product tagging in posts',
                  'Order from Instagram DM',
                ].map(f => (
                  <li key={f} className='flex items-center gap-2 text-gray-400 text-sm'>
                    <span className='text-violet-400'>→</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <div className='space-y-4'>
          <div className='bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4'>
            <div className='flex items-center gap-3'>
              <span className='text-2xl'>⏳</span>
              <div>
                <p className='text-amber-400 font-medium'>Meta Business Verification Pending</p>
                <p className='text-gray-400 text-sm mt-1'>WhatsApp Business API will be available after Meta approves your business verification.</p>
              </div>
            </div>
          </div>
          <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
            <div className='flex items-center gap-3 mb-5'>
              <div className='w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-sm'>WA</div>
              <div>
                <h2 className='text-white font-medium'>WhatsApp Business API</h2>
                <p className='text-gray-400 text-xs'>Connect WhatsApp Business for automated messaging</p>
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Phone Number ID</label>
                <input placeholder='Will be available after Meta approval' disabled
                  className='w-full bg-gray-800/50 border border-gray-700 text-gray-500 placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed' />
              </div>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Access Token</label>
                <input type='password' placeholder='Will be available after Meta approval' disabled
                  className='w-full bg-gray-800/50 border border-gray-700 text-gray-500 placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none cursor-not-allowed' />
              </div>
            </div>
            <div className='mt-5 p-4 bg-gray-800/50 rounded-xl'>
              <p className='text-white text-sm font-medium mb-3'>WhatsApp Features (Coming Soon):</p>
              <ul className='space-y-2'>
                {[
                  'WhatsApp message auto-reply with AI',
                  'Order confirmation via WhatsApp',
                  'Delivery tracking notifications',
                  'Bulk message broadcasting',
                  'WhatsApp catalog integration',
                ].map(f => (
                  <li key={f} className='flex items-center gap-2 text-gray-400 text-sm'>
                    <span className='text-emerald-400'>→</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Business Tab */}
      {activeTab === 'business' && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
          <h2 className='text-white font-medium mb-5'>Business Information</h2>
          <div className='grid grid-cols-2 gap-4'>
            {[
              { l: 'Store Name', k: 'name', p: 'Your store name' },
              { l: 'Business Email', k: 'email', p: 'store@example.com' },
              { l: 'Phone Number', k: 'phone', p: '98XXXXXXXX' },
              { l: 'Address', k: 'address', p: 'City, Nepal' },
            ].map(f => (
              <div key={f.k}>
                <label className='text-gray-400 text-sm mb-1.5 block'>{f.l}</label>
                <input value={business[f.k as keyof typeof business]} onChange={e => setBusiness({ ...business, [f.k]: e.target.value })}
                  placeholder={f.p} className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              </div>
            ))}
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Currency</label>
              <select value={business.currency} onChange={e => setBusiness({ ...business, currency: e.target.value })}
                className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                <option value='NPR'>NPR — Nepali Rupee</option>
                <option value='USD'>USD — US Dollar</option>
                <option value='INR'>INR — Indian Rupee</option>
              </select>
            </div>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Timezone</label>
              <select value={business.timezone} onChange={e => setBusiness({ ...business, timezone: e.target.value })}
                className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                <option value='Asia/Kathmandu'>Asia/Kathmandu (NPT +5:45)</option>
                <option value='Asia/Kolkata'>Asia/Kolkata (IST +5:30)</option>
                <option value='UTC'>UTC</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
          <h2 className='text-white font-medium mb-5'>AI Auto-Reply Settings</h2>
          <div className='space-y-5'>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Anthropic API Key</label>
              <input type='password' value={ai.apiKey} onChange={e => setAi({ ...ai, apiKey: e.target.value })}
                placeholder='sk-ant-xxxxxxxx' className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500' />
              <p className='text-gray-500 text-xs mt-1'>Get your API key from console.anthropic.com</p>
            </div>
            <div className='flex items-center justify-between p-4 bg-gray-800 rounded-xl'>
              <div>
                <p className='text-white text-sm font-medium'>Auto Reply</p>
                <p className='text-gray-400 text-xs mt-0.5'>Automatically reply to customer messages using AI</p>
              </div>
              <button onClick={() => setAi({ ...ai, autoReply: !ai.autoReply })}
                className={'w-12 h-6 rounded-full transition-all ' + (ai.autoReply ? 'bg-violet-600' : 'bg-gray-600')}>
                <div className={'w-5 h-5 bg-white rounded-full transition-all mx-0.5 ' + (ai.autoReply ? 'translate-x-6' : 'translate-x-0')}></div>
              </button>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Reply Language</label>
                <select value={ai.replyLanguage} onChange={e => setAi({ ...ai, replyLanguage: e.target.value })}
                  className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                  <option value='auto'>Auto Detect</option>
                  <option value='nepali'>Nepali</option>
                  <option value='english'>English</option>
                  <option value='mixed'>Mixed</option>
                </select>
              </div>
              <div>
                <label className='text-gray-400 text-sm mb-1.5 block'>Reply Tone</label>
                <select value={ai.replyTone} onChange={e => setAi({ ...ai, replyTone: e.target.value })}
                  className='w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none'>
                  <option value='friendly'>Friendly</option>
                  <option value='professional'>Professional</option>
                  <option value='casual'>Casual</option>
                </select>
              </div>
            </div>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Custom Prompt (Optional)</label>
              <textarea value={ai.customPrompt} onChange={e => setAi({ ...ai, customPrompt: e.target.value })}
                rows={3} placeholder='You are a helpful assistant for our store...'
                className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-500 resize-none' />
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-6'>
          <h2 className='text-white font-medium mb-5'>Notification Preferences</h2>
          <div className='space-y-3'>
            {[
              { k: 'newOrder', l: 'New Order', d: 'Get notified when a new order is placed' },
              { k: 'newMessage', l: 'New Message', d: 'Get notified when a customer sends a message' },
              { k: 'followupReminder', l: 'Follow-up Reminder', d: 'Remind when follow-up is due' },
              { k: 'deliveryUpdate', l: 'Delivery Update', d: 'Get notified on delivery status changes' },
              { k: 'dailyReport', l: 'Daily Report', d: 'Receive daily sales summary' },
              { k: 'weeklyReport', l: 'Weekly Report', d: 'Receive weekly performance report' },
            ].map(n => (
              <div key={n.k} className='flex items-center justify-between p-4 bg-gray-800 rounded-xl'>
                <div>
                  <p className='text-white text-sm font-medium'>{n.l}</p>
                  <p className='text-gray-400 text-xs mt-0.5'>{n.d}</p>
                </div>
                <button onClick={() => setNotifications({ ...notifications, [n.k]: !notifications[n.k as keyof typeof notifications] })}
                  className={'w-12 h-6 rounded-full transition-all ' + (notifications[n.k as keyof typeof notifications] ? 'bg-violet-600' : 'bg-gray-600')}>
                  <div className={'w-5 h-5 bg-white rounded-full transition-all mx-0.5 ' + (notifications[n.k as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-0')}></div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription Tab */}
      {activeTab === 'subscription' && (
        <div>
          <div className='bg-violet-600/10 border border-violet-500/30 rounded-2xl p-6 mb-6'>
            <div className='flex items-center gap-3 mb-2'>
              <span className='text-2xl'>💳</span>
              <div>
                <p className='text-white font-bold text-lg'>Current Plan: Free</p>
                <p className='text-violet-400 text-sm'>Upgrade to unlock all features</p>
              </div>
            </div>
          </div>
          <div className='grid grid-cols-3 gap-4'>
            {[
              { name: 'Starter', price: 'Rs 999', color: 'from-gray-700 to-gray-900', features: ['100 Orders/month', 'FB Integration', 'Basic Reports', 'Email Support'] },
              { name: 'Professional', price: 'Rs 2,499', color: 'from-violet-700 to-violet-900', features: ['Unlimited Orders', 'FB + IG + WA', 'AI Auto Reply', 'Advanced Reports', 'Priority Support'], popular: true },
              { name: 'Enterprise', price: 'Rs 4,999', color: 'from-blue-700 to-blue-900', features: ['Unlimited Everything', 'All Integrations', 'Unlimited AI', 'Custom Reports', 'Dedicated Support', 'Multi-store'] },
            ].map(plan => (
              <div key={plan.name} className={'bg-gradient-to-br ' + plan.color + ' rounded-2xl p-6 border ' + ((plan as any).popular ? 'border-violet-400' : 'border-gray-700')}>
                {(plan as any).popular && <span className='text-xs bg-violet-500 text-white px-2 py-1 rounded-full mb-3 inline-block'>Most Popular</span>}
                <h3 className='text-white font-bold text-lg'>{plan.name}</h3>
                <div className='flex items-baseline gap-1 my-3'>
                  <span className='text-2xl font-bold text-white'>{plan.price}</span>
                  <span className='text-gray-400 text-sm'>/month</span>
                </div>
                <ul className='space-y-2 mb-5'>
                  {plan.features.map(f => (
                    <li key={f} className='text-gray-300 text-sm flex items-center gap-2'>
                      <span className='text-emerald-400'>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button className={'w-full py-2 rounded-xl text-sm font-medium ' + ((plan as any).popular ? 'bg-white text-violet-700 hover:bg-gray-100' : 'bg-gray-600 hover:bg-gray-500 text-white')}>
                  {(plan as any).popular ? 'Upgrade Now' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}