import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres un asistente financiero para pequeños negocios en México. El usuario describe en lenguaje natural los movimientos de su negocio: ventas, gastos, y compromisos futuros.

Extrae todos los movimientos y responde ÚNICAMENTE con un JSON válido. Sin texto adicional, sin markdown, sin backticks.

Formato de respuesta:
{
  "items": [
    {
      "tipo": "ingreso" | "gasto" | "pendiente",
      "descripcion": "descripción corta del movimiento",
      "categoria": "categoría del movimiento",
      "monto": 1500
    }
  ]
}

Reglas:
- tipo "ingreso": dinero que entró al negocio hoy
- tipo "gasto": dinero que salió del negocio hoy
- tipo "pendiente": compromiso futuro mencionado (ej. "mañana pago", "debo", "tengo que pagar")
- monto: número entero en pesos mexicanos, siempre positivo
- categoria: usa categorías simples como "Ventas", "Ingredientes", "Servicios", "Transporte", "Renta", "Servicios básicos", "Otro"
- Si no hay monto claro para un movimiento, omítelo
- Si el usuario menciona "mañana", "la próxima semana", "debo", "tengo que pagar" → es tipo "pendiente"`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { texto } = await req.json()
    if (!texto?.trim()) {
      return NextResponse.json({ error: 'Texto vacío' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `${SYSTEM_PROMPT}\n\nEntrada del usuario: ${texto}`
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(clean)

    const resumen = {
      ingresos: parsed.items.filter((i: { tipo: string }) => i.tipo === 'ingreso').reduce((s: number, i: { monto: number }) => s + i.monto, 0),
      gastos: parsed.items.filter((i: { tipo: string }) => i.tipo === 'gasto').reduce((s: number, i: { monto: number }) => s + i.monto, 0),
      pendientes: parsed.items.filter((i: { tipo: string }) => i.tipo === 'pendiente').reduce((s: number, i: { monto: number }) => s + i.monto, 0),
    }

    return NextResponse.json({ items: parsed.items, resumen })
  } catch {
    return NextResponse.json({ error: 'No pudimos procesar tu entrada. Intenta de nuevo.' }, { status: 500 })
  }
}
