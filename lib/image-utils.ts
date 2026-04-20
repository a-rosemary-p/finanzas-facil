import { PHOTO_LIMITS } from '@/lib/constants'

// Boost de contraste aplicado al canvas antes de enviar al OCR.
// Factor 1.25 mejora la legibilidad de texto en fotos con iluminación despareja
// sin distorsionar imágenes normales.
function applyContrastBoost(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const factor = 1.25 // suave — suficiente para texto sin quemar colores

  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.min(255, Math.max(0, (data[i]   - 128) * factor + 128)) // R
    data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * factor + 128)) // G
    data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * factor + 128)) // B
    // alpha (i+3) sin tocar
  }

  ctx.putImageData(imageData, 0, 0)
}

// Redimensiona, aplica boost de contraste y comprime una imagen en el cliente
// antes de enviarla al servidor para el pipeline OCR+LLM.
export async function processImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const max = PHOTO_LIMITS.maxDimensionPx

        // Redimensionar si supera el máximo (mantiene aspect ratio)
        if (width > max || height > max) {
          if (width >= height) {
            height = Math.round((height * max) / width)
            width = max
          } else {
            width = Math.round((width * max) / height)
            height = max
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas no disponible')); return }

        ctx.drawImage(img, 0, 0, width, height)

        // Boost de contraste: mejora legibilidad de texto en tickets y notas
        applyContrastBoost(ctx, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_LIMITS.compressionQuality)
        const base64 = dataUrl.split(',')[1]
        resolve({ base64: base64 ?? '', mimeType: 'image/jpeg' })
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}
