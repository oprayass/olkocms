'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Orders', href: '/dashboard/orders', icon: '📦' },
  { label: 'Messages', href: '/dashboard/messages', icon: '💬' },
  { label: 'Products', href: '/dashboard/products', icon: '🛍️' },
  { label: 'Follow-ups', href: '/dashboard/followups', icon: '🔔' },
  { label: 'Ads', href: '/dashboard/ads', icon: '📢' },
  { label: 'Staff', href: '/dashboard/staff', icon: '👥' },
  { label: 'Activity', href: '/dashboard/activity', icon: '📋' },
  { label: 'Courier', href: '/dashboard/courier', icon: '🚚' },
  { label: 'Reports', href: '/dashboard/reports', icon: '📈' },
  { label: 'Content', href: '/dashboard/content', icon: '✍️' },
  { label: 'Subscriptions', href: '/dashboard/subscriptions', icon: '💳' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
]

export function Sidebar() {
  const path = usePathname()
  const { data: session } = useSession()
  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">OlkoCMS</h1>
        <p className="text-xs text-gray-400 mt-1">Social Commerce</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <Link key={item.href} href={item.href}
            className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' +
              (path === item.href ? 'bg-violet-600 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white">
            {session?.user?.name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{session?.user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{session?.user?.email || ''}</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-2 rounded-xl text-xs text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
          Logout
        </button>
      </div>
    </aside>
  )
}