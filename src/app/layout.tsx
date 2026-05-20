import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/dashboard/Sidebar'

export const metadata: Metadata = {
  title: 'OlkoCMS',
  description: 'Social Commerce CMS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white flex min-h-screen">
        {children}
      </body>
    </html>
  )
}