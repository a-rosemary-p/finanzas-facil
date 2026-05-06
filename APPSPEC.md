# Fiza — App Spec

> **La spec viva está fuera del repo**, en la carpeta del proyecto.
>
> Versión actual: **v0.292** (mayo 6, 2026)
> Archivo: `C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_APP_SPEC v0.292. 060526.md`
>
> Contiene: rutas (incl. `/inicio`, `/movimientos`, `/admin/analytics`), API routes (incl. `/api/movimientos`, `/api/reports/period-summary`, `/api/reports/insights`, `/api/track` ahora público, `/api/onboarding/profile-prompt`, `/api/feedback`), schema DB (migrations 001–019), hooks (usePendings con `dueAlertCount`, useRecurring), componentes (inicio/, pendientes/, reports/ con este-periodo + como-voy + charts, FeedbackModal, PageViewTracker en root, onboarding/ con Onboarding tour + ProfilePromptModal), tipos, constantes (24 giros + GIRO_CATEGORIES), flujos, enforcement Base vs Pro, AI insights endpoint con prompt adaptativo a giro + categorías personalizadas, analytics events, page analytics propia, dashboard interno admin, CDMX timezone, style system Tailwind v4, security headers, rate limiting, audit trail, recurrentes, onboarding, y changelogs v0.21 → v0.292.

---

## Reglas operativas (copia rápida para agentes)

- **Next.js 16.2.4** tiene breaking changes. Ver `AGENTS.md` — leer `node_modules/next/dist/docs/` antes de escribir código. El archivo raíz es `proxy.ts`, no `middleware.ts`.
- **Sin emojis en la UI** — usar íconos SVG inline. Catálogo central en `components/icons.tsx`. No agregues `@phosphor-icons/react` ni similares.
- **Tipos** centralizados en `types/index.ts`. **Constantes** en `lib/constants.ts`. No hard-codear inline.
- **Categorías**: `CATEGORIES` (15 genéricas) para fallback cuando el user no tiene giro. **(v0.292) `GIRO_CATEGORIES`** mapea cada giro a `{ ingresos[], gastos[] }`. Los handlers de extracción (`/api/entry`, `/api/entry/photo`) leen `profile.giro` y arman el system prompt con las cats del giro vía `lib/giro-categories.ts`. Validators server-side usan **`isValidCategoryName()`** (cubre genéricas + legacy + todas las cats de todos los giros) — NO uses `CATEGORIES.includes()` ni `CATEGORIES_ALL.includes()` para nuevos checks. La columna `movements.category` es TEXT libre desde migration 009.
- **Enforcement Free vs Pro va server-side.** Si una restricción depende del plan, NO usar el Supabase client directo desde el browser — usar una API route. Excepción: `/api/reports/compare` ahora es Free + Pro (la diferenciación de tiers vive en cliente con preview difuminado).
- **`profiles` tiene column-level GRANT UPDATE.** Si agregas un campo nuevo editable por el usuario, actualiza la GRANT de migration 007 — de lo contrario los UPDATE del cliente fallan silenciosamente en ese campo.
- **`@react-pdf/renderer`, `recharts`, y `exceljs` solo client-side**: import via `dynamic({ ssr: false })` o `await import()` dentro de un handler. Son libs gordas, no las quieres en el bundle inicial. (v0.291: `xlsx` sheetjs reemplazada por `exceljs` porque la community edition no escribe estilos.)
- **Webhook de Stripe** usa `SUPABASE_SERVICE_ROLE_KEY` (admin client) — no usar ese cliente en otra parte, salvo `/api/city-stats`. Cada evento entra a `stripe_events` para idempotencia. Si UPDATE matchea 0 filas → fallback por `metadata.supabase_user_id` (parche post-v0.26 integrado a v0.27).
- **`<AppHeader />` es el único header.** No vuelvas a poner uno inline. Si necesitas variar, usa props.
- **CTAs de upgrade van directo a Stripe via `startProCheckout()`** (`lib/upgrade-to-pro.ts`). Nunca rebotes al user con `<a href="/ajustes">`. Excepción: la landing pública (sin sesión).
- **Pendientes con dirección (v0.28):** `pending_direction` ('ingreso'|'gasto'|null). Al pagar, `usePendings.markAsPaid` la lee. Default 'gasto' para back-compat.
- **Recurrentes son next-only (v0.28):** un pendiente vivo a la vez. `materializeNextPending()` es idempotente. Crear/pausar/borrar via `/api/recurring`. Editar template afecta los próximos, NO el activo.
- **Audit trail (v0.28):** `movement_events` con `event_type` ('created'/'paid'/'edited'/'recurring_materialized') sin CHECK (drop en migration 011). Inmutable (UPDATE/DELETE revocados). CASCADE con movements al borrar.
- **Onboarding (v0.28):** flag `profiles.onboarded_at`. NO uses `total_movements===0` solo. Set via `POST /api/onboarding/complete`.
- **(v0.292) Profile prompt:** segundo paso del onboarding después del primer movimiento. Modal `<ProfilePromptModal>` pide ciudad/estado/giro (todos opcionales). Si user elige giro válido, segundo step muestra las cats personalizadas para confirmar. Trigger en `inicio/page.tsx`: `totalMovements >= 1 && !profilePromptSeenAt && !showOnboarding && mode==='dashboard'`. Persistencia: `POST /api/onboarding/profile-prompt` setea `profile_prompt_seen_at` (migration 019) — "Continuar" y "Ahora no" tienen mismo efecto en DB, solo difiere el evento de analytics.
- **(v0.292) `/admin/analytics`:** dashboard interno protegido por allowlist hardcoded de emails founders. 6 user IDs internos excluidos de TODOS los conteos (filter client-side en `app/admin/analytics/page.tsx`). 2 tabs: Analítica de usuarios + Analítica de página. Sin link en menú — URL directa.
- **(v0.292) Page analytics propia:** `<PageViewTracker>` en ROOT layout (cubre landing/login). Payload con `visitor_id` (localStorage), `session_id` (sessionStorage), `referrer`, UTMs. `/api/track` acepta anónimos via service-role insert; allowlist `ALLOWED_EVENTS` defense-in-depth. Inyecta `country` desde `x-vercel-ip-country` y `device`/`ua` parseados.
- **(v0.292) Excel:** `exceljs` (NO `xlsx`/sheetjs — sin estilos al escribir). NUNCA uses `mergeCells` — preferir `centerContinuous` para que sort/filter no se rompa. Banner brand-deep arriba, "Tipo" celda coloreada por movimiento, borde brand alrededor del área formateada.
- **Nunca construir URLs desde `req.url` / `Host`** para redirects cross-origin. Usar `NEXT_PUBLIC_APP_URL` u otra env confiable.
- **Rate limiting** via `lib/rate-limit.ts`. Cualquier endpoint que llame OpenAI u otro servicio caro debe llamar `consumeRateLimit(supabase, user.id, 'bucket')`. Buckets actuales: `entry`, `entry_photo`, `transcribe`. Agregar uno nuevo no requiere migration.
- **Open redirects**: ningún endpoint debe aceptar un `next` / `redirect` param sin allow-list. Ver `app/auth/confirm/route.ts:safeNext` como patrón.
- **CSP activo**: agregar host nuevo al `next.config.ts` si integras algo externo (analytics, captcha, etc.). `worker-src 'self' blob:` ya está incluido (necesario para react-pdf).
- **Mobile vs desktop**: nunca user-agent sniff. Usa `(hover: none) and (pointer: coarse)` media query — patrón canónico en `lib/file-share.ts:shareOrDownload`.
- **`fetchWithAuthRetry` (en `lib/fetch-with-auth.ts`)** debe usarse en TODA llamada cliente a `/api/*`. Sin él, una página abierta >1hr da 401 hasta que el user recargue.
- **Períodos en `/reportes`**: usa los helpers de `lib/periods.ts` (week/month/quarter/year). No reimplementes "qué es la semana actual".
- **Períodos en `/inicio` (v0.281)**: rolling, no calendario. `RegistrosPeriod = 'global' | 'year' | 'month' | 'week' | 'today'`. Default `global`.
- **(v0.29) `/registros` no existe — es `/inicio`.** Los redirects `/registros[/...]` → `/inicio[/...]` siguen activos en `proxy.ts` para back-compat con bookmarks viejos. Cualquier código nuevo apunta a `/inicio`.
- **(v0.29) `/movimientos` es la página de "ver todo + editar"**, NO `/reportes`. `/reportes` es analítica predefinida con IA. Si necesitas listar movimientos para que el user los edite, mándalo a `/movimientos`. Endpoint nuevo `/api/movimientos` con multi-select de 5 categorías; el clásico `/api/movements` solo lo usan exports y MetricsCard.
- **(v0.29) /reportes tiene 2 tabs**: "Este período" (Free + Pro) con números + barras + donas; "¿Cómo voy?" (Pro only) con AI insights + comparativa actual-vs-anterior. Tendencia se eliminó. AI no autogenera al cambiar período — botón "Analizar con IA" explícito.
- **(v0.29) Endpoint AI `/api/reports/insights`** usa gpt-4.1-mini con prompt adaptativo a `profile.giro`. Pro only. Cache `private, max-age=3600`. Rate limit bucket `insights` 30/hr.
- **(v0.29) Color del Neto en gráficas**: `var(--neto-strong)` (#2E5266) — slate-petróleo. NO usar `var(--pending-text)` (mostaza apagado). Variante muted `var(--neto-soft)` para serie del período anterior.
- **(v0.29) Pendientes alert**: `usePendings` expone DOS contadores. `overdueCount` (`< hoy`) drives la sección "Vencidos" en /pendientes. `dueAlertCount` (`<= hoy`) drives el badge en el header AppHeader. Un pendiente que vence HOY alerta en el header pero no aparece en Vencidos.
- **(v0.281) Timezone CDMX**: cualquier "es hoy?" usa `getAppToday()` de `lib/cdmx-date.ts`. SQL equivalente: `(NOW() AT TIME ZONE 'America/Mexico_City')::date`. Migrations 017 reescribió los 3 funciones que dependían de `CURRENT_DATE` (UTC).
- **(v0.281) Analytics**: registra eventos via `track(name, payload)` (cliente, fire-and-forget) o `trackServer(supabase, userId, name, payload)` (server). Eventos vivos en sección 10 del spec. Tabla `analytics_events` (migration 018) es solo-INSERT desde la app; SELECT solo con service_role.
- **(v0.281) Feedback modal**: el botón "Comentarios" / "Contacto" en /registros y landing usa `<FeedbackModal>` que POSTea a `/api/feedback`. NO `mailto:`. Env `RESEND_API_KEY` requerido.
- **(v0.281) Estilos**: usar utility classes generadas por `@theme` y clases `fz-*` de globals.css. No `style={{}}` inline para color/spacing/shadow/typography. Excepción: state-driven (width%, translateX, max-height) y APIs de lib (recharts/react-pdf).
- **Pendientes (`type='pendiente'`) NO van en `/reportes`** — filtradas a SQL. Para feature de `/pendientes` futura.
- **Inversiones excluidas por default de totales** (reportes y registros); siempre marcadas con ícono SVG ↗️.
- **LLM prompts**: extracción de fechas activa — DD/MM mexicano/europeo, NO MM/DD gringo. Si tocas `lib/ai/prompts.ts`, no metas backticks dentro del template literal (rompe el build).
- **Typecheck antes de push, siempre.** Sin excepciones.
