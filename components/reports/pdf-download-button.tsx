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
import { shareOrDownload } from '@/lib/file-share'
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

      // ── 2. Share o download via helper compartido (mismo pattern que Excel) ──
      await shareOrDownload({
        blob,
        fileName,
        shareTitle: `Reporte ${periodLabel} · Fiza`,
        mimeType: 'application/pdf',
      })

      if (myId !== reqIdRef.current) return
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
