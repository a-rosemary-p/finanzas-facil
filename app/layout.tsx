import type { Metadata, Viewport } from 'next'
import { Outfit, Funnel_Display } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
})

const funnelDisplay = Funnel_Display({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-funnel-display',
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
  themeColor: '#578466',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`h-full ${outfit.variable} ${funnelDisplay.variable}`}>
      <body className="font-[family-name:var(--font-outfit)]">{children}</body>
    </html>
  )
}
