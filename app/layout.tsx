import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const _inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: 'Knowledge Base Search',
  description: 'Semantic search across your company knowledge base',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
