import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

// bcrypt hash $2a$ / $2b$ / $2y$ ले सुरु हुन्छ
function isHashed(pw: string): boolean {
  return /^\$2[aby]\$/.test(pw)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const staff = await prisma.staff.findUnique({ where: { email: credentials.email } })
        if (!staff || !staff.password) return null

        let ok = false
        if (isHashed(staff.password)) {
          // hashed — bcrypt compare
          ok = await bcrypt.compare(credentials.password, staff.password)
        } else {
          // legacy plain-text — direct compare, then auto-upgrade to hash
          ok = staff.password === credentials.password
          if (ok) {
            const newHash = await bcrypt.hash(credentials.password, 10)
            await prisma.staff.update({ where: { id: staff.id }, data: { password: newHash } })
          }
        }

        if (!ok) return null
        return { id: staff.id, email: staff.email, name: staff.name, role: staff.role }
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    session({ session, token }) {
      if (session.user) (session.user as any).role = token.role
      return session
    }
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET || 'olkocms-secret-key-2024',
}