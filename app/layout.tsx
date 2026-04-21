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
  title: 'fiza',
  description: 'Control de ingresos y gastos para tu negocio',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon-32.png',
  },
  appleWebApp: {
    capable: true,
    title: 'fiza',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: 'fiza',
    description: 'Control de ingresos y gastos para tu negocio',
    url: 'https://www.fiza.mx',
    siteName: 'fiza',
    images: [{ url: 'https://www.fiza.mx/og.png', width: 1200, height: 630, alt: 'fiza' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'fiza',
    description: 'Control de ingresos y gastos para tu negocio',
    images: ['https://www.fiza.mx/og.png'],
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
