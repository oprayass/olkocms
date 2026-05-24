const {PrismaClient} = require("@prisma/client")
const p = new PrismaClient()
p.user.findFirst().then(u => console.log("DB OK:", u?.email)).catch(e => console.log("DB ERROR:", e.message)).finally(() => p.$disconnect())