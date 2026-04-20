# FinanzasFácil — App Spec

> Last updated: April 19 2026 10:00PM EST

---

## What Is This

FinanzasFácil is a mobile-first financial tracking web app for small Mexican businesses (taquerías, tiendas, talleres, etc.). The core UX idea: tell the app what happened in natural language, voice, or a photo — the AI organizes everything into structured movements automatically.

Target users: small business owners who currently track finances in a notebook, in their head, or on WhatsApp.

---

## Live URLs

| Environment | URL |
|-------------|-----|
| Production | https://finanzasfacil.mx |
| Vercel project | `finanzas-facil` (team: `team_L2wGI4PUm4JL08FjMM2X2YT0`) |
| Supabase project | `bnqxpmdbjjzqztlajgfl` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + inline CSS variables (see `app/globals.css`) |
| Font | Outfit (Google Fonts, via `next/font`) |
| Auth | Supabase Auth (email + password) |
| Database | Supabase PostgreSQL (with RLS) |
| AI — text parsing | OpenAI `gpt-4.1-mini` (text-only, cheap) |
| AI — image OCR | OpenAI `gpt-4o` (vision, `detail: high`) |
| Payments | Stripe (checkout + billing portal + webhooks) |
| Deployment | Vercel (Pro plan, `maxDuration: 60` on photo route) |

---

## Brand / Design Tokens

All colors are defined as CSS variables in `app/globals.css` — **edit there, changes everywhere**.

```css
--brand:           #578466   /* primary green — buttons, logo, headings */
--brand-mid:       #6B8C78   /* secondary — labels, muted text */
--brand-light:     #92C3A5   /* light green — active borders */
--brand-border:    #D9E8D0   /* hairline borders */
--brand-chip:      #F4F6EB   /* tag / chip backgrounds */
--brand-muted:     #8AAB94   /* placeholder, disabled */
--brand-lime:      #DAE68F   /* income accent */

--income-bg/border/text      /* ingreso colors */
--expense-bg/border/text     /* gasto colors */
--pending-bg/border/text     /* pendiente colors */

--danger / --danger-bg / --danger-border   /* delete, error */
--investment / --investment-text           /* investment flag */
--pro-bg                                   /* Pro plan card */
```

Gradients:
- Login / homepage hero: `linear-gradient(115deg, #92C3A5 25%, #DAE68F 75%)`
- Dashboard / body: `linear-gradient(115deg, #BFDACB 25%, #E8F0B9 75%)`

---

## File Structure

```
finanzas-facil/
├── app/
│   ├── layout.tsx                  Root layout: Outfit font, metadata, favicon
│   ├── globals.css                 CSS variables (brand palette) + base styles
│   ├── page.tsx                    Public homepage (hero, how-it-works, pricing)
│   ├── favicon.svg                 App icon (FF logo, green bg)
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx          Login + register + forgot password
│   │   └── reset-password/page.tsx Password reset (uses Supabase recovery session)
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx      Main app: entry form, metrics, history
│   └── api/
│       ├── entry/route.ts          POST — parse text entry via AI
│       ├── entry/photo/route.ts    POST — OCR + AI parse of image/photo
│       ├── entry/confirm/route.ts  POST — save confirmed movements to DB
│       ├── movements/[id]/route.ts PATCH / DELETE — edit or delete a movement
│       ├── checkout/route.ts       POST — Stripe checkout session (Free → Pro)
│       ├── portal/route.ts         POST — Stripe billing portal session
│       └── webhooks/stripe/route.ts POST — Stripe webhook handler
├── auth/
│   └── confirm/route.ts            GET — Supabase email confirmation callback
├── components/entries/
│   ├── entry-form.tsx              Text input form (textarea + date + voice + photo)
│   ├── photo-button.tsx            Photo upload button (file picker)
│   ├── voice-button.tsx            Voice dictation button (Web Speech API)
│   ├── confirmation-screen.tsx     Editable movement list before saving
│   ├── movement-day-group.tsx      Collapsible group of movements by date
│   └── entry-card.tsx              Single movement card (view + inline edit)
├── hooks/
│   ├── use-auth.ts                 Auth state, profile, logout
│   └── use-entries.ts             Movements list, metrics, filters, pagination
├── lib/
│   ├── constants.ts                All business constants (models, plans, limits, colors)
│   ├── utils.ts                    Date formatting, currency, grouping helpers
│   ├── image-utils.ts              Client-side image resize + contrast boost
│   ├── gemini/
│   │   ├── prompts.ts              AI prompts: OCR transcription, extraction, parsing
│   │   └── parser.ts              JSON → PendingMovement[] with validation
│   ├── openai/
│   │   └── client.ts              OpenAI SDK wrapper: extractTextFromImage, extractFromText, extractFromImage
│   ├── stripe/
│   │   ├── client.ts              Stripe SDK instance
│   │   └── config.ts              Price IDs, plan config
│   └── supabase/
│       ├── client.ts              Browser Supabase client
│       ├── server.ts              Server Supabase client (cookie-based)
│       └── middleware.ts          Session refresh middleware
├── types/
│   └── index.ts                   Canonical TypeScript types
└── middleware.ts                   Route protection (redirects unauthenticated users)
```

---

## Data Schema (Supabase PostgreSQL)

### `profiles`
Extends Supabase `auth.users`. Created automatically on signup via trigger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | FK → auth.users |
| `display_name` | text | |
| `plan` | text | `'free'` \| `'pro'` |
| `stripe_customer_id` | text | nullable |
| `stripe_subscription_id` | text | nullable |
| `movements_today` | int | rolling daily counter |
| `movements_today_date` | date | resets when date changes |
| `created_at` | timestamptz | |

### `entries`
Raw text/image input before it's split into individual movements.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → profiles |
| `raw_text` | text | original input |
| `entry_date` | date | user-selected date |
| `created_at` | timestamptz | |

### `movements`
Individual financial items (one entry can produce multiple movements).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `entry_id` | uuid | FK → entries |
| `user_id` | uuid | FK → profiles (for RLS) |
| `type` | text | `'ingreso'` \| `'gasto'` \| `'pendiente'` |
| `amount` | numeric | always positive, in MXN |
| `description` | text | max 60 chars |
| `category` | text | see categories below |
| `movement_date` | date | when it happened (editable) |
| `is_investment` | boolean | long-term asset flag |
| `original_amount` | numeric | amount in original currency |
| `original_currency` | text | `'MXN'` \| `'USD'` \| `'EUR'` |
| `exchange_rate_used` | numeric | rate applied (1, 17, or 18.5) |
| `created_at` | timestamptz | |

**Categories:** `Ventas`, `Ingredientes`, `Servicios`, `Transporte`, `Renta`, `Servicios básicos`, `Otro`

### RLS
All tables are protected by Row Level Security — users can only read/write their own rows.

---

## Active API Connections

### OpenAI
- **Key:** `OPENAI_API_KEY` (env var)
- **Models:**
  - `gpt-4o` — vision/OCR pass (`lib/constants.ts: VISION_MODEL`)
  - `gpt-4.1-mini` — text parsing (`lib/constants.ts: AI_MODEL`)
- **Usage:** image photo route and text entry route

### Supabase
- **Project:** `bnqxpmdbjjzqztlajgfl`
- **Keys:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Usage:** auth, database, RLS

### Stripe
- **Keys:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Products:** Free (no charge), Pro ($99 MXN/month)
- **Price ID:** `STRIPE_PRO_PRICE_ID` (env var)
- **Webhooks:** `customer.subscription.created/updated/deleted` → updates `profiles.plan`

---

## User Flows

### 1. Register
`/login?mode=register` → Supabase signUp → confirmation email → `/auth/confirm` → `/dashboard`

### 2. Login
`/login` → Supabase signInWithPassword → `/dashboard`

### 3. Record a movement (text)
1. User types in the textarea (or uses voice dictation)
2. POST `/api/entry` → OpenAI `gpt-4.1-mini` extracts movements
3. `ConfirmationScreen` shows editable list
4. User confirms → POST `/api/entry/confirm` → saved to Supabase
5. Dashboard prepends new movements to the list

### 4. Record a movement (photo/image)
1. User taps 📷 or pastes an image
2. `processImage()` resizes + contrast-boosts client-side
3. POST `/api/entry/photo`:
   - **OCR pass:** `gpt-4o` + `detail: high` transcribes raw text
   - **Parse pass:** `gpt-4.1-mini` text-only extracts structured movements
   - **Fallback:** if OCR yields < 20 chars → direct vision parse with `gpt-4o`
4. Same confirmation → save flow as text

### 5. Edit a movement
Tap ✏️ on any movement card → inline edit form → PATCH `/api/movements/[id]`

### 6. Delete a movement
Edit mode → "Borrar movimiento" → confirm → DELETE `/api/movements/[id]`

### 7. Upgrade to Pro
Dashboard → "Mejorar a Pro" → POST `/api/checkout` → Stripe Checkout → webhook updates plan

### 8. Manage subscription
Dashboard → "Gestionar" → POST `/api/portal` → Stripe Billing Portal

---

## Plans & Limits

| | Free | Pro |
|---|------|-----|
| Movements/day | 10 | Unlimited |
| History | 30 days | All time |
| Price | $0 | $99 MXN/month |

Limits enforced server-side in `/api/entry/route.ts` and `/api/entry/photo/route.ts`.

---

## Key Constants (`lib/constants.ts`)

```typescript
AI_MODEL = 'gpt-4.1-mini'        // text parsing model
VISION_MODEL = 'gpt-4o'          // OCR vision model
OCR_MIN_TEXT_LENGTH = 20         // min chars for OCR to be considered successful
EXCHANGE_RATES = { USD_TO_MXN: 17, EUR_TO_MXN: 18.5 }
PHOTO_LIMITS = { maxFileSizeMB: 5, maxDimensionPx: 2048, compressionQuality: 0.8 }
CATEGORIES = ['Ventas','Ingredientes','Servicios','Transporte','Renta','Servicios básicos','Otro']
MOVEMENT_TYPES = ['ingreso','gasto','pendiente']
```

---

## Currency Conversion

AI automatically converts USD and EUR to MXN:
- 1 USD = 17 MXN
- 1 EUR = 18.5 MXN

Each movement stores `original_amount`, `original_currency`, and `exchange_rate_used` for audit trail.

---

## Investment Flag

Movements can be flagged as `is_investment: true` (long-term assets: machinery, vehicles, equipment). These are excluded from the default metrics view. User can toggle "Incluir inversiones" to include them.

---

## Image Processing Pipeline

```
Client:
  File → resize (max 2048px) → contrast boost (factor 1.25) → JPEG 0.8

Server (/api/entry/photo):
  1. OCR pass: gpt-4o + detail:high → raw text transcription
  2. Parse pass: gpt-4.1-mini (text only) → structured JSON movements
  3. Fallback: if OCR < 20 chars → gpt-4o vision + full prompt
```

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRO_PRICE_ID
```
