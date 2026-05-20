export function RecentOrders() {
  const orders = [
    { id: '#001', name: 'Ram Bahadur', product: 'Jacket', status: 'Pending', amount: 'Rs 2,500' },
    { id: '#002', name: 'Sita Devi', product: 'Saree', status: 'Delivered', amount: 'Rs 4,200' },
    { id: '#003', name: 'Hari Prasad', product: 'Shoes', status: 'Processing', amount: 'Rs 1,800' },
  ]
  const sc = { Pending:'bg-amber-500/20 text-amber-400', Delivered:'bg-emerald-500/20 text-emerald-400', Processing:'bg-blue-500/20 text-blue-400' }
  return (
    <div className='bg-gray-900 rounded-2xl p-5 border border-gray-800'>
      <h2 className='text-lg font-semibold text-white mb-4'>Recent Orders</h2>
      <div className='space-y-3'>
        {orders.map(o => (
          <div key={o.id} className='flex items-center justify-between bg-gray-800/50 rounded-xl p-3'>
            <div>
              <p className='text-white font-medium'>{o.name}</p>
              <p className='text-gray-400 text-sm'>{o.product}</p>
            </div>
            <div className='text-right'>
              <p className='text-white text-sm'>{o.amount}</p>
              <span className={sc[o.status]+' text-xs px-2 py-1 rounded-full'}>{o.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}