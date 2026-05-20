export function StatsCards() {
  const stats = [
    { label: 'Orders Today', value: '24', icon: '📦', color: 'from-violet-600 to-violet-800' },
    { label: 'Pending Orders', value: '8', icon: '⏳', color: 'from-amber-500 to-amber-700' },
    { label: 'Messages', value: '156', icon: '💬', color: 'from-blue-500 to-blue-700' },
    { label: 'Revenue Today', value: 'Rs 45,200', icon: '💰', color: 'from-emerald-500 to-emerald-700' },
    { label: 'Follow-ups Today', value: '12', icon: '🔔', color: 'from-pink-500 to-pink-700' },
    { label: 'Overdue Follow-ups', value: '5', icon: '⚠️', color: 'from-red-500 to-red-700' },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className={'bg-gradient-to-br ' + stat.color + ' rounded-2xl p-4 shadow-lg'}>
          <div className="text-2xl mb-2">{stat.icon}</div>
          <div className="text-xl font-bold text-white">{stat.value}</div>
          <div className="text-xs text-white/70 mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}