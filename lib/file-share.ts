'use client'
// Helper compartido entre los botones de PDF y Excel: dado un Blob ya generado,
// decide entre abrir el share sheet nativo (mobile real) o disparar download
// directo (desktop). Misma lógica de detección que pulimos en Phase 1 del PDF.

export async function shareOrDownload(opts: {
  blob: Blob
  fileName: string
  /** Título mostrado en el share sheet nativo cuando aplica */
  shareTitle: string
  /** MIME type del archivo (ej. 'application/pdf' o el de xlsx) */
  mimeType: string
}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const { blob, fileName, shareTitle, mimeType } = opts
  const file = new File([blob], fileName, { type: mimeType })

  // Feature detection: ¿el browser soporta compartir archivos?
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  // Cross-check: solo usamos share sheet en touch devices reales (telefonos,
  // tablets). Chrome/Edge desktop ya soportan canShare pero el UX correcto en
  // laptop sigue siendo download.
  const isTouchDevice =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches

  if (canShareFiles && isTouchDevice) {
    try {
      await navigator.share({ files: [file], title: shareTitle })
      return 'shared'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
      // Cualquier otro error → caemos a download
      console.warn('[file-share] share falló, descargando:', err)
    }
  }

  triggerDownload(blob, fileName)
  return 'downloaded'
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
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 200)
}
