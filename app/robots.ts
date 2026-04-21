import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/api/'],
      },
      {
        // Permitir explícitamente scrapers de redes sociales
        userAgent: [
          'facebookexternalhit',
          'Twitterbot',
          'WhatsApp',
          'LinkedInBot',
        ],
        allow: '/',
      },
    ],
    sitemap: 'https://www.finanzasfacil.mx/sitemap.xml',
  }
}
