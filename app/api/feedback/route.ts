/**
 * POST /api/feedback
 *
 * Recibe sugerencias / comentarios / reportes de problemas y los manda
 * por correo a admin@fiza.mx vía Resend.
 *
 * Dos modos:
 *  - Autenticado: si hay sesión, usamos user.id + email + plan + ciudad
 *    automáticamente. Body: { kind, message }.
 *  - Público (landing): sin sesión. Body requiere { kind, message,
 *    name, email }. Replyto va al email del visitor para que el admin
 *    pueda contestarle aunque no tenga cuenta.
 *
 * Anti-abuso del modo público:
 *  - Honeypot field `website` — campo oculto que humanos no llenan; si
 *    viene con valor, devolvemos 200 OK silencioso (el bot cree que
 *    funcionó pero no se manda nada).
 *  - Validación de email format mínimo.
 *  - Cap de mensaje 2000 chars (mismo que el modo auth).
 *
 * Validaciones:
 *  - kind ∈ {sugerencia, comentario, problema}
 *  - message: 1-2000 chars
 *  - (público) name: 1-80 chars, email: formato válido
 *
 * Env requerido:
 *  RESEND_API_KEY — de https://resend.com/api-keys
 */

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { trackServer } from '@/lib/analytics-server'

type FeedbackKind = 'sugerencia' | 'comentario' | 'problema'

const KIND_LABEL: Record<FeedbackKind, string> = {
  sugerencia: 'Sugerencia',
  comentario: 'Comentario',
  problema:   'Problema',
}

// Email regex pragmático — no covers todos los edge cases del RFC pero
// suficiente para detectar typos comunes y descartar entradas vacías.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
    }

    // Honeypot: si viene lleno, fingimos éxito y no mandamos nada.
    // Los bots típicamente llenan TODOS los campos; un humano no toca este.
    if (typeof body['website'] === 'string' && (body['website'] as string).trim().length > 0) {
      return Response.json({ ok: true })
    }

    const kindRaw = body['kind']
    const kind: FeedbackKind | null =
      kindRaw === 'sugerencia' || kindRaw === 'comentario' || kindRaw === 'problema'
        ? kindRaw
        : null
    if (!kind) {
      return Response.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const messageRaw = String(body['message'] ?? '').trim()
    if (messageRaw.length < 1) {
      return Response.json({ error: 'El mensaje no puede estar vacío.' }, { status: 400 })
    }
    if (messageRaw.length > 2000) {
      return Response.json({ error: 'Máximo 2000 caracteres.' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('[POST /api/feedback] missing RESEND_API_KEY')
      return Response.json({ error: 'Configuración del servidor incompleta.' }, { status: 500 })
    }

    // ── Recolectar metadata según modo ──────────────────────────────────
    let displayName: string
    let email: string
    let plan = 'visitor'
    let ciudad = '—'
    let userId: string | null = null

    if (user) {
      // Modo autenticado
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, plan, ciudad')
        .eq('id', user.id)
        .single()

      displayName = (profile?.display_name as string | null) ?? (user.email ?? 'Usuario sin nombre')
      email       = user.email ?? 'sin email'
      plan        = (profile?.plan as string | null) ?? 'free'
      ciudad      = (profile?.ciudad as string | null) ?? '—'
      userId      = user.id
    } else {
      // Modo público — el body debe traer name + email
      const nameRaw  = String(body['name']  ?? '').trim()
      const emailRaw = String(body['email'] ?? '').trim()

      if (nameRaw.length < 1 || nameRaw.length > 80) {
        return Response.json({ error: 'Ingresa tu nombre.' }, { status: 400 })
      }
      if (!EMAIL_RE.test(emailRaw)) {
        return Response.json({ error: 'Correo inválido.' }, { status: 400 })
      }
      displayName = nameRaw
      email       = emailRaw
    }

    const resend = new Resend(apiKey)
    const subject = `[Fiza · ${KIND_LABEL[kind]}${user ? '' : ' · Landing'}] ${truncate(messageRaw, 60)}`

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; padding: 16px;">
        <h2 style="color:#578466; margin:0 0 12px;">${KIND_LABEL[kind]} — Fiza${user ? '' : ' (Landing)'}</h2>
        <p style="white-space: pre-wrap; line-height:1.5; color:#243028; background:#F4F6EB; padding:14px 16px; border-radius:10px; border-left:3px solid #578466;">
${escapeHtml(messageRaw)}
        </p>
        <hr style="border:none; border-top:1px solid #D9E8D0; margin:20px 0;" />
        <p style="color:#6B8C78; font-size:13px; margin:0 0 4px;"><strong>De:</strong> ${escapeHtml(displayName)} (${escapeHtml(email)})</p>
        <p style="color:#6B8C78; font-size:13px; margin:0 0 4px;"><strong>Plan:</strong> ${escapeHtml(plan)}</p>
        ${user ? `<p style="color:#6B8C78; font-size:13px; margin:0 0 4px;"><strong>Ciudad:</strong> ${escapeHtml(ciudad)}</p>` : ''}
        ${userId ? `<p style="color:#6B8C78; font-size:13px; margin:0;"><strong>User ID:</strong> ${escapeHtml(userId)}</p>` : ''}
      </div>
    `

    const text =
`${KIND_LABEL[kind]} — Fiza${user ? '' : ' (Landing)'}

${messageRaw}

---
De: ${displayName} (${email})
Plan: ${plan}
${user ? `Ciudad: ${ciudad}\n` : ''}${userId ? `User ID: ${userId}\n` : ''}`

    const { error: sendError } = await resend.emails.send({
      from: 'Fiza <hola@fiza.mx>',
      to: 'admin@fiza.mx',
      replyTo: EMAIL_RE.test(email) ? [email] : undefined,
      subject,
      html,
      text,
    })

    if (sendError) {
      console.error('[POST /api/feedback] resend error', sendError)
      return Response.json({ error: 'No se pudo enviar. Intenta de nuevo.' }, { status: 500 })
    }

    // Analytics — solo cuando hay sesión (público no tiene user_id).
    if (user) {
      await trackServer(supabase, user.id, 'feedback_submitted', {
        kind,
        length: messageRaw.length,
      })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/feedback]', err)
    return Response.json({ error: 'Error al enviar.' }, { status: 500 })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
