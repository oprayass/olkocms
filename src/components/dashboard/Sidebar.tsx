'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

const allNav = [
  { label: 'Dashboard',     href: '/dashboard',               icon: '📊', roles: ['admin','staff','subscriber','subscriber_admin'] },
  { label: 'Orders',        href: '/dashboard/orders',        icon: '📦', roles: ['admin','staff','subscriber','subscriber_admin'], perm: 'canViewOrders' },
  { label: 'Messages',      href: '/dashboard/messages',      icon: '💬', roles: ['admin','staff','subscriber','subscriber_admin'], perm: 'canViewMessages' },
  { label: 'Products',      href: '/dashboard/products',      icon: '🛍️', roles: ['admin','staff','subscriber','subscriber_admin'] },
  { label: 'Follow-ups',    href: '/dashboard/followups',     icon: '🔔', roles: ['admin','staff','subscriber','subscriber_admin'] },
  { label: 'Staff',         href: '/dashboard/staff',         icon: '👥', roles: ['admin','subscriber_admin'], perm: 'canViewStaff' },
  { label: 'Activity',      href: '/dashboard/activity',      icon: '📋', roles: ['admin','subscriber_admin'] },
  { label: 'Courier',       href: '/dashboard/courier',       icon: '🚚', roles: ['admin','staff','subscriber_admin'], perm: 'canViewCourier' },
  { label: 'Reports',       href: '/dashboard/reports',       icon: '📈', roles: ['admin','subscriber_admin'], perm: 'canViewReports' },
  { label: 'Content',       href: '/dashboard/content',       icon: '✍️', roles: ['admin','staff','subscriber','subscriber_admin'], perm: 'canCreateContent' },
  { label: 'Subscriptions', href: '/dashboard/subscriptions', icon: '💳', roles: ['admin'] },
  { label: 'Settings',      href: '/dashboard/settings',      icon: '⚙️', roles: ['admin','subscriber_admin'], perm: 'canViewSettings' },
]

const roleLabel: Record<string,string> = {
  admin: 'Admin',
  staff: 'Staff',
  subscriber: 'Business',
  subscriber_admin: 'Biz Admin',
}
const roleColor: Record<string,string> = {
  admin: 'bg-violet-600',
  staff: 'bg-blue-600',
  subscriber: 'bg-emerald-600',
  subscriber_admin: 'bg-orange-500',
}

export function Sidebar() {
  const path = usePathname()
  const { data: session } = useSession()
  const user = session?.user as any
  const role = user?.role || 'admin'
  const perms = user?.permissions || {}

  const visibleNav = allNav.filter(item => {
    if (!item.roles.includes(role)) return false
    if (role === 'admin') return true
    if (role === 'subscriber') return true
    if (role === 'subscriber_admin') return true
    if (item.perm && role === 'staff') return perms[item.perm] === true
    return true
  })

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">OlkoCMS</h1>
        <p className="text-xs text-gray-400 mt-1">Social Commerce</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => (
          <Link key={item.href} href={item.href}
            className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' +
              (path === item.href ? 'bg-violet-600 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-full ${roleColor[role]||'bg-violet-600'} flex items-center justify-center text-sm font-bold text-white`}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <div className="text-center text-xs py-1 rounded-lg mb-3 bg-gray-800 text-gray-400 border border-gray-700">
          {roleLabel[role] || role}
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full py-2 rounded-xl text-xs text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
          Logout
        </button>
      </div>
    </aside>
  )
}