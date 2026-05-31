import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function isHashed(pw: string): boolean {
  return /^\$2[aby]\$/.test(pw)
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          // USER table
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: { id: true, name: true, email: true, password: true, role: true, subscriptionId: true, passwordChangedAt: true }
          })
          if (user && user.password) {
            let ok = false
            if (isHashed(user.password)) {
              ok = await bcrypt.compare(credentials.password, user.password)
            } else {
              ok = user.password === credentials.password
              if (ok) {
                const h = await bcrypt.hash(credentials.password, 10)
                await prisma.user.update({ where: { id: user.id }, data: { password: h } })
              }
            }
            if (!ok) return null
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role || "admin",
              subscriptionId: user.subscriptionId || null,
              permissions: {},
              accountType: "user",
              pwChangedAt: user.passwordChangedAt ? user.passwordChangedAt.getTime() : 0,
            } as any
          }

          // STAFF table
          const staff = await prisma.staff.findUnique({
            where: { email: credentials.email },
            select: {
              id: true, name: true, email: true, password: true,
              status: true, subscriptionId: true, passwordChangedAt: true,
              canViewDashboard: true, canViewOrders: true, canConfirmOrders: true,
              canViewMessages: true, canReplyMessages: true, canViewStaff: true,
              canManageStaff: true, canViewCourier: true, canManageCourier: true,
              canViewReports: true, canViewPnL: true, canCreateContent: true,
              canPostContent: true, canViewSettings: true, canManageDaraz: true,
            }
          })
          if (staff && staff.password) {
            if (staff.status === "Inactive") return null
            let ok = false
            if (isHashed(staff.password)) {
              ok = await bcrypt.compare(credentials.password, staff.password)
            } else {
              ok = staff.password === credentials.password
              if (ok) {
                const h = await bcrypt.hash(credentials.password, 10)
                await prisma.staff.update({ where: { id: staff.id }, data: { password: h } })
              }
            }
            if (!ok) return null
            return {
              id: staff.id,
              name: staff.name,
              email: staff.email,
              role: "staff",
              subscriptionId: staff.subscriptionId || null,
              permissions: {
                canViewDashboard: staff.canViewDashboard,
                canViewOrders: staff.canViewOrders,
                canConfirmOrders: staff.canConfirmOrders,
                canViewMessages: staff.canViewMessages,
                canReplyMessages: staff.canReplyMessages,
                canViewStaff: staff.canViewStaff,
                canManageStaff: staff.canManageStaff,
                canViewCourier: staff.canViewCourier,
                canManageCourier: staff.canManageCourier,
                canViewReports: staff.canViewReports,
                canViewPnL: staff.canViewPnL,
                canCreateContent: staff.canCreateContent,
                canPostContent: staff.canPostContent,
                canViewSettings: staff.canViewSettings,
                canManageDaraz: staff.canManageDaraz,
              },
              accountType: "staff",
              pwChangedAt: staff.passwordChangedAt ? staff.passwordChangedAt.getTime() : 0,
            } as any
          }
        } catch (e) {
          console.error("Auth error:", e)
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.subscriptionId = (user as any).subscriptionId
        token.permissions = (user as any).permissions
        token.accountType = (user as any).accountType
        token.pwChangedAt = (user as any).pwChangedAt
      }
      return token
    },
    async session({ session, token }) {
      // password change auto-logout check
      const email = session.user?.email
      if (email) {
        const acct = token.accountType === "staff"
          ? await prisma.staff.findUnique({ where: { email }, select: { passwordChangedAt: true } })
          : await prisma.user.findFirst({ where: { email }, select: { passwordChangedAt: true } })
        const dbTime = acct?.passwordChangedAt ? acct.passwordChangedAt.getTime() : 0
        const tokenTime = (token.pwChangedAt as number) || 0
        if (dbTime > tokenTime) {
          return null as any
        }
      }
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).subscriptionId = token.subscriptionId
        ;(session.user as any).permissions = token.permissions
      }
      return session
    }
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "olkocms-secret-key-2024",
}