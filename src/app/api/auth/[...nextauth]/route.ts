import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        
        const user = await prisma.staff.findUnique({
          where: { email: credentials.email }
        })
        
        if (!user) return null
        
        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null
        
        return { id: user.id.toString(), name: user.name, email: user.email, role: user.role }
      }
    })
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }