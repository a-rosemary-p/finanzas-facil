import { PHOTO_LIMITS } from '@/lib/constants'

// Redimensiona y comprime una imagen en el cliente antes de enviarla al servidor
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

        const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_LIMITS.compressionQuality)
        const base64 = dataUrl.split(',')[1]
        resolve({ base64: base64 ?? '', mimeType: 'image/jpeg' })
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}
