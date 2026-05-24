import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (user) {
          const passwordMatch = await bcrypt.compare(credentials.password, user.password || "")
          if (!passwordMatch) return null
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role || "admin",
            subscriptionId: (user as any).subscriptionId || null,
            permissions: {},
          }
        }

        const staff = await prisma.staff.findUnique({
          where: { email: credentials.email }
        })

        if (staff) {
          const passwordMatch = await bcrypt.compare(credentials.password, staff.password || "")
          if (!passwordMatch) return null
          if (staff.status === "Inactive") return null
          return {
            id: staff.id,
            name: staff.name,
            email: staff.email,
            role: "staff",
            subscriptionId: (staff as any).subscriptionId || null,
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
          }
        }

        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.subscriptionId = (user as any).subscriptionId
        token.permissions = (user as any).permissions
      }
      return token
    },
    async session({ session, token }) {
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
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }