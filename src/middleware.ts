import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/ai-reply/:path*',
    '/api/staff/:path*',
    '/api/orders/:path*',
    '/api/messages/:path*',
    '/api/followups/:path*',
  ],
}