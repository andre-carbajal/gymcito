'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCamera } from '../../hooks/useCamera';
import { useInputMode } from '../../hooks/useInputMode';
import { usePoseDetection } from '../../ai/usePoseDetection';
import type { Game, GameInstance } from '../../lib/types';
import { Pause, Play, Camera } from 'lucide-react';

// ── Diagnostic prefix ────────────────────────────────────────────────────────
const TAG = '[GameWrapper]';

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
  const [selectedTheme, setSelectedTheme] = useState<'desert' | 'jungle' | 'night'>('desert');

  // ── Gesture detection state ────────────────────────────────────────────────
  const prevNoseYRef = useRef<number | null>(null);
  const prevTrackYRef = useRef<number | null>(null); // used for dino jump delta
  const baselineShoulderYRef = useRef<number | null>(null);
  const jumpCooldownRef = useRef<number>(0);
  const duckActiveRef = useRef<boolean>(false);
  const flappyArmsRaisedRef = useRef(false);

  /** Switches the game theme and restarts */
  const handleThemeChange = useCallback((theme: 'desert' | 'jungle' | 'night') => {
    setSelectedTheme(theme);
    if (gameRef.current && gameId === 'dino') {
      gameRef.current.restartWithTheme?.(theme);
    }
  }, [gameId]);

  // ── Diagnostic: log camera state ─────────────────────────────────────────
  useEffect(() => {
    if (cameraError) {
      console.error(`${TAG} ❌ Camera error: ${cameraError}`);
    } else if (cameraReady) {
      console.log(`${TAG} ✅ Camera is ready.`);
    }
  }, [cameraReady, cameraError]);

  // Initialize game
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let game: GameInstance | null = null;
    let isMounted = true; // 1. Flag para saber si el componente sigue vivo

    async function loadGame() {
      if (!containerRef.current) return;
      console.log(`${TAG} Loading game: "${gameId}"...`);

      try {
        switch (gameId) {
          case 'flappy': {
            const { FlappyGame } = await import('@/src/games/flappy/FlappyGame');
            if (!isMounted) return; // 2. Abortar si se desmontó durante la descarga
            game = new FlappyGame(containerRef.current);
            break;
          }
          case 'dino': {
            const { DinoGame } = await import('@/src/games/dino/DinoGame');
            if (!isMounted) return;
            game = new DinoGame(containerRef.current as HTMLElement);
            break;
          }
          case 'ironboard': {
            const { IronGame } = await import('@/src/games/ironboard/IronGame');
            if (!isMounted) return;
            game = new IronGame(containerRef.current);
            break;
          }
        }
      } catch (err) {
        console.error(`${TAG} ❌ Failed to load "${gameId}":`, err);
        return;
      }

      if (game) {
        // Doble verificación por si el desmontaje ocurrió justo después del new Game()
        if (!isMounted) {
          game.destroy();
          return;
        }

        gameRef.current = game;
        game.onGameOver((finalScore) => {
          onGameOver(finalScore);
          if (scoreIntervalRef.current) {
            clearInterval(scoreIntervalRef.current);
          }
        });
        setGameStarted(true);

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
      isMounted = false; // 3. Marcar como desmontado para matar procesos huérfanos
      if (scoreIntervalRef.current) {
        clearInterval(scoreIntervalRef.current);
      }
      game?.destroy();
      gameRef.current = null;
    };
  }, [gameId, onGameOver, onScore]);

  // Camera-based input bridging (The Brain)
  useEffect(() => {
    if (inputMode !== 'camera' || !gameRef.current || !keypoints.length) return;

    const game = gameRef.current;
    const now = Date.now();

    if (gameId === 'flappy') {
      // 🏋️ VUELOS LATERALES: Ambas muñecas alineadas con hombros
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
        const tolerance = 40; 
        const leftAligned = Math.abs(leftWrist.y - avgShoulderY) < tolerance;
        const rightAligned = Math.abs(rightWrist.y - avgShoulderY) < tolerance;

        if (leftAligned && rightAligned) {
          if (!flappyArmsRaisedRef.current) {
            flappyArmsRaisedRef.current = true;
            game.triggerFlap?.();
          }
        } else {
          const hipY = (leftHip && rightHip && leftHip.score > 0.3 && rightHip.score > 0.3)
            ? (leftHip.y + rightHip.y) / 2
            : avgShoulderY + 120;
          const resetLine = (avgShoulderY + hipY) / 2;
          if (leftWrist.y > resetLine && rightWrist.y > resetLine) {
            flappyArmsRaisedRef.current = false;
          }
        }
      }
    }

    if (gameId === 'dino') {
      const nose = getPoint('nose');
      const leftShoulder = getPoint('left_shoulder');
      const rightShoulder = getPoint('right_shoulder');

      if (leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const trackY = (nose && nose.score > 0.3) ? nose.y : avgShoulderY;

        // Init baseline
        if (baselineShoulderYRef.current === null) {
          baselineShoulderYRef.current = avgShoulderY;
          prevTrackYRef.current = trackY;
          console.log(`${TAG} [dino] Baseline set: ${avgShoulderY}`);
        }

        const baseline = baselineShoulderYRef.current;
        const prevTrackY = prevTrackYRef.current ?? trackY;

        // JUMP: Body moved UP quickly
        const deltaUp = prevTrackY - trackY; // positive = moving up
        if (deltaUp > 12 && (now - jumpCooldownRef.current) > 380) {
          game.triggerJump?.();
          jumpCooldownRef.current = now;
        }

        // DUCK: Shoulders dropped below baseline
        const dropAmount = avgShoulderY - baseline;
        if (dropAmount > 22) {
          if (!duckActiveRef.current) {
            game.triggerDuck?.();
            duckActiveRef.current = true;
          }
        } else {
          // Rise from squat = Jump
          if (duckActiveRef.current) {
            game.triggerJump?.();
            jumpCooldownRef.current = now;
          }
          if (duckActiveRef.current) game.triggerStandUp?.(); // Ensure reset dino height
          duckActiveRef.current = false;
        }

        prevTrackYRef.current = trackY;
        // Drift baseline
        baselineShoulderYRef.current = baseline * 0.99 + avgShoulderY * 0.01;
      }
    }

    if (gameId === 'ironboard') {
      const leftShoulder = getPoint('left_shoulder');
      const rightShoulder = getPoint('right_shoulder');
      if (leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
        const diff = rightShoulder.y - leftShoulder.y;
        const tilt = Math.max(-1, Math.min(1, diff / 50));
        game.setTilt?.(tilt);
      }
    }
  }, [keypoints, inputMode, gameId, getPoint]);

  // Mouse / Keyboard / Touch input
  useEffect(() => {
    if ((inputMode !== 'mouse' && inputMode !== 'touch') || !gameRef.current) return;
    const game = gameRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      // solo procesar teclas si no está en modo touch
      if (inputMode !== 'mouse') return;
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
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (inputMode !== 'mouse') return;
      if (gameId === 'dino' && e.code === 'ArrowDown') {
        game.triggerStandUp?.();
      }
    };

    const handlePointerMove = (clientX: number) => {
      if (gameId === 'ironboard' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const tilt = (clientX - centerX) / (rect.width / 2);
        game.setTilt?.(Math.max(-1, Math.min(1, tilt)));
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (inputMode === 'mouse') handlePointerMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (inputMode === 'touch') {
        e.preventDefault(); // prevenir scroll si swipea en el juego
        handlePointerMove(e.touches[0].clientX);
      }
    };

    const handleClick = () => {
      if (gameId === 'flappy') game.triggerFlap?.();
      if (gameId === 'dino' && inputMode === 'touch') game.triggerJump?.();
    };

    // Agregar touch listeners al contenedor
    const container = containerRef.current;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    container?.addEventListener('click', handleClick);
    container?.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      container?.removeEventListener('click', handleClick);
      container?.removeEventListener('touchmove', handleTouchMove);
    };
  }, [inputMode, gameId]);

  // Skeleton drawing (Visual feedback)
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
        ctx.beginPath(); ctx.moveTo(kp1.x, kp1.y); ctx.lineTo(kp2.x, kp2.y); ctx.stroke();
      }
    });

    ctx.fillStyle = '#ff00ff';
    keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        ctx.beginPath(); ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }, [keypoints, inputMode, getPoint]);

  const togglePause = useCallback(() => {
    if (!gameRef.current) return;
    if (isPaused) gameRef.current.resume(); else gameRef.current.pause();
    setIsPaused(!isPaused);
  }, [isPaused]);

  return (
    <div className="relative w-full max-w-[1100px] mx-auto">
      {/* Camera preview */}
      <div
        className={`absolute top-2 right-2 z-20 w-48 h-36 rounded-xl overflow-hidden border-2 shadow-xl transition-all duration-300 ${
          inputMode === 'camera' ? 'opacity-100 border-purple-500/60' : 'opacity-0 pointer-events-none border-transparent'
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
        />
        {inputMode === 'camera' && !cameraReady && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90">
            <Camera className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Score and Pause */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-3">
        <div className="bg-[#12122a]/90 backdrop-blur-sm border border-[#2a2a4a] rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">SCORE</span>
          <span className="text-lg font-bold text-cyan-400 font-mono">{currentScore.toLocaleString()}</span>
        </div>
        <button onClick={togglePause} className="bg-[#12122a]/90 backdrop-blur-sm border border-[#2a2a4a] rounded-xl p-2.5 text-gray-400 hover:text-white cursor-pointer">
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      {/* Input Mode Selector */}
      <div className="absolute bottom-2 left-2 z-20">
        <div className="bg-[#12122a]/80 backdrop-blur-sm rounded-lg px-3 py-1 flex gap-1">
          {(['camera', 'touch', 'mouse'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              className={`text-xs px-2 py-1 rounded transition-all cursor-pointer ${
                inputMode === m ? 'bg-purple-600/50 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {m === 'camera' ? '📷' : m === 'touch' ? '👆' : '🖱️'}
            </button>
          ))}
        </div>
      </div>

      {/* Game Area */}
      <div
        ref={containerRef}
        className={`w-full aspect-video min-h-[400px] md:min-h-[500px] rounded-2xl overflow-hidden border-2 border-[#2a2a4a] shadow-2xl relative bg-[#0f0f23] ${
          !gameStarted ? 'flex items-center justify-center' : ''
        }`}
      >
        {!gameStarted && <div className="text-gray-500 text-sm animate-pulse">Cargando juego...</div>}
      </div>

      {/* Camera Error Fallback */}
      {inputMode === 'camera' && cameraError && (
        <div className="mt-3 w-full rounded-2xl border border-red-500/40 bg-red-950/60 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-bold text-red-300">Cámara no disponible</p>
            <p className="text-xs text-red-400/80">{cameraError}</p>
          </div>
          <button
            onClick={() => setInputMode('mouse')}
            className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm rounded-xl cursor-pointer"
          >
            Usar teclado →
          </button>
        </div>
      )}

      {/* Dino Level Selector */}
      {gameId === 'dino' && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Nivel de Intensidad:</span>
          
          <button
            onClick={() => handleThemeChange('desert')}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all cursor-pointer ${
              selectedTheme === 'desert' 
                ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                : 'bg-[#12122a] border-[#2a2a4a] text-gray-500 hover:border-amber-500/50'
            }`}
          >
            <span className="text-2xl">🏜️</span>
            <div className="text-left">
              <div className="text-[10px] uppercase font-black opacity-60">Principiante</div>
              <div className="font-bold">Desierto</div>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange('jungle')}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all cursor-pointer ${
              selectedTheme === 'jungle' 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                : 'bg-[#12122a] border-[#2a2a4a] text-gray-500 hover:border-emerald-500/50'
            }`}
          >
            <span className="text-2xl">🌿</span>
            <div className="text-left">
              <div className="text-[10px] uppercase font-black opacity-60">Cardio</div>
              <div className="font-bold">Jungla</div>
            </div>
          </button>

          <button
            onClick={() => handleThemeChange('night')}
            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all cursor-pointer ${
              selectedTheme === 'night' 
                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.3)]' 
                : 'bg-[#12122a] border-[#2a2a4a] text-gray-500 hover:border-indigo-500/50'
            }`}
          >
            <span className="text-2xl">🌙</span>
            <div className="text-left">
              <div className="text-[10px] uppercase font-black opacity-60">Extremo</div>
              <div className="font-bold">Ciudad</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
