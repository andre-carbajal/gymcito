export interface CoachInput {
  gameId: 'flappy' | 'dino' | 'ironboard'
  score: number
  durationSeconds: number   // cuántos segundos duró la partida
  tiltData?: {              // solo ironboard
    leftTiltCount: number   // cuántas veces se inclinó izquierda
    rightTiltCount: number  // cuántas veces se inclinó derecha
    perfectPostureCount: number
  }
}

export interface CoachResponse {
  message: string    // consejo principal
  exercise: string   // ejercicio recomendado
  emoji: string      // emoji motivacional
  loading: boolean
  error?: string
}

export async function getCoachAdvice(input: CoachInput): Promise<CoachResponse> {
  const res = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) throw new Error('Coach API error')
  return res.json()
}
