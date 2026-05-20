import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  await prisma.staff.upsert({
    where: { email: 'admin@olkocms.com' },
    update: {},
    create: { name:'Admin', email:'admin@olkocms.com', phone:'9841000000', role:'Admin', status:'Active', password:'admin123', joinDate:'2025-01-01' }
  })

  await prisma.staff.upsert({
    where: { email: 'suman@olkocms.com' },
    update: {},
    create: { name:'Suman Shrestha', email:'suman@olkocms.com', phone:'9841111001', role:'Manager', status:'Active', password:'staff123', joinDate:'2025-01-15' }
  })

  await prisma.staff.upsert({
    where: { email: 'priya@olkocms.com' },
    update: {},
    create: { name:'Priya Maharjan', email:'priya@olkocms.com', phone:'9841111002', role:'Sales', status:'Active', password:'staff123', joinDate:'2025-03-20' }
  })

  const orders = [
    { orderId:'#1001', customerName:'Ram Bahadur', phone:'9841000001', product:'Jacket', quantity:1, price:2500, status:'Pending', courier:'Nepal Can Move', trackingNo:'NCM001234', platform:'FB', address:'Kathmandu' },
    { orderId:'#1002', customerName:'Sita Devi', phone:'9841000002', product:'Saree', quantity:2, price:4200, status:'Delivered', courier:'Upaya Courier', trackingNo:'UPC005678', platform:'IG', address:'Lalitpur' },
    { orderId:'#1003', customerName:'Hari Prasad', phone:'9841000003', product:'Shoes', quantity:1, price:1800, status:'Processing', courier:'Fab Bud', trackingNo:'FAB009012', platform:'WA', address:'Bhaktapur' },
    { orderId:'#1004', customerName:'Gita Kumari', phone:'9841000004', product:'Bag', quantity:3, price:3600, status:'Pending', courier:'', trackingNo:'', platform:'FB', address:'Kathmandu' },
    { orderId:'#1005', customerName:'Bikash Thapa', phone:'9841000005', product:'Watch', quantity:1, price:5500, status:'Confirmed', courier:'Nepal Can Move', trackingNo:'NCM007890', platform:'IG', address:'Pokhara' },
  ]

  for (const order of orders) {
    await prisma.order.upsert({
      where: { orderId: order.orderId },
      update: {},
      create: order
    })
  }

  const messages = [
    { platform:'FB', customerId:'fb_001', customerName:'Bikash Thapa', content:'Bhai yo jacket ko price kati ho?', isFromUs:false, aiReplied:false, replied:false },
    { platform:'IG', customerId:'ig_001', customerName:'Anita Gurung', content:'Order kahile aaucha?', isFromUs:false, aiReplied:true, replied:true, replyText:'Namaste! Tapaaiko order 2-3 din ma deliver hola.' },
    { platform:'WA', customerId:'wa_001', customerName:'Suresh KC', content:'Cash on delivery huncha?', isFromUs:false, aiReplied:false, replied:false },
    { platform:'FB', customerId:'fb_002', customerName:'Priya Shrestha', content:'What is the return policy?', isFromUs:false, aiReplied:false, replied:false },
  ]

  for (const msg of messages) {
    await prisma.message.create({ data: msg }).catch(() => {})
  }

  const followups = [
    { customerName:'Ram Bahadur', phone:'9841000001', platform:'FB', lastMsg:'Jacket ko price sodheko', followupDate:'2026-05-20', status:'Overdue', notes:'Interested in jacket' },
    { customerName:'Gita Kumari', phone:'9841000004', platform:'IG', lastMsg:'Delivery sodhyo', followupDate:'2026-05-21', status:'Today', notes:'Waiting for delivery' },
    { customerName:'Sunita Tamang', phone:'9841000006', platform:'WA', lastMsg:'Discount maageko', followupDate:'2026-05-22', status:'Upcoming', notes:'Offer 10% discount' },
  ]

  for (const f of followups) {
    await prisma.followup.create({ data: f }).catch(() => {})
  }

  console.log('Database seeded successfully!')
}

main().catch(console.error).finally(() => prisma.$disconnect())