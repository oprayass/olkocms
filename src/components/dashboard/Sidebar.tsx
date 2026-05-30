'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import {
  ChevronDown, LayoutDashboard, Package, MessageSquare, ShoppingBag,
  Bell, Megaphone, Users, ClipboardList, Truck, PenLine, CreditCard,
  Settings, Store, ShoppingCart, BarChart3
} from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Orders', href: '/dashboard/orders', Icon: Package },
  { label: 'Messages', href: '/dashboard/messages', Icon: MessageSquare },
  { label: 'Products', href: '/dashboard/products', Icon: ShoppingBag },
  { label: 'Follow-ups', href: '/dashboard/followups', Icon: Bell },
  { label: 'Ads', href: '/dashboard/ads', Icon: Megaphone },
  { label: 'Staff', href: '/dashboard/staff', Icon: Users },
  { label: 'Activity', href: '/dashboard/activity', Icon: ClipboardList },
  { label: 'Courier', href: '/dashboard/courier', Icon: Truck },
  { label: 'Content', href: '/dashboard/content', Icon: PenLine },
  { label: 'Subscriptions', href: '/dashboard/subscriptions', Icon: CreditCard },
  { label: 'Settings', href: '/dashboard/settings', Icon: Settings },
  { label: 'Daraz Stores', href: '/dashboard/settings/daraz-stores', Icon: Store },
]

const darazLinks = [
  { label: 'Overview', href: '/dashboard/daraz' },
  { label: 'Orders', href: '/dashboard/daraz/orders' },
  { label: 'Returns List', href: '/dashboard/daraz/returns-list' },
  { label: 'Outbound', href: '/dashboard/daraz/outbound' },
  { label: 'Returns Scan', href: '/dashboard/daraz/returns' },
  { label: 'Claims', href: '/dashboard/daraz/claims' },
  { label: 'Alerts', href: '/dashboard/daraz/alerts' },
  { label: 'Import', href: '/dashboard/daraz/import' },
]

const reportLinks = [
  { label: 'Sales Reports', href: '/dashboard/reports' },
  { label: 'Financial Reports', href: '/dashboard/reports/financial' },
  { label: 'Performance', href: '/dashboard/reports/performance' },
]

export function Sidebar() {
  const path = usePathname()
  const { data: session } = useSession()
  const [darazOpen, setDarazOpen] = useState(path.startsWith('/dashboard/daraz'))
  const [reportsOpen, setReportsOpen] = useState(path.startsWith('/dashboard/reports'))

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-5 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">OlkoCMS</h1>
        <p className="text-xs text-gray-400 mt-1">Social Commerce</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.Icon
          return (
            <Link key={item.href} href={item.href}
              className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' +
                (path === item.href ? 'bg-violet-600 text-white font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}

        {/* Daraz expandable */}
        <button
          onClick={() => setDarazOpen(!darazOpen)}
          className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' +
            (path.startsWith('/dashboard/daraz') ? 'bg-orange-600/20 text-orange-400 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
          <ShoppingCart className="w-4 h-4" />
          <span className="flex-1 text-left">Daraz</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${darazOpen ? 'rotate-180' : ''}`} />
        </button>
        {darazOpen && (
          <div className="ml-4 pl-3 border-l border-gray-700 space-y-1">
            {darazLinks.map((item) => (
              <Link key={item.href} href={item.href}
                className={'flex items-center px-3 py-2 rounded-lg text-xs transition-all ' +
                  (path === item.href ? 'bg-orange-500/20 text-orange-400 font-medium' : 'text-gray-500 hover:bg-gray-800 hover:text-white')}>
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/* Reports expandable */}
        <button
          onClick={() => setReportsOpen(!reportsOpen)}
          className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' +
            (path.startsWith('/dashboard/reports') ? 'bg-violet-600/20 text-violet-400 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}>
          <BarChart3 className="w-4 h-4" />
          <span className="flex-1 text-left">Reports</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${reportsOpen ? 'rotate-180' : ''}`} />
        </button>
        {reportsOpen && (
          <div className="ml-4 pl-3 border-l border-gray-700 space-y-1">
            {reportLinks.map((item) => (
              <Link key={item.href} href={item.href}
                className={'flex items-center px-3 py-2 rounded-lg text-xs transition-all ' +
                  (path === item.href ? 'bg-violet-500/20 text-violet-400 font-medium' : 'text-gray-500 hover:bg-gray-800 hover:text-white')}>
                {item.label}
              </Link>
            ))}
          </div>
        )}
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