'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { setError('Email ra password haalnos!'); return }
    setLoading(true)
    setError('')
    await new Promise(r => setTimeout(r, 1000))
    if (email === 'admin@olkocms.com' && password === 'admin123') {
      router.push('/dashboard')
    } else {
      setError('Email wa password galat cha!')
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className='min-h-screen bg-gray-950 flex items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='text-center mb-8'>
          <div className='w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl'>🛒</div>
          <h1 className='text-3xl font-bold text-white'>OlkoCMS</h1>
          <p className='text-gray-400 mt-2'>Social Commerce Management</p>
        </div>

        <div className='bg-gray-900 rounded-2xl border border-gray-800 p-8'>
          <h2 className='text-xl font-semibold text-white mb-6'>Welcome back!</h2>

          {error && (
            <div className='bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm mb-4'>
              ⚠️ {error}
            </div>
          )}

          <div className='space-y-4'>
            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Email Address</label>
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                placeholder='admin@olkocms.com'
                className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 transition-colors'
              />
            </div>

            <div>
              <label className='text-gray-400 text-sm mb-1.5 block'>Password</label>
              <div className='relative'>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder='••••••••'
                  className='w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-500 transition-colors pr-12'
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors text-lg'
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className='w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-all text-sm mt-2'
            >
              {loading ? '⏳ Logging in...' : '🔐 Login'}
            </button>
          </div>

          <div className='mt-6 pt-5 border-t border-gray-800'>
            <p className='text-gray-500 text-xs text-center mb-3'>Demo credentials:</p>
            <div className='bg-gray-800 rounded-xl p-3 text-xs space-y-1'>
              <div className='flex justify-between'><span className='text-gray-400'>Email:</span><span className='text-violet-400 font-mono'>admin@olkocms.com</span></div>
              <div className='flex justify-between'><span className='text-gray-400'>Password:</span><span className='text-violet-400 font-mono'>admin123</span></div>
            </div>
          </div>
        </div>

        <p className='text-center text-gray-600 text-xs mt-6'>OlkoCMS v1.0 • Social Commerce Platform</p>
      </div>
    </div>
  )
}