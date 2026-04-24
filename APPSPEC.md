# Fiza — App Spec

> **La spec viva está fuera del repo**, en la carpeta del proyecto.
>
> Versión actual: **v0.25** (abril 24, 2026 — tarde)
> Archivo: `C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_APP_SPEC v0.25. 260424.md`
>
> Contiene: rutas, API routes (incluye `/api/reports/movements`), schema de DB (migrations 001–008),
> hooks, componentes, tipos, constantes, flujos, enforcement Free vs Pro, headers de seguridad,
> rate limiting, y changelogs desde v0.21.

---

## Reglas operativas (copia rápida para agentes)

- **Next.js 16.2.4** tiene breaking changes. Ver `AGENTS.md` — leer `node_modules/next/dist/docs/` antes de escribir código. El archivo raíz es `proxy.ts`, no `middleware.ts`.
- **Sin emojis en la UI** — usar íconos SVG inline.
- **Tipos** centralizados en `types/index.ts`. **Constantes** en `lib/constants.ts`. No hard-codear inline.
- **Enforcement Free vs Pro va server-side.** Si una restricción depende del plan, NO usar el Supabase client directo desde el browser — usar una API route. La DB también tiene un trigger `BEFORE INSERT` en `movements` que enforça el límite Free de último recurso.
- **`profiles` tiene column-level GRANT UPDATE.** Si agregas un campo nuevo editable por el usuario, actualiza la GRANT de migration 007 (o una nueva migration) — de lo contrario los UPDATE del cliente fallan silenciosamente en ese campo.
- **`@react-pdf/renderer` solo client-side**: cualquier import debe ir detrás de `dynamic({ ssr: false })`.
- **Webhook de Stripe** usa `SUPABASE_SERVICE_ROLE_KEY` (admin client) — no usar ese cliente en otra parte, salvo `/api/city-stats`. Cada evento entra a la tabla `stripe_events` para idempotencia; si haces otro webhook nuevo, replicar ese patrón.
- **Nunca construir URLs desde `req.url` / `Host`** para redirects cross-origin. Usar `NEXT_PUBLIC_APP_URL` u otra env confiable.
- **Rate limiting** disponible via `lib/rate-limit.ts`. Cualquier endpoint que llame OpenAI u otro servicio caro debe llamar `consumeRateLimit(supabase, user.id, 'bucket')` antes del trabajo. Agrega bucket nuevo en el file si necesitas; no requiere migration.
- **Open redirects**: ningún endpoint debe aceptar un `next` / `redirect` param sin allow-list. Ver `app/auth/confirm/route.ts:safeNext` como patrón.
- **CSP activo**: agregar un host nuevo al `next.config.ts` si integras algo externo (analytics, captcha, etc.). Sin eso, el browser bloqueará las requests.
