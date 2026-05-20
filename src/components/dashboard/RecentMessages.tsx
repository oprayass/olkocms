export function RecentMessages() {
  const messages = [
    { name: 'Bikash Thapa', msg: 'Jacket ko price kati ho?', platform: 'FB', time: '2 min' },
    { name: 'Anita Gurung', msg: 'Order kahile aaucha?', platform: 'IG', time: '15 min' },
    { name: 'Suresh KC', msg: 'Cash on delivery huncha?', platform: 'WA', time: '1 hr' },
  ]
  const pc = { FB:'bg-blue-600', IG:'bg-pink-600', WA:'bg-emerald-600' }
  return (
    <div className='bg-gray-900 rounded-2xl p-5 border border-gray-800'>
      <h2 className='text-lg font-semibold text-white mb-4'>Recent Messages</h2>
      <div className='space-y-3'>
        {messages.map((m,i) => (
          <div key={i} className='flex items-start gap-3 bg-gray-800/50 rounded-xl p-3'>
            <div className={pc[m.platform]+' w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold'}>{m.platform}</div>
            <div className='flex-1 min-w-0'>
              <p className='text-white font-medium text-sm'>{m.name}</p>
              <p className='text-gray-400 text-sm truncate'>{m.msg}</p>
            </div>
            <span className='text-gray-500 text-xs'>{m.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}