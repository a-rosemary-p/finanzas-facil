# Fiza — App Spec

> **La spec viva está fuera del repo**, en la carpeta del proyecto.
>
> Versión actual: **v0.27** (abril 26, 2026)
> Archivo: `C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_APP_SPEC v0.27. 260426.md`
>
> Contiene: rutas, API routes (`/api/reports/{movements,compare,trend}`, `/api/transcribe`,
> etc.), schema DB (migrations 001–009), hooks, componentes, tipos, constantes, flujos,
> enforcement Free vs Pro, security headers, rate limiting, y changelogs v0.21 → v0.27.

---

## Reglas operativas (copia rápida para agentes)

- **Next.js 16.2.4** tiene breaking changes. Ver `AGENTS.md` — leer `node_modules/next/dist/docs/` antes de escribir código. El archivo raíz es `proxy.ts`, no `middleware.ts`.
- **Sin emojis en la UI** — usar íconos SVG inline. Catálogo central en `components/icons.tsx`. No agregues `@phosphor-icons/react` ni similares.
- **Tipos** centralizados en `types/index.ts`. **Constantes** en `lib/constants.ts`. No hard-codear inline.
- **Categorías**: `CATEGORIES` (15 activas) para inserts nuevos. `CATEGORIES_ALL` (= activas + 2 legacy `Ingredientes`/`Servicios`) para validators de PATCH — preserva movs viejos al editar. La columna `movements.category` es TEXT libre desde migration 009.
- **Enforcement Free vs Pro va server-side.** Si una restricción depende del plan, NO usar el Supabase client directo desde el browser — usar una API route. Excepción: `/api/reports/compare` ahora es Free + Pro (la diferenciación de tiers vive en cliente con preview difuminado).
- **`profiles` tiene column-level GRANT UPDATE.** Si agregas un campo nuevo editable por el usuario, actualiza la GRANT de migration 007 — de lo contrario los UPDATE del cliente fallan silenciosamente en ese campo.
- **`@react-pdf/renderer`, `recharts`, y `xlsx` solo client-side**: import via `dynamic({ ssr: false })` o `await import()` dentro de un handler. Son libs gordas, no las quieres en el bundle inicial.
- **Webhook de Stripe** usa `SUPABASE_SERVICE_ROLE_KEY` (admin client) — no usar ese cliente en otra parte, salvo `/api/city-stats`. Cada evento entra a `stripe_events` para idempotencia. Si UPDATE matchea 0 filas → fallback por `metadata.supabase_user_id` (parche post-v0.26 integrado a v0.27).
- **`<AppHeader />` es el único header.** No vuelvas a poner uno inline. Si necesitas variar, usa props.
- **CTAs de upgrade van directo a Stripe via `startProCheckout()`** (`lib/upgrade-to-pro.ts`). Nunca rebotes al user con `<a href="/ajustes">`. Excepción: la landing pública (sin sesión).
- **Nunca construir URLs desde `req.url` / `Host`** para redirects cross-origin. Usar `NEXT_PUBLIC_APP_URL` u otra env confiable.
- **Rate limiting** via `lib/rate-limit.ts`. Cualquier endpoint que llame OpenAI u otro servicio caro debe llamar `consumeRateLimit(supabase, user.id, 'bucket')`. Buckets actuales: `entry`, `entry_photo`, `transcribe`. Agregar uno nuevo no requiere migration.
- **Open redirects**: ningún endpoint debe aceptar un `next` / `redirect` param sin allow-list. Ver `app/auth/confirm/route.ts:safeNext` como patrón.
- **CSP activo**: agregar host nuevo al `next.config.ts` si integras algo externo (analytics, captcha, etc.). `worker-src 'self' blob:` ya está incluido (necesario para react-pdf).
- **Mobile vs desktop**: nunca user-agent sniff. Usa `(hover: none) and (pointer: coarse)` media query — patrón canónico en `lib/file-share.ts:shareOrDownload`.
- **`fetchWithAuthRetry` (en `lib/fetch-with-auth.ts`)** debe usarse en TODA llamada cliente a `/api/*`. Sin él, una página abierta >1hr da 401 hasta que el user recargue.
- **Períodos en `/reportes`**: usa los helpers de `lib/periods.ts` (week/month/quarter/year). No reimplementes "qué es la semana actual".
- **Períodos en `/registros`**: distinto set — `today/week/month/year` (`RegistrosPeriod` en `components/registros/period-dropdown.tsx`). Alimenta `/api/reports/compare` que devuelve agregados + sparkline series.
- **Pendientes (`type='pendiente'`) NO van en `/reportes`** — filtradas a SQL. Para feature de `/pendientes` futura.
- **Inversiones excluidas por default de totales** (reportes y registros); siempre marcadas con ícono SVG ↗️.
- **LLM prompts**: extracción de fechas activa — DD/MM mexicano/europeo, NO MM/DD gringo. Si tocas `lib/ai/prompts.ts`, no metas backticks dentro del template literal (rompe el build).
- **Typecheck antes de push, siempre.** Sin excepciones.
