'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCamera } from '@/src/hooks/useCamera';
import { useInputMode } from '@/src/hooks/useInputMode';
import { usePoseDetection } from '@/src/ai/usePoseDetection';
import type { Game, GameInstance } from '@/src/lib/types';
import { Pause, Play, Camera } from 'lucide-react';

interface GameWrapperProps {
  gameId: Game;
  onScore: (score: number) => void;
  onGameOver: (score: number) => void;
}

export function GameWrapper({ gameId, onScore, onGameOver }: GameWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { inputMode, setInputMode } = useInputMode();
  const { videoRef, isReady: cameraReady, error: cameraError } = useCamera();
  const { keypoints, getPoint } = usePoseDetection(
    inputMode === 'camera' ? videoRef : { current: null },
  );

  const [currentScore, setCurrentScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Previous keypoint positions for gesture detection
  const prevNoseYRef = useRef<number | null>(null);
  const prevShoulderYRef = useRef<number | null>(null);
  const flappyArmsRaisedRef = useRef(false);

  // Initialize game
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let game: GameInstance | null = null;

    async function loadGame() {
      if (!containerRef.current) return;

      switch (gameId) {
        case 'flappy': {
          const { FlappyGame } = await import('@/src/games/flappy/FlappyGame');
          game = new FlappyGame(containerRef.current);
          break;
        }
        case 'dino': {
          const { DinoGame } = await import('@/src/games/dino/DinoGame');
          game = new DinoGame(containerRef.current);
          break;
        }
        case 'ironboard': {
          const { IronGame } = await import('@/src/games/ironboard/IronGame');
          game = new IronGame(containerRef.current);
          break;
        }
      }

      if (game) {
        gameRef.current = game;
        game.onGameOver((finalScore) => {
          onGameOver(finalScore);
          if (scoreIntervalRef.current) {
            clearInterval(scoreIntervalRef.current);
          }
        });
        setGameStarted(true);

        // Periodically sync score
        scoreIntervalRef.current = setInterval(() => {
          if (gameRef.current) {
            const s = gameRef.current.getScore();
            setCurrentScore(s);
            onScore(s);
          }
        }, 100);
      }
    }

    void loadGame();

    return () => {
      if (scoreIntervalRef.current) {
        clearInterval(scoreIntervalRef.current);
      }
      game?.destroy();
      gameRef.current = null;
    };
  }, [gameId, onGameOver, onScore]);

  // Camera-based input bridging
  useEffect(() => {
    if (inputMode !== 'camera' || !gameRef.current || !keypoints.length) return;

    const game = gameRef.current;

    if (gameId === 'flappy') {
      // 🏋️ VUELOS LATERALES: Las muñecas deben alinearse a la altura de los hombros
      const leftShoulder = getPoint('left_shoulder');
      const rightShoulder = getPoint('right_shoulder');
      const leftWrist = getPoint('left_wrist');
      const rightWrist = getPoint('right_wrist');
      const leftHip = getPoint('left_hip');
      const rightHip = getPoint('right_hip');

      if (
        leftShoulder && rightShoulder &&
        leftWrist && rightWrist &&
        leftShoulder.score > 0.3 && rightShoulder.score > 0.3 &&
        leftWrist.score > 0.3 && rightWrist.score > 0.3
      ) {
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const tolerance = 40; // Margen de tolerancia vertical (px) para considerar "alineado"

        // Ambas muñecas deben estar a la altura de los hombros (dentro del rango de tolerancia)
        const leftAligned = Math.abs(leftWrist.y - avgShoulderY) < tolerance;
        const rightAligned = Math.abs(rightWrist.y - avgShoulderY) < tolerance;

        if (leftAligned && rightAligned) {
          // Ejercicio bien hecho: ambas muñecas alineadas con hombros
          if (!flappyArmsRaisedRef.current) {
            flappyArmsRaisedRef.current = true;
            game.triggerFlap?.();
          }
        } else {
          // Para resetear, las muñecas deben bajar significativamente (debajo de mitad torso)
          const hipY = (leftHip && rightHip && leftHip.score > 0.3 && rightHip.score > 0.3)
            ? (leftHip.y + rightHip.y) / 2
            : avgShoulderY + 120; // Fallback si no detecta caderas
          const resetLine = (avgShoulderY + hipY) / 2; // Mitad del torso

          if (leftWrist.y > resetLine && rightWrist.y > resetLine) {
            flappyArmsRaisedRef.current = false;
          }
        }
      }
    }

    if (gameId === 'dino') {
      // Jump: both wrists above shoulders
      // Duck: shoulders significantly lower than usual
      const leftShoulder = getPoint('left_shoulder');
      const rightShoulder = getPoint('right_shoulder');
      const leftWrist = getPoint('left_wrist');
      const rightWrist = getPoint('right_wrist');

      if (leftShoulder && rightShoulder && leftShoulder.score > 0.3) {
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

        // Track shoulder baseline
        if (prevShoulderYRef.current === null) {
          prevShoulderYRef.current = avgShoulderY;
        }

        // Jump: wrists above shoulders
        if (
          leftWrist && rightWrist &&
          leftWrist.score > 0.3 && rightWrist.score > 0.3 &&
          leftWrist.y < leftShoulder.y - 30 &&
          rightWrist.y < rightShoulder.y - 30
        ) {
          game.triggerJump?.();
        }

        // Duck: shoulders dropped significantly
        if (avgShoulderY > prevShoulderYRef.current + 50) {
          game.triggerDuck?.();
        }

        prevShoulderYRef.current = avgShoulderY * 0.95 + prevShoulderYRef.current * 0.05;
      }
    }

    if (gameId === 'ironboard') {
      // Tilt based on shoulder angle
      const leftShoulder = getPoint('left_shoulder');
      const rightShoulder = getPoint('right_shoulder');

      if (
        leftShoulder && rightShoulder &&
        leftShoulder.score > 0.3 && rightShoulder.score > 0.3
      ) {
        // Calculate tilt from shoulder difference
        const diff = leftShoulder.y - rightShoulder.y;
        const tilt = Math.max(-1, Math.min(1, diff / 50));
        game.setTilt?.(tilt);
      }
    }
  }, [keypoints, inputMode, gameId, getPoint]);

  // Mouse / keyboard input
  useEffect(() => {
    if (inputMode !== 'mouse' || !gameRef.current) return;

    const game = gameRef.current;

    function handleKeyDown(e: KeyboardEvent) {
      if (!game) return;

      if (gameId === 'flappy' && (e.code === 'Space' || e.code === 'ArrowUp')) {
        e.preventDefault();
        game.triggerFlap?.();
      }
      if (gameId === 'dino') {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
          e.preventDefault();
          game.triggerJump?.();
        }
        if (e.code === 'ArrowDown') {
          e.preventDefault();
          game.triggerDuck?.();
        }
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (gameId === 'ironboard' && game && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const tilt = (e.clientX - centerX) / (rect.width / 2);
        game.setTilt?.(Math.max(-1, Math.min(1, tilt)));
      }
    }

    function handleClick() {
      if (gameId === 'flappy') {
        game?.triggerFlap?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    containerRef.current?.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [inputMode, gameId]);

  // Touch input
  useEffect(() => {
    if (inputMode !== 'touch' || !gameRef.current) return;

    const game = gameRef.current;
    let touchStartY = 0;

    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0].clientY;
      if (gameId === 'flappy') {
        game?.triggerFlap?.();
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (gameId === 'ironboard' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const touchX = e.touches[0].clientX;
        const tilt = (touchX - centerX) / (rect.width / 2);
        game?.setTilt?.(Math.max(-1, Math.min(1, tilt)));
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (gameId === 'dino') {
        const touchEndY = e.changedTouches[0].clientY;
        const diff = touchStartY - touchEndY;
        if (diff > 30) {
          game?.triggerJump?.();
        } else if (diff < -30) {
          game?.triggerDuck?.();
        }
      }
    }

    const el = containerRef.current;
    el?.addEventListener('touchstart', handleTouchStart, { passive: true });
    el?.addEventListener('touchmove', handleTouchMove, { passive: true });
    el?.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el?.removeEventListener('touchstart', handleTouchStart);
      el?.removeEventListener('touchmove', handleTouchMove);
      el?.removeEventListener('touchend', handleTouchEnd);
    };
  }, [inputMode, gameId]);

  const togglePause = useCallback(() => {
    if (!gameRef.current) return;
    if (isPaused) {
      gameRef.current.resume();
    } else {
      gameRef.current.pause();
    }
    setIsPaused(!isPaused);
  }, [isPaused]);

  // Dibujar el esqueleto de IA (líneas y puntos) encima de la cámara
  useEffect(() => {
    if (inputMode !== 'camera' || !canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (videoRef.current.videoWidth > 0 && canvasRef.current.width !== videoRef.current.videoWidth) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
    }

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const edges = [
      ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'], ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
      ['nose', 'left_eye'], ['nose', 'right_eye']
    ];

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00ff00';
    edges.forEach(([p1, p2]) => {
      const kp1 = getPoint(p1);
      const kp2 = getPoint(p2);
      if (kp1 && kp2 && kp1.score > 0.3 && kp2.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });

    ctx.fillStyle = '#ff00ff';
    keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [keypoints, inputMode, getPoint]);

  return (
    <div className="relative w-full max-w-[800px] mx-auto">
      {/* Score overlay */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-3">
        <div className="bg-[#12122a]/90 backdrop-blur-sm border border-[#2a2a4a] rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">SCORE</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">
            {currentScore.toLocaleString()}
          </span>
        </div>

        {/* Pause button */}
        <button
          id="pause-btn"
          onClick={togglePause}
          className="bg-[#12122a]/90 backdrop-blur-sm border border-[#2a2a4a] rounded-xl p-2.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      {/* Input mode indicator */}
      <div className="absolute bottom-2 left-2 z-20">
        <div className="bg-[#12122a]/80 backdrop-blur-sm rounded-lg px-3 py-1 flex gap-1">
          {(['camera', 'touch', 'mouse'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              className={`text-xs px-2 py-1 rounded transition-all cursor-pointer ${
                inputMode === m
                  ? 'bg-purple-600/50 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m === 'camera' ? '📷' : m === 'touch' ? '👆' : '🖱️'}
            </button>
          ))}
        </div>
      </div>

      {/* Pause overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="text-center">
            <p className="text-2xl font-bold text-white font-heading mb-2">PAUSADO</p>
            <button
              onClick={togglePause}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-cyan-500 transition-all cursor-pointer"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Game container */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-2xl overflow-hidden border-2 border-[#2a2a4a] shadow-2xl shadow-purple-500/10 ${
          !gameStarted ? 'min-h-[400px] flex items-center justify-center bg-[#0f0f23]' : ''
        }`}
      >
        {!gameStarted && (
          <div className="text-gray-500 text-sm animate-pulse">Cargando juego...</div>
        )}

        {/* Cámara incrustada dentro del marco del juego */}
        {inputMode === 'camera' && gameStarted && (
          <div className="absolute top-2 right-2 z-20 w-52 h-40 rounded-lg border-2 border-purple-500/40 shadow-lg bg-[#12122a] overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
            />
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]/80">
                <Camera className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/50 p-1">
                <span className="text-[8px] text-red-300 text-center">{cameraError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
