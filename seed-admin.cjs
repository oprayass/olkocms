const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()
async function main() {
  const hash = await bcrypt.hash("password123", 10)
  await prisma.user.upsert({
    where: { email: "admin@olkocms.com" },
    update: {},
    create: { name: "Admin", email: "admin@olkocms.com", password: hash, role: "admin" }
  })
  console.log("Admin created!")
}
main().catch(console.error).finally(() => prisma.$disconnect())