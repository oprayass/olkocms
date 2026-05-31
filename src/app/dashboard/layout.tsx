import { Sidebar } from '@/components/dashboard/Sidebar'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SessionProvider } from '@/components/SessionProvider'
import SessionGuard from '@/components/SessionGuard'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <SessionProvider session={session}>
      <SessionGuard />
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </SessionProvider>
  )
}