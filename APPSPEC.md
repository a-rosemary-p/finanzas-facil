# Fiza — App Spec

> **La spec viva está fuera del repo**, en la carpeta del proyecto.
>
> Versión actual: **v0.26** (abril 24, 2026 — noche)
> Archivo: `C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_APP_SPEC v0.26. 260424.md`
>
> Contiene: rutas, API routes (`/api/reports/{movements,compare,trend}`, `/api/transcribe`,
> etc.), schema DB (migrations 001–008), hooks, componentes, tipos, constantes, flujos,
> enforcement Free vs Pro, security headers, rate limiting, y changelogs v0.21 → v0.26.

---

## Reglas operativas (copia rápida para agentes)

- **Next.js 16.2.4** tiene breaking changes. Ver `AGENTS.md` — leer `node_modules/next/dist/docs/` antes de escribir código. El archivo raíz es `proxy.ts`, no `middleware.ts`.
- **Sin emojis en la UI** — usar íconos SVG inline.
- **Tipos** centralizados en `types/index.ts`. **Constantes** en `lib/constants.ts`. No hard-codear inline.
- **Enforcement Free vs Pro va server-side.** Si una restricción depende del plan, NO usar el Supabase client directo desde el browser — usar una API route. La DB también tiene un trigger `BEFORE INSERT` en `movements` que enforça el límite Free de último recurso.
- **`profiles` tiene column-level GRANT UPDATE.** Si agregas un campo nuevo editable por el usuario, actualiza la GRANT de migration 007 — de lo contrario los UPDATE del cliente fallan silenciosamente en ese campo.
- **`@react-pdf/renderer`, `recharts`, y `xlsx` solo client-side**: import via `dynamic({ ssr: false })` o `await import()` dentro de un handler. Son libs gordas, no las quieres en el bundle inicial.
- **Webhook de Stripe** usa `SUPABASE_SERVICE_ROLE_KEY` (admin client) — no usar ese cliente en otra parte, salvo `/api/city-stats`. Cada evento entra a `stripe_events` para idempotencia.
- **Nunca construir URLs desde `req.url` / `Host`** para redirects cross-origin. Usar `NEXT_PUBLIC_APP_URL` u otra env confiable.
- **Rate limiting** via `lib/rate-limit.ts`. Cualquier endpoint que llame OpenAI u otro servicio caro debe llamar `consumeRateLimit(supabase, user.id, 'bucket')`. Buckets actuales: `entry`, `entry_photo`, `transcribe`. Agregar uno nuevo no requiere migration.
- **Open redirects**: ningún endpoint debe aceptar un `next` / `redirect` param sin allow-list. Ver `app/auth/confirm/route.ts:safeNext` como patrón.
- **CSP activo**: agregar host nuevo al `next.config.ts` si integras algo externo (analytics, captcha, etc.). `worker-src 'self' blob:` ya está incluido (necesario para react-pdf).
- **Mobile vs desktop**: nunca user-agent sniff. Usa `(hover: none) and (pointer: coarse)` media query — patrón canónico en `lib/file-share.ts:shareOrDownload`.
- **`fetchWithAuthRetry` (en `lib/fetch-with-auth.ts`)** debe usarse en TODA llamada cliente a `/api/*`. Sin él, una página abierta >1hr da 401 hasta que el user recargue. Wired ya en todos los call-sites; no agregar nuevos `fetch()` directos.
- **Períodos en `/reportes`**: usa los helpers de `lib/periods.ts` (week/month/quarter/year). No reimplementes "qué es la semana actual".
- **Pendientes (`type='pendiente'`) NO van en `/reportes`** — filtradas a SQL. Para feature de proyecciones futura.
- **Inversiones excluidas por default de totales** (reportes y dashboard); siempre marcadas con ícono SVG ↗️.
