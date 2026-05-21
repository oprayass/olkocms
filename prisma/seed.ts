import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  await prisma.staff.upsert({
    where: { email: 'admin@olkocms.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@olkocms.com', phone: '9841000000', role: 'Admin', status: 'Active', password: await bcrypt.hash('admin123', 10), joinDate: '2025-01-01' }
  })

  await prisma.staff.upsert({
    where: { email: 'suman@olkocms.com' },
    update: {},
    create: { name: 'Suman Shrestha', email: 'suman@olkocms.com', phone: '9841111001', role: 'Manager', status: 'Active', password: await bcrypt.hash('staff123', 10), joinDate: '2025-01-15' }
  })

  await prisma.staff.upsert({
    where: { email: 'priya@olkocms.com' },
    update: {},
    create: { name: 'Priya Maharjan', email: 'priya@olkocms.com', phone: '9841111002', role: 'Sales', status: 'Active', password: await bcrypt.hash('staff123', 10), joinDate: '2025-03-20' }
  })

  console.log('Database seeded successfully!')
}

main().catch(console.error).finally(() => prisma.$disconnect())