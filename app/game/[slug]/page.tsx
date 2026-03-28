'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GameWrapper } from '@/src/components/game/GameWrapper';
import { Leaderboard } from '@/src/components/ui/Leaderboard';
import { saveScore } from '@/src/lib/supabase';
import { useInputMode } from '@/src/hooks/useInputMode';
import { getCoachAdvice } from '@/src/lib/coach';
import type { Game } from '@/src/lib/types';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';
import Link from 'next/link';

const VALID_GAMES: Game[] = ['flappy', 'dino', 'ironboard'];

const GAME_TITLES: Record<Game, string> = {
  flappy: '🐦 Flappy Bird',
  dino: '🦖 Dino Runner',
  ironboard: '🏄 Iron Board',
};

export default function GamePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [isLandscape, setIsLandscape] = useState(true);

  useEffect(() => {
    function checkOrientation() {
      setIsLandscape(window.innerWidth > window.innerHeight);
    }
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const { inputMode } = useInputMode();
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [gameKey, setGameKey] = useState(0); // to force remount

  const [coach, setCoach] = useState<{
    message: string;
    exercise: string;
    emoji: string;
    loading: boolean;
  }>({ message: '', exercise: '', emoji: '', loading: false });

  const gameStartTimeRef = useRef<number>(Date.now());
  const tiltStatsRef = useRef({ left: 0, right: 0, perfect: 0 });

  const gameId = VALID_GAMES.includes(slug as Game) ? (slug as Game) : null;

  const fetchCoachAdvice = useCallback(
    async (innerFinalScore: number) => {
      setCoach({ message: '', exercise: '', emoji: '', loading: true });
      const duration = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);

      try {
        const result = await getCoachAdvice({
          gameId: slug as any,
          score: innerFinalScore,
          durationSeconds: duration,
          tiltData:
            slug === 'ironboard'
              ? {
                  leftTiltCount: tiltStatsRef.current.left,
                  rightTiltCount: tiltStatsRef.current.right,
                  perfectPostureCount: tiltStatsRef.current.perfect,
                }
              : undefined,
        });
        setCoach({ ...result, loading: false });
      } catch {
        setCoach({
          message: '¡Gran esfuerzo! Sigue entrenando.',
          exercise: 'Estiramiento 5 min',
          emoji: '🏃',
          loading: false,
        });
      }
    },
    [slug]
  );

  const handleGameOver = useCallback(
    async (score: number) => {
      setFinalScore(score);
      setGameOver(true);
      setSaving(true);

      if (gameId) {
        await saveScore(gameId, score, inputMode);
      }

      setSaving(false);
      setSaved(true);
      gameStartTimeRef.current = Date.now(); // resetear para próxima partida
      fetchCoachAdvice(score);
    },
    [gameId, inputMode, fetchCoachAdvice]
  );

  const handleScore = useCallback((_score: number) => {
    // Score updates handled by GameWrapper overlay
  }, []);

  const handlePlayAgain = () => {
    setGameOver(false);
    setFinalScore(0);
    setSaved(false);
    setGameKey((k) => k + 1);
    gameStartTimeRef.current = Date.now();
  };

  // Si está en vertical, mostrar pantalla de "gira el dispositivo":
  if (!isLandscape) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white text-center p-8">
        <span
          className="text-8xl mb-6 animate-spin"
          style={{ animationDuration: '2s' }}
        >
          📱
        </span>
        <h2 className="text-2xl font-bold font-mono mb-3">Gira tu dispositivo</h2>
        <p className="text-gray-400">Este juego requiere modo horizontal (landscape)</p>
      </div>
    );
  }

  // Invalid game slug
  if (!gameId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-grid">
        <div className="text-center animate-slide-up">
          <p className="text-6xl mb-4">🎮</p>
          <h1 className="text-xl font-bold text-white font-heading mb-2">
            Juego no encontrado
          </h1>
          <p className="text-gray-400 text-sm mb-6">El juego &quot;{slug}&quot; no existe.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-cyan-500 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al menú
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-grid">
      {/* Header */}
      <header className="border-b border-[#2a2a4a] bg-[#0a0a12]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-sm font-bold text-white font-heading">
              {GAME_TITLES[gameId]}
            </h1>
          </div>

          <button
            id="game-leaderboard-btn"
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">Ranking</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto px-4 py-6 w-full">
        {/* Game area */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full relative">
            <GameWrapper
              key={gameKey}
              gameId={gameId}
              onScore={handleScore}
              onGameOver={handleGameOver}
            />

            {/* Game Over overlay */}
            {gameOver && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
                <div className="text-center animate-slide-up p-6 overflow-y-auto max-h-full">
                  <p className="text-5xl mb-4">
                    {finalScore > 50 ? '🏆' : finalScore > 20 ? '⭐' : '💪'}
                  </p>

                  <h2 className="text-xl font-bold text-white font-heading mb-1">
                    ¡GAME OVER!
                  </h2>

                  <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-mono mb-1">
                    {finalScore.toLocaleString()}
                  </p>

                  <p className="text-xs text-gray-400 mb-4">
                    {saving ? 'Guardando...' : saved ? '✅ Puntuación guardada' : ''}
                  </p>

                  {/* Coach AI */}
                  <div className="mb-6 bg-[#0f0f23] border border-purple-500/30 rounded-xl p-4 text-left max-w-sm mx-auto shadow-xl">
                    {coach.loading ? (
                      <div className="flex items-center gap-2 text-purple-400 animate-pulse py-2">
                        <span className="text-lg">🤖</span>
                        <span className="text-sm">Tu coach está analizando tu partida...</span>
                      </div>
                    ) : coach.message ? (
                      <div className="animate-slide-up">
                        <div className="flex items-start gap-2 mb-3">
                          <span className="text-2xl">{coach.emoji}</span>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {coach.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 bg-purple-900/30 rounded-lg px-3 py-2 border border-purple-500/10">
                          <span className="text-base">🏋️</span>
                          <p className="text-xs text-purple-300 font-semibold">
                            {coach.exercise}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      id="play-again-btn"
                      onClick={handlePlayAgain}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-cyan-500 transition-all cursor-pointer shadow-lg shadow-purple-900/40"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Jugar de nuevo
                    </button>

                    <Link
                      href="/"
                      className="flex items-center gap-2 px-6 py-3 bg-[#1a1a2e] border border-[#2a2a4a] text-gray-300 font-semibold rounded-xl hover:bg-[#252547] transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Menú
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls hint */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-600">
              {gameId === 'flappy' && inputMode === 'mouse' && 'Click o Espacio para volar'}
              {gameId === 'flappy' && inputMode === 'camera' && 'Levanta las manos por encima de la cabeza para volar'}
              {gameId === 'flappy' && inputMode === 'touch' && 'Toca la pantalla para volar'}
              {gameId === 'dino' && inputMode === 'mouse' && '↑/Espacio para saltar, ↓ para agacharte'}
              {gameId === 'dino' && inputMode === 'camera' && 'Levanta los brazos para saltar, agáchate para esquivar'}
              {gameId === 'dino' && inputMode === 'touch' && 'Desliza arriba para saltar, abajo para agacharte'}
              {gameId === 'ironboard' && inputMode === 'mouse' && 'Mueve el mouse para inclinar la tabla'}
              {gameId === 'ironboard' && inputMode === 'camera' && 'Inclina tus hombros para mover la tabla'}
              {gameId === 'ironboard' && inputMode === 'touch' && 'Desliza el dedo para inclinar la tabla'}
            </p>
          </div>
        </div>

        {/* Leaderboard sidebar */}
        {showLeaderboard && (
          <aside className="w-full lg:w-80 animate-slide-up">
            <Leaderboard game={gameId} />
          </aside>
        )}
      </main>
    </div>
  );
}
