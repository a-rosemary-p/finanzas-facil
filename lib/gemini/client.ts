import { GoogleGenerativeAI } from '@google/generative-ai'

// Singleton del cliente Gemini — solo se instancia una vez por proceso
let _client: GoogleGenerativeAI | null = null

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY no configurada')
    _client = new GoogleGenerativeAI(key)
  }
  return _client
}

export function getExtractionModel() {
  return getGeminiClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  })
}
