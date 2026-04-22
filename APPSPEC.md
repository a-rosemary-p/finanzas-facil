# Fiza — App Spec

> **La spec viva está fuera del repo**, en la carpeta del proyecto.
>
> Versión actual: **v0.22** (abril 22, 2026)
> Archivo: `C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_APP_SPEC v0.22. 260422.md`
>
> Contiene: rutas, API routes, schema de DB, hooks, componentes, tipos, constantes,
> flujos, enforcement Free vs Pro, y changelog vs v0.21.

---

## Reglas operativas (copia rápida para agentes)

- **Next.js 16.2.4** tiene breaking changes. Ver `AGENTS.md` — leer `node_modules/next/dist/docs/` antes de escribir código.
- **Sin emojis en la UI** — usar íconos SVG inline.
- **Tipos** centralizados en `types/index.ts`. **Constantes** en `lib/constants.ts`. No hard-codear inline.
- **Enforcement Free vs Pro va server-side.** Si una restricción depende del plan, NO usar el Supabase client directo desde el browser — usar una API route.
- **`@react-pdf/renderer` solo client-side**: cualquier import debe ir detrás de `dynamic({ ssr: false })`.
- **Webhook de Stripe** usa `SUPABASE_SERVICE_ROLE_KEY` (admin client) — no usar ese cliente en otra parte.
