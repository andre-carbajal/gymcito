import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Caché en memoria para no desperdiciar requests
const responseCache = new Map<string, any>()

const GAME_NAMES: Record<string, string> = {
  flappy: 'Flappy Bird (control con muñecas)',
  dino: 'Dino Run (saltos y agachadas)',
  ironboard: 'Iron Board (equilibrio y postura)',
}

const GAME_MUSCLES: Record<string, string> = {
  flappy: 'coordinación mano-ojo, movilidad de muñecas y hombros',
  dino: 'piernas, core, reflejos y agilidad',
  ironboard: 'equilibrio, core, estabilidad lateral y postura',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { gameId, score, durationSeconds, tiltData } = body

    // Caché: agrupar scores similares cada 50 puntos
    const cacheKey = `${gameId}-${Math.floor(score / 50)}`
    if (responseCache.has(cacheKey)) {
      return NextResponse.json(responseCache.get(cacheKey))
    }

    const gameName = GAME_NAMES[gameId] || gameId
    const muscles = GAME_MUSCLES[gameId] || 'cuerpo completo'

    let extraContext = ''
    if (tiltData && gameId === 'ironboard') {
      const dominant = tiltData.leftTiltCount > tiltData.rightTiltCount
        ? 'izquierda' : 'derecha'
      const weaker = dominant === 'izquierda' ? 'derecha' : 'izquierda'
      extraContext = `
        Se inclinó ${tiltData.leftTiltCount} veces a la izquierda
        y ${tiltData.rightTiltCount} veces a la derecha.
        Lado dominante: ${dominant}. Lado a mejorar: ${weaker}.
        Momentos de postura perfecta: ${tiltData.perfectPostureCount}.
      `
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',   // el más barato, ~$0.00015 por request
      max_tokens: 200,
      temperature: 0.85,      // variación para no repetir mensajes
      response_format: { type: 'json_object' },  // fuerza JSON directo
      messages: [
        {
          role: 'system',
          content: `Eres un coach fitness motivador experto en ejercicio funcional.
                    Responde SIEMPRE con JSON válido: 
                    { "message": string, "exercise": string, "emoji": string }
                    - message: máximo 60 palabras, menciona el score exacto, informal y motivador
                    - exercise: 1 ejercicio concreto con series/reps, máximo 20 palabras
                    - emoji: 1 solo emoji motivacional`
        },
        {
          role: 'user',
          content: `Juego: ${gameName}
                    Score: ${score} puntos
                    Duración: ${durationSeconds} segundos
                    Músculos trabajados: ${muscles}
                    ${extraContext}`
        }
      ],
    })

    const text = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(text)

    const response = {
      message: parsed.message,
      exercise: parsed.exercise,
      emoji: parsed.emoji,
      loading: false,
    }

    // Guardar en caché
    responseCache.set(cacheKey, response)

    return NextResponse.json(response)

  } catch (err) {
    console.error('[Coach API] Error:', (err as any)?.message)
    return NextResponse.json({
      message: '¡Buen esfuerzo! Cada partida mejora tu coordinación y fuerza funcional.',
      exercise: 'Planchas 3x20 segundos',
      emoji: '💪',
      loading: false,
    })
  }
}
