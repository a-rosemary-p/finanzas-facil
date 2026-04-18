import type { Metadata, Viewport } from 'next'
import { Lato } from 'next/font/google'
import './globals.css'

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lato',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FinanzasFácil',
  description: 'Control de ingresos y gastos para tu negocio',
  appleWebApp: {
    capable: true,
    title: 'FinanzasFácil',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2E7D32',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`h-full ${lato.variable}`}>
      <body className="font-[family-name:var(--font-lato)]">{children}</body>
    </html>
  )
}
