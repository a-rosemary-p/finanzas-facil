/**
 * Web App Manifest (PWA + TWA) — v1.0.
 *
 * Next.js 16 sirve este archivo en `/manifest.webmanifest` automáticamente.
 *
 * Usado por:
 *  - Browsers móviles para "Add to Home Screen"
 *  - Trusted Web Activity (Bubblewrap) que genera el shell Android leyendo
 *    este manifest. Cambiar `name`, `theme_color` o `icons` requiere
 *    rebuild del .aab y subir nueva versión a Play Console.
 *
 * Decisiones:
 *  - `start_url: '/inicio'` — la primera pantalla útil para users autenticados.
 *    Si no hay sesión, el middleware redirige a /login.
 *  - `display: 'standalone'` — TWA usa esto para esconder URL bar.
 *  - `theme_color` matchea el header bar nativo en Android.
 *  - `background_color` se usa para splash screen mientras carga.
 *  - 4 íconos: 2 `any` (PWA estándar) + 2 `maskable` (Android adaptive icons,
 *    con safe zone para que la máscara del launcher no recorte el logo).
 */

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fiza — Finanzas para tu negocio',
    short_name: 'Fiza',
    description: 'Lleva las cuentas de tu negocio con voz, foto o texto. Sabe cuánto realmente ganas.',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // v1.0.2: regreso al verde brand para status bar — look más diseñado /
    // brandeado. La línea de transición que Android dibuja es aceptable
    // estéticamente comparado con perder la identidad de marca.
    theme_color: '#578466',
    background_color: '#578466',
    lang: 'es-MX',
    dir: 'ltr',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
