/**
 * POST /api/feedback
 *
 * Recibe sugerencias / comentarios / reportes de problemas desde el modal
 * "Comentarios" en la app y los manda por correo a admin@fiza.mx vía Resend.
 *
 * El user NO sabe a qué dirección llega — para él es solo "Comentarios".
 *
 * Validaciones:
 *   - Sesión requerida (capturamos user.id + email para identificar quién)
 *   - kind: 'sugerencia' | 'comentario' | 'problema'
 *   - message: 1-2000 chars
 *
 * Rate limiting: misma bucket compartida que /api/entry (100/hr) para no
 * inflar buckets nuevos. Spam mitigado por sesión + límite duro de chars.
 *
 * Env requerido:
 *   RESEND_API_KEY — de https://resend.com/api-keys
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) {
      return Response.json({ error: 'Body inválido' }, { status: 400 })
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

    // Profile para enriquecer el correo (display_name + plan)
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, plan, ciudad')
      .eq('id', user.id)
      .single()

    const displayName = (profile?.display_name as string | null) ?? (user.email ?? 'Usuario sin nombre')
    const plan       = (profile?.plan as string | null) ?? 'free'
    const ciudad     = (profile?.ciudad as string | null) ?? '—'

    const resend = new Resend(apiKey)

    // Subject corto pero descriptivo para inbox triage
    const subject = `[Fiza · ${KIND_LABEL[kind]}] ${truncate(messageRaw, 60)}`

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; padding: 16px;">
        <h2 style="color:#578466; margin:0 0 12px;">${KIND_LABEL[kind]} — Fiza</h2>
        <p style="white-space: pre-wrap; line-height:1.5; color:#243028; background:#F4F6EB; padding:14px 16px; border-radius:10px; border-left:3px solid #578466;">
${escapeHtml(messageRaw)}
        </p>
        <hr style="border:none; border-top:1px solid #D9E8D0; margin:20px 0;" />
        <p style="color:#6B8C78; font-size:13px; margin:0 0 4px;"><strong>De:</strong> ${escapeHtml(displayName)} (${escapeHtml(user.email ?? 'sin email')})</p>
        <p style="color:#6B8C78; font-size:13px; margin:0 0 4px;"><strong>Plan:</strong> ${escapeHtml(plan)}</p>
        <p style="color:#6B8C78; font-size:13px; margin:0 0 4px;"><strong>Ciudad:</strong> ${escapeHtml(ciudad)}</p>
        <p style="color:#6B8C78; font-size:13px; margin:0;"><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
      </div>
    `

    const text =
`${KIND_LABEL[kind]} — Fiza

${messageRaw}

---
De: ${displayName} (${user.email ?? 'sin email'})
Plan: ${plan}
Ciudad: ${ciudad}
User ID: ${user.id}
`

    const { error: sendError } = await resend.emails.send({
      from: 'Fiza <hola@fiza.mx>',
      to: 'admin@fiza.mx',
      replyTo: user.email ? [user.email] : undefined,
      subject,
      html,
      text,
    })

    if (sendError) {
      console.error('[POST /api/feedback] resend error', sendError)
      return Response.json({ error: 'No se pudo enviar. Intenta de nuevo.' }, { status: 500 })
    }

    // Analytics — útil para entender qué tipo de feedback predomina.
    await trackServer(supabase, user.id, 'feedback_submitted', {
      kind,
      length: messageRaw.length,
    })

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

// HTML escaping mínimo — el mensaje es texto del user, no debe inyectar HTML
// en el correo aunque venga con < > & u otras combinaciones raras.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
