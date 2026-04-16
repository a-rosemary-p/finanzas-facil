import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres un asistente financiero para pequeños negocios en México. El usuario describe en lenguaje natural los movimientos de su negocio: ventas, gastos, y compromisos futuros.

Extrae todos los movimientos y responde ÚNICAMENTE con un JSON válido. Sin texto adicional, sin markdown, sin backticks. Solo el objeto JSON, nada más.

Formato de respuesta:
{"items":[{"tipo":"ingreso","descripcion":"descripción corta","categoria":"Ventas","monto":1500}]}

Reglas:
- tipo "ingreso": dinero que entró al negocio hoy
- tipo "gasto": dinero que salió del negocio hoy
- tipo "pendiente": compromiso futuro mencionado (ej. "mañana pago", "debo", "tengo que pagar")
- monto: número entero en pesos mexicanos, siempre positivo
- categoria: usa exactamente una de: Ventas, Ingredientes, Servicios, Transporte, Renta, Servicios básicos, Otro
- Si no hay monto claro para un movimiento, omítelo
- Si el usuario menciona "mañana", "la próxima semana", "debo", "tengo que pagar" → tipo "pendiente"
- IMPORTANTE: responde SOLO con el JSON, sin texto antes ni después`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function extraerJSON(raw: string): string {
  // 1. Quitar bloques de código markdown
  let s = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  // 2. Buscar el primer { y el último } para extraer solo el objeto JSON
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1)
  }
  return s
}

export async function POST(req: NextRequest) {
  try {
    const { texto, fechaMovimiento } = await req.json()
    if (!texto?.trim()) {
      return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,        // menos creatividad = más consistencia en formato
        responseMimeType: 'application/json',  // fuerza JSON nativo
      },
    })

    const prompt = `${SYSTEM_PROMPT}\n\nEntrada del usuario: ${texto}`
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    console.log('[procesar-entrada] raw:', raw.slice(0, 200))

    const clean = extraerJSON(raw)
    const parsed = JSON.parse(clean)

    if (!Array.isArray(parsed.items)) {
      throw new Error('La respuesta no contiene un array de items')
    }

    // Sanitizar: solo items con tipo válido, descripción y monto numérico > 0
    const TIPOS_VALIDOS = ['ingreso', 'gasto', 'pendiente']
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (parsed.items as any[]).filter(
      (i) =>
        TIPOS_VALIDOS.includes(i.tipo) &&
        typeof i.descripcion === 'string' &&
        i.descripcion.trim() !== '' &&
        typeof i.monto === 'number' &&
        isFinite(i.monto) &&
        i.monto > 0
    ).map((i) => ({
      tipo: i.tipo,
      descripcion: String(i.descripcion).trim(),
      categoria: String(i.categoria ?? 'Otro').trim(),
      monto: Math.round(i.monto),
    }))

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No encontré montos claros en tu entrada. ¿Puedes incluir las cantidades?' },
        { status: 422 }
      )
    }

    const resumen = {
      ingresos:   items.filter((i) => i.tipo === 'ingreso').reduce((s, i) => s + i.monto, 0),
      gastos:     items.filter((i) => i.tipo === 'gasto').reduce((s, i) => s + i.monto, 0),
      pendientes: items.filter((i) => i.tipo === 'pendiente').reduce((s, i) => s + i.monto, 0),
    }

    return NextResponse.json({ items, resumen, fechaMovimiento })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[procesar-entrada] error:', msg)
    // Detectar rate limit de Gemini
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Límite de solicitudes alcanzado. Espera unos segundos e intenta de nuevo.' },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: 'No pudimos procesar tu entrada. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}
