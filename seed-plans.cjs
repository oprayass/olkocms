const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.plan.deleteMany()

  await prisma.plan.createMany({
    data: [
      {
        name: 'Starter',
        priceMonthly: 999,
        priceYearly: 9999,
        maxPages: 1,
        maxStaff: 2,
        aiReply: true,
        darazAccess: false,
        reportsAccess: false,
        isActive: true,
      },
      {
        name: 'Growth',
        priceMonthly: 2499,
        priceYearly: 24999,
        maxPages: 3,
        maxStaff: 5,
        aiReply: true,
        darazAccess: false,
        reportsAccess: true,
        isActive: true,
      },
      {
        name: 'Pro',
        priceMonthly: 4999,
        priceYearly: 49999,
        maxPages: 999,
        maxStaff: 999,
        aiReply: true,
        darazAccess: true,
        reportsAccess: true,
        isActive: true,
      },
    ]
  })

  console.log('Plans seeded!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())