'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GameWrapper } from '@/src/components/game/GameWrapper';
import { Leaderboard } from '@/src/components/ui/Leaderboard';
import { saveScore } from '@/src/lib/supabase';
import { useInputMode } from '@/src/hooks/useInputMode';
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
  const router = useRouter();
  const slug = params.slug as string;

  const { inputMode } = useInputMode();
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [gameKey, setGameKey] = useState(0); // to force remount

  const gameId = VALID_GAMES.includes(slug as Game) ? (slug as Game) : null;

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
    },
    [gameId, inputMode],
  );

  const handleScore = useCallback((_score: number) => {
    // Score updates handled by GameWrapper overlay
  }, []);

  const handlePlayAgain = () => {
    setGameOver(false);
    setFinalScore(0);
    setSaved(false);
    setGameKey((k) => k + 1);
  };

  // Invalid game slug
  if (!gameId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-grid">
        <div className="text-center animate-slide-up">
          <p className="text-6xl mb-4">🎮</p>
          <h1 className="text-xl font-bold text-white font-heading mb-2">
            Juego no encontrado
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            El juego &quot;{slug}&quot; no existe.
          </p>
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
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
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
                <div className="text-center animate-slide-up p-6">
                  <p className="text-5xl mb-4">
                    {finalScore > 50 ? '🏆' : finalScore > 20 ? '⭐' : '💪'}
                  </p>

                  <h2 className="text-xl font-bold text-white font-heading mb-1">
                    ¡GAME OVER!
                  </h2>

                  <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-mono mb-1">
                    {finalScore.toLocaleString()}
                  </p>

                  <p className="text-xs text-gray-400 mb-6">
                    {saving ? 'Guardando...' : saved ? '✅ Puntuación guardada' : ''}
                  </p>

                  <div className="flex gap-3 justify-center">
                    <button
                      id="play-again-btn"
                      onClick={handlePlayAgain}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-cyan-500 transition-all cursor-pointer"
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
