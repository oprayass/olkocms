const {PrismaClient} = require("@prisma/client")
const bcrypt = require("bcryptjs")
const p = new PrismaClient()
async function main() {
  const user = await p.user.findUnique({ where: { email: "admin@olkocms.com" } })
  console.log("User found:", user ? "YES" : "NO")
  if (user) {
    const match = await bcrypt.compare("password123", user.password)
    console.log("Password match:", match)
    console.log("Stored hash:", user.password)
  }
}
main().finally(() => p.$disconnect())