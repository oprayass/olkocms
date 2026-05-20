import { StatsCards } from '@/components/dashboard/StatsCards'
import { RecentOrders } from '@/components/dashboard/RecentOrders'
import { RecentMessages } from '@/components/dashboard/RecentMessages'

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back, Admin! Here is what is happening today.</p>
      </div>
      <StatsCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RecentOrders />
        <RecentMessages />
      </div>
    </div>
  )
}