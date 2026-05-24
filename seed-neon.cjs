const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const p = new PrismaClient({ datasources: { db: { url: "postgresql://neondb_owner:npg_PF82avdTogxe@ep-bold-moon-apfn4ql8-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" } } })
async function main() {
  const hash = await bcrypt.hash("password123", 10)
  await p.user.upsert({
    where: { email: "admin@olkocms.com" },
    update: { password: hash },
    create: { name: "Admin", email: "admin@olkocms.com", password: hash, role: "admin" }
  })
  console.log("Neon DB admin created!")
}
main().catch(console.error).finally(() => p.$disconnect())