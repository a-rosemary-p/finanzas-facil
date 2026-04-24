'use client'
// Loaded with dynamic({ ssr: false }) — react-pdf no corre server-side.
//
// Botón único que sirve a desktop y mobile sin user-agent sniffing:
//   1. Genera el PDF como Blob (con timeout duro)
//   2. Pregunta al browser si soporta "compartir archivos" (canShare)
//      - SÍ → abre el share sheet nativo (iOS, Android, etc.)
//      - NO → descarga directa via <a download> (laptops/desktops)
//   3. Si share falla por cualquier razón, cae automático a download
//   4. Estado siempre se libera — ningún path deja el botón "Generando..." atorado
//
// Cada click inicia un nuevo "request id"; clicks repetidos cancelan
// silenciosamente el resultado anterior (defensa contra share() colgado).

import { useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { MonthlyReportDoc } from './monthly-report'
import type { Movement } from '@/types'

interface Props {
  /** Slug seguro para nombre de archivo (ej: "2026-04", "2026-Q2", "2026") */
  periodSlug: string
  /** Etiqueta legible para mostrar en el botón y como título del PDF */
  periodLabel: string
  movements: Movement[]
  displayName: string
  giro?: string
  /** Refleja el toggle "Incluir inversiones" de la UI en el cálculo del PDF */
  includeInvestments?: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; msg: string }

const PDF_TIMEOUT_MS = 20_000

function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(tag)), ms)
    p.then(
      v => { clearTimeout(t); resolve(v) },
      e => { clearTimeout(t); reject(e) },
    )
  })
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Cleanup en otro tick — algunos browsers necesitan el <a> en el DOM un microtick más
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 200)
}

export default function PdfDownloadButton({ periodSlug, periodLabel, movements, displayName, giro, includeInvestments }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  // Cada click obtiene un id; resultados de clicks viejos se descartan
  const reqIdRef = useRef(0)

  async function handleClick() {
    const myId = ++reqIdRef.current
    setState({ kind: 'busy' })

    try {
      const logoUrl = window.location.origin + '/logo-green.png'
      const fileName = `fiza-reporte-${periodSlug}.pdf`

      // ── 1. Generar el PDF blob ─────────────────────────────────────────
      const blob = await withTimeout(
        pdf(
          <MonthlyReportDoc
            periodLabel={periodLabel}
            movements={movements}
            displayName={displayName}
            giro={giro}
            logoUrl={logoUrl}
            includeInvestments={includeInvestments}
          />,
        ).toBlob(),
        PDF_TIMEOUT_MS,
        'pdf-timeout',
      )

      if (myId !== reqIdRef.current) return // user clickeó otra vez

      // ── 2. Decidir share vs download por feature detection ─────────────
      const file = new File([blob], fileName, { type: 'application/pdf' })
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })

      // Chrome/Edge desktop ahora soportan Web Share API también, así que
      // canShareFiles=true ya no implica "es móvil". Cruzamos con una media
      // query CSS para detectar input táctil sin hover — eso SÍ es móvil.
      // En laptop/desktop preferimos download directo a Downloads (UX esperado).
      const isTouchDevice =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(hover: none) and (pointer: coarse)').matches

      if (canShareFiles && isTouchDevice) {
        // Mobile path — abrir share nativo. NO le ponemos timeout: el user
        // puede tardarse eligiendo destino (whatsapp, mail, etc.) y eso es
        // normal. Si Safari decide colgar share() (bug histórico), el user
        // simplemente clickea el botón otra vez — el reqId nuevo descarta
        // este branch.
        try {
          await navigator.share({
            files: [file],
            title: `Reporte ${periodLabel} · Fiza`,
          })
          if (myId !== reqIdRef.current) return
          // Share OK
          setState({ kind: 'idle' })
          return
        } catch (err) {
          if (myId !== reqIdRef.current) return
          if (err instanceof Error && err.name === 'AbortError') {
            // User cerró el sheet sin compartir — respetar y volver a idle
            setState({ kind: 'idle' })
            return
          }
          // Cualquier otro error → cae a download como red de seguridad
          console.warn('[PDF] share falló, descargando:', err)
        }
      }

      if (myId !== reqIdRef.current) return

      // ── 3. Download path — desktop + fallback de mobile ─────────────────
      triggerDownload(blob, fileName)
      setState({ kind: 'idle' })
    } catch (err) {
      if (myId !== reqIdRef.current) return
      const msg =
        err instanceof Error && err.message === 'pdf-timeout'
          ? 'Tardó demasiado generar el PDF. Intenta de nuevo.'
          : 'No se pudo generar el PDF. Intenta de nuevo.'
      console.error('[PDF]', err)
      setState({ kind: 'error', msg })
    }
  }

  const busy = state.kind === 'busy'
  const errorMsg = state.kind === 'error' ? state.msg : ''

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        // Permitimos re-click incluso en busy: si share() del intento anterior
        // se colgó, este click reinicia. El reqId descarta el anterior.
        className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity min-h-[48px]"
        style={{ background: 'var(--brand)' }}
      >
        {busy ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round"
              style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Generando PDF...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {`Descargar PDF · ${periodLabel}`}
          </>
        )}
      </button>
      {busy && (
        <p className="text-[11px] text-center" style={{ color: 'var(--brand-mid)' }}>
          Si tarda más de 20 segundos, toca el botón otra vez.
        </p>
      )}
      {errorMsg && (
        <p className="text-xs text-center" style={{ color: 'var(--danger)' }}>{errorMsg}</p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
