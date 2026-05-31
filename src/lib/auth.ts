import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

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
        const account = staff || await prisma.user.findFirst({ where: { email: credentials.email } })
        if (!account || !account.password) return null

        const isStaff = !!staff
        let ok = false
        if (isHashed(account.password)) {
          ok = await bcrypt.compare(credentials.password, account.password)
        } else {
          ok = account.password === credentials.password
          if (ok) {
            const newHash = await bcrypt.hash(credentials.password, 10)
            if (isStaff) {
              await prisma.staff.update({ where: { id: account.id }, data: { password: newHash } })
            } else {
              await prisma.user.update({ where: { id: account.id }, data: { password: newHash } })
            }
          }
        }

        if (!ok) return null
        return {
          id: account.id,
          email: account.email,
          name: account.name,
          role: account.role,
          accountType: isStaff ? 'staff' : 'user',
          pwChangedAt: account.passwordChangedAt ? account.passwordChangedAt.getTime() : 0,
        } as any
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.accountType = (user as any).accountType
        token.pwChangedAt = (user as any).pwChangedAt
      }
      return token
    },
    async session({ session, token }) {
      // password change भएको छ कि check — भएको भए session invalid
      const email = session.user?.email
      if (email) {
        const acct = token.accountType === 'staff'
          ? await prisma.staff.findUnique({ where: { email }, select: { passwordChangedAt: true } })
          : await prisma.user.findFirst({ where: { email }, select: { passwordChangedAt: true } })
        const dbTime = acct?.passwordChangedAt ? acct.passwordChangedAt.getTime() : 0
        const tokenTime = (token.pwChangedAt as number) || 0
        // DB मा password change token जारी भएपछि भयो → logout
        if (dbTime > tokenTime) {
          return null as any
        }
      }
      if (session.user) {
        (session.user as any).role = token.role
      }
      return session
    }
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET || 'olkocms-secret-key-2024',
}