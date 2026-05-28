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
    // v1.0.1: status bar blanca para matchear el header blanco del app —
    // elimina la línea visible de transición que Android dibuja cuando los
    // dos colores son muy distintos. background_color se mantiene en brand
    // verde porque es para el splash screen (momentáneo) y da identidad.
    theme_color: '#FFFFFF',
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
