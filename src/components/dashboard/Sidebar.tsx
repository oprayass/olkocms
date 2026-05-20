'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Orders', href: '/dashboard/orders', icon: '📦' },
  { label: 'Messages', href: '/dashboard/messages', icon: '💬' },
  { label: 'Follow-ups', href: '/dashboard/followups', icon: '🔔' },
  { label: 'Staff', href: '/dashboard/staff', icon: '👥' },
  { label: 'Courier', href: '/dashboard/courier', icon: '🚚' },
  { label: 'Reports', href: '/dashboard/reports', icon: '📈' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
]

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">OlkoCMS</h1>
        <p className="text-xs text-gray-400 mt-1">Social Commerce</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' +
              (path === item.href
                ? 'bg-violet-600 text-white font-medium'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white')}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold">A</div>
          <div>
            <p className="text-sm text-white font-medium">Admin</p>
            <p className="text-xs text-gray-400">admin@olkocms.com</p>
          </div>
        </div>
      </div>
    </aside>
  )
}