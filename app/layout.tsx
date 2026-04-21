import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'FinanzasFácil',
  description: 'Control de ingresos y gastos para tu negocio',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'FinanzasFácil',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'FinanzasFácil',
    description: 'Control de ingresos y gastos para tu negocio',
    url: 'https://www.finanzasfacil.mx',
    siteName: 'FinanzasFácil',
    images: [{ url: 'https://www.finanzasfacil.mx/og', width: 1200, height: 630, alt: 'FinanzasFácil' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FinanzasFácil',
    description: 'Control de ingresos y gastos para tu negocio',
    images: ['https://www.finanzasfacil.mx/og'],
  },
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
    <html lang="es" className={`h-full ${outfit.variable}`}>
      <body className="font-[family-name:var(--font-outfit)]">{children}</body>
    </html>
  )
}
