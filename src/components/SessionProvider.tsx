'use client'
import { SessionProvider as NextSessionProvider } from 'next-auth/react'

export function SessionProvider({ children, session }: { children: React.ReactNode, session: any }) {
  return (
    <NextSessionProvider session={session}>
      {children}
    </NextSessionProvider>
  )
}