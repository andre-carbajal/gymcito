'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabase';
import { GameCard } from '@/src/components/ui/GameCard';
import { GameCard3D } from '@/src/components/ui/GameCard3D';
import { HandCursor } from '@/src/components/ui/HandCursor';
import { AuthModal } from '@/src/components/ui/AuthModal';
import { FriendsPanel } from '@/src/components/ui/FriendsPanel';
import { FriendScoreComparison } from '@/src/components/ui/FriendScoreComparison';
import { getPendingRequests, subscribeFriendships } from '@/src/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Users } from 'lucide-react';

const GAMES = [
  { title: 'Flappy Bird', emoji: '🐦', slug: 'flappy', description: 'Sube los hombros para volar' },
  { title: 'Dino Runner', emoji: '🦕', slug: 'dino', description: 'Salta y agáchate para esquivar' },
  { title: 'Iron Board', emoji: '🏄', slug: 'ironboard', description: 'Inclínate para esquivar obstáculos' },
] as const;

const CONFIRM_DELAY = 2000;

// MediaPipe landmark shape (coords 0-1)
interface MPLandmark {
  x: number;
  y: number;
  z: number;
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [inputMode, setInputMode] = useState<'mouse' | 'camera'>('mouse');

  // 3D carousel state
  const [centerIndex, setCenterIndex] = useState(1);
  const [confirmProgress, setConfirmProgress] = useState(0);
  const confirmStartRef = useRef<number | null>(null);

  // Camera / hand tracking
  const videoRef = useRef<HTMLVideoElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const prevPalmXRef = useRef<number | null>(null);

  const mediapipeCamRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Friends system state
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [comparisonFriend, setComparisonFriend] = useState<{ id: string; name: string } | null>(null);
  const [pendingFriendsCount, setPendingFriendsCount] = useState(0);

  // ── Helpers ─────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    mediapipeCamRef.current?.stop();
    streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    mediapipeCamRef.current = null;
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const navigateToGame = useCallback(
    async (slug: string) => {
      stopCamera();
      await new Promise((resolve) => setTimeout(resolve, 150));
      router.push(`/game/${slug}`);
    },
    [router, stopCamera],
  );

  // ── Auth ────────────────────────────────────────────────────────
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        void supabase
          .from('profiles')
          .select('username')
          .eq('id', s.user.id)
          .single()
          .then(({ data }) => {
            if (data) setUsername((data as { username: string }).username);
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Friends system effects ──────────────────────────────────────
  useEffect(() => {
    if (!session?.user) return;

    // Initial fetch
    void getPendingRequests().then((reqs) => {
      setPendingFriendsCount(reqs.length);
    });

    // Real-time updates
    const channel = subscribeFriendships(() => {
      void getPendingRequests().then((reqs) => {
        setPendingFriendsCount(reqs.length);
      });
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [session]);

  // ── Draw hand skeleton (21 MediaPipe landmarks) ─────────────────
  const drawHandSkeleton = useCallback(
    (landmarks: MPLandmark[], ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const connections: [number, number][] = [
        [0, 1], [1, 2], [2, 3], [3, 4],        // pulgar
        [0, 5], [5, 6], [6, 7], [7, 8],         // índice
        [0, 9], [9, 10], [10, 11], [11, 12],     // medio
        [0, 13], [13, 14], [14, 15], [15, 16],   // anular
        [0, 17], [17, 18], [18, 19], [19, 20],   // meñique
        [5, 9], [9, 13], [13, 17],               // palma
      ];

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      connections.forEach(([a, b]) => {
        const lmA = landmarks[a];
        const lmB = landmarks[b];
        if (!lmA || !lmB) return;
        ctx.beginPath();
        // Mirror x because the video is mirrored (scale-x-[-1])
        ctx.moveTo((1 - lmA.x) * w, lmA.y * h);
        ctx.lineTo((1 - lmB.x) * w, lmB.y * h);
        ctx.stroke();
      });

      landmarks.forEach((lm) => {
        ctx.beginPath();
        ctx.arc((1 - lm.x) * w, lm.y * h, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00ff88';
        ctx.fill();
      });
    },
    [],
  );

  // ── Process palm gesture for carousel navigation ─────────────────
  const processHandGesture = useCallback(
    (palm: MPLandmark) => {
      const prevX = prevPalmXRef.current;
      const currentX = palm.x; // 0-1, mirrored: 0=right side of screen

      if (prevX !== null) {
        const delta = currentX - prevX;
        // In mirrored view: moving hand right → palm.x decreases
        if (delta > 0.04) {
          // Physical: hand moved left → go to previous card
          setCenterIndex((i) => Math.max(0, i - 1));
          confirmStartRef.current = null;
          setConfirmProgress(0);
        } else if (delta < -0.04) {
          // Physical: hand moved right → go to next card
          setCenterIndex((i) => Math.min(GAMES.length - 1, i + 1));
          confirmStartRef.current = null;
          setConfirmProgress(0);
        }
      }
      prevPalmXRef.current = currentX;

      // Selection: palm still in horizontal center of frame
      const isInCenter = Math.abs(palm.x - 0.5) < 0.2;
      if (isInCenter) {
        if (confirmStartRef.current === null) {
          confirmStartRef.current = Date.now();
        }
        const elapsed = Date.now() - confirmStartRef.current;
        const progress = Math.min(1, elapsed / CONFIRM_DELAY);
        setConfirmProgress(progress);
        if (progress >= 1) {
          void navigateToGame(GAMES[centerIndex].slug);
        }
      } else {
        confirmStartRef.current = null;
        setConfirmProgress(0);
      }
    },
    [centerIndex, navigateToGame],
  );

  // ── MediaPipe Hands effect ──────────────────────────────────────
  useEffect(() => {
    if (inputMode !== 'camera') {
      stopCamera();
      setCameraReady(false);
      setHandPos(null);
      prevPalmXRef.current = null;
      confirmStartRef.current = null;
      setConfirmProgress(0);
      return;
    }

    let cancelled = false;

    async function startMediaPipe() {
      try {
        // Dynamic imports — keeps bundle small, avoids SSR issues
        const { Hands } = await import('@mediapipe/hands');
        const { Camera } = await import('@mediapipe/camera_utils');

        if (cancelled) return;

        const hands = new Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,           // fastest — sufficient for menu navigation
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          if (cancelled) return;

          const canvas = skeletonCanvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          setCameraReady(true);

          if (!results.multiHandLandmarks?.length) {
            setHandPos(null);
            prevPalmXRef.current = null;
            confirmStartRef.current = null;
            setConfirmProgress(0);
            return;
          }

          const landmarks = results.multiHandLandmarks[0] as MPLandmark[];

          // Draw skeleton
          drawHandSkeleton(landmarks, ctx, canvas.width, canvas.height);

          // Wrist (landmark 0) → screen position for HandCursor
          const wrist = landmarks[0];
          const sx = (1 - wrist.x) * window.innerWidth;
          const sy = wrist.y * window.innerHeight;
          setHandPos({ x: sx, y: sy });

          // Palm center (landmark 9) → carousel control
          const palm = landmarks[9];
          if (palm) processHandGesture(palm);
        });

        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play();

        const cam = new Camera(video, {
          onFrame: async () => {
            if (!cancelled) {
              await hands.send({ image: video });
            }
          },
          width: 640,
          height: 480,
        });

        cam.start();
        mediapipeCamRef.current = cam;
        streamRef.current = stream;
      } catch (err) {
        console.error('MediaPipe Hands error:', err);
      }
    }

    void startMediaPipe();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      stopCamera();
    };
  }, [inputMode, drawHandSkeleton, processHandGesture, stopCamera]);

  // ── Helpers ─────────────────────────────────────────────────────
  function getCardPosition(idx: number): 'left' | 'center' | 'right' {
    if (idx === centerIndex) return 'center';
    if (idx < centerIndex) return 'left';
    return 'right';
  }

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <h1 className="text-3xl font-bold text-green-400 font-mono animate-pulse">
          🏋️ GYMCITO
        </h1>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#12122a] text-white overflow-y-auto font-sans pb-20">
        
        {/* Full Background Hero Section */}
        <div 
          className="relative w-full bg-cover bg-center bg-no-repeat bg-[url('/images/Personajes.png')] md:bg-[url('/images/Personasjes-16_9.png')]"
        >
          {/* Overlay to ensure text readability */}
          <div className="absolute inset-0 bg-[#12122a]/70 pointer-events-none z-0"></div>
          
          {/* Navbar */}
          <nav className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center relative z-50 border-b border-white/5">
            <div className="flex items-center gap-12">
              <h1 className="text-2xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 filter drop-shadow">🏋️ GYMCITO</h1>
              <div className="hidden md:flex gap-8 text-sm font-medium text-gray-300">
                <a href="#juegos" className="hover:text-white transition-colors drop-shadow-md">Juegos</a>
                <a href="#nosotros" className="hover:text-white transition-colors drop-shadow-md">Nosotros</a>
                <a href="#ayuda" className="hover:text-white transition-colors drop-shadow-md">Ayuda</a>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest">
              <button onClick={() => { setAuthMode('login'); setShowAuth(true); }} className="hover:text-cyan-400 transition-colors border border-white/20 px-5 py-2 rounded-full backdrop-blur-sm bg-black/20">
                LOG IN
              </button>
              <button 
                onClick={() => { setAuthMode('register'); setShowAuth(true); }} 
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-full hover:shadow-lg hover:shadow-cyan-500/30 transition-all border border-[#2a2a4a]"
              >
                SIGN UP
              </button>
            </div>
          </nav>

          {/* Hero Content Centered */}
          <main className="max-w-4xl mx-auto px-8 pt-32 pb-40 flex flex-col items-center justify-center text-center relative z-10">
            <div className="mb-4">
               <span className="px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold tracking-widest uppercase shadow-lg backdrop-blur-md">
                 Inteligencia Artificial
               </span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-extrabold mb-6 leading-[1.15] tracking-tight text-white drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              Entrena y juega <br /> con <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">tu cuerpo</span>
            </h1>
            
            <p className="text-gray-200 mb-10 text-lg leading-relaxed max-w-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Gymcito utiliza Inteligencia Artificial para rastrear tus movimientos a través de la cámara. Sin equipos, pura diversión. Mueve tu cuerpo para ganar y mantente activo.
            </p>
            
            <button
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
              className="px-10 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-full hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all hover:scale-105 active:scale-95 text-sm tracking-widest uppercase border border-cyan-400/30"
            >
              INICIAR SESIÓN
            </button>
          </main>
        </div>

        {/* 4 Colorful Cards Row */}
        <section id="juegos" className="max-w-7xl mx-auto px-8 pb-20 scroll-mt-32">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-16 relative">
            
            {/* Arrows (Visual purely) */}
            <div className="hidden lg:flex absolute left-[-40px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 items-center justify-center text-xs opacity-50 cursor-pointer hover:bg-white/20">&lt;</div>
            <div className="hidden lg:flex absolute right-[-40px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 items-center justify-center text-xs opacity-50 cursor-pointer hover:bg-white/20">&gt;</div>

            {/* Card 1: Yellow */}
            <div className="bg-[#FEA844] rounded-3xl p-6 text-center text-white relative mt-12 hover:-translate-y-2 transition-transform shadow-xl shadow-orange-500/20 flex flex-col items-center">
              <div className="absolute -top-10 w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-lg">
                🐦
              </div>
              <h3 className="text-xl font-bold mt-12 mb-3">Flappy Bird</h3>
              <p className="text-xs opacity-90 mb-6 leading-relaxed">Ejercita tus hombros. Sube ambos brazos como alas para aletear y sobrevivir.</p>
              <button onClick={() => setShowAuth(true)} className="mt-auto text-[10px] font-bold opacity-70 hover:opacity-100 transition-opacity uppercase tracking-widest border-b border-white/30 pb-1">VER MÁS &gt;</button>
            </div>

            {/* Card 2: Green */}
            <div className="bg-[#46D38B] rounded-3xl p-6 text-center text-white relative mt-12 hover:-translate-y-2 transition-transform shadow-xl shadow-green-500/20 flex flex-col items-center">
              <div className="absolute -top-10 w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-lg">
                🦕
              </div>
              <h3 className="text-xl font-bold mt-12 mb-3">Dino Runner</h3>
              <p className="text-xs opacity-90 mb-6 leading-relaxed">Entrena tren inferior. Salta físicamente o haz sentadillas para esquivar obstáculos.</p>
              <button onClick={() => setShowAuth(true)} className="mt-auto text-[10px] font-bold opacity-70 hover:opacity-100 transition-opacity uppercase tracking-widest border-b border-white/30 pb-1">VER MÁS &gt;</button>
            </div>

            {/* Card 3: Blue */}
            <div className="bg-[#3D94FF] rounded-3xl p-6 text-center text-white relative mt-12 hover:-translate-y-2 transition-transform shadow-xl shadow-blue-500/20 flex flex-col items-center">
              <div className="absolute -top-10 w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-lg">
                🏄
              </div>
              <h3 className="text-xl font-bold mt-12 mb-3">Iron Board</h3>
              <p className="text-xs opacity-90 mb-6 leading-relaxed">Estabilidad de core. Inclina tu cuerpo para desplazar la nave suavemente.</p>
              <button onClick={() => setShowAuth(true)} className="mt-auto text-[10px] font-bold opacity-70 hover:opacity-100 transition-opacity uppercase tracking-widest border-b border-white/30 pb-1">VER MÁS &gt;</button>
            </div>

            {/* Card 4: Red */}
            <div className="bg-[#FF4A55] rounded-3xl p-6 text-center text-white relative mt-12 hover:-translate-y-2 transition-transform shadow-xl shadow-red-500/20 flex flex-col items-center">
              <div className="absolute -top-10 w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl shadow-lg">
                🥊
              </div>
              <h3 className="text-xl font-bold mt-12 mb-3">Más Modos</h3>
              <p className="text-xs opacity-90 mb-6 leading-relaxed">Nuevos minijuegos guiados por inteligencia artificial próximamente.</p>
              <button onClick={() => setShowAuth(true)} className="mt-auto text-[10px] font-bold opacity-70 hover:opacity-100 transition-opacity uppercase tracking-widest border-b border-white/30 pb-1">VER MÁS &gt;</button>
            </div>

          </div>

          <div className="flex justify-center mt-12">
            <button className="px-8 py-3 bg-[#1a1a2e] border border-[#2a2a4a] text-white font-bold rounded-full hover:bg-white/10 hover:scale-105 transition-all duration-300 text-[10px] tracking-widest uppercase shadow-lg">
              VER MÁS MODOS
            </button>
          </div>
        </section>

        {/* Instructions Section (Adapted from App.tsx) */}
        <section id="ayuda" className="max-w-5xl mx-auto px-8 pb-24 scroll-mt-32">
          <div className="bg-gradient-to-b from-[#1a1a2e] to-[#12122a] rounded-3xl border border-[#2a2a4a] p-10 md:p-14 shadow-2xl relative overflow-hidden text-center group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-cyan-600/20 transition-colors duration-700"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-purple-600/20 transition-colors duration-700"></div>
            
            <h2 className="text-4xl font-extrabold mb-4 tracking-tight drop-shadow-md relative z-10">
              Controla el juego con movimientos
            </h2>
            <p className="text-gray-400 mb-12 text-lg relative z-10">
              ¡Salta y agáchate en la vida real para esquivar obstáculos! No necesitas controles mágicos, solo tu cámara web.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-8 relative z-10">
              <div className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 shadow-xl">
                <div className="w-16 h-16 mx-auto bg-cyan-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                  ⬆️
                </div>
                <h3 className="text-xl font-bold mb-3 text-cyan-400">Cómo Saltar</h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Da un salto físicamente hacia arriba o levanta tus hombros rápidamente frente a la cámara.
                </p>
              </div>
              <div className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-purple-500/30 hover:-translate-y-2 transition-all duration-300 shadow-xl">
                <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                  ⬇️
                </div>
                <h3 className="text-xl font-bold mb-3 text-purple-400">Cómo Agacharte</h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Dobla tus rodillas en una sentadilla o reduce la altura total de tu cuerpo significativamente.
                </p>
              </div>
            </div>
          </div>
          
          <div className="w-full h-px bg-white/5 mt-24"></div>
        </section>

        {/* Why Playwell Section (Blobs) */}
        <section id="nosotros" className="max-w-7xl mx-auto px-8 pb-32 text-center scroll-mt-32">
          <h2 className="text-5xl md:text-6xl font-black mb-24 tracking-tight drop-shadow-md">¿Por qué jugar en Gymcito?</h2>
          
          <div className="grid md:grid-cols-3 gap-16 md:gap-20">
            {/* Pink Blob */}
            <div className="flex flex-col items-center text-center group">
              <div className="relative w-48 h-48 md:w-56 md:h-56 mb-10 flex items-center justify-center transform group-hover:scale-110 group-hover:-translate-y-4 group-hover:rotate-6 transition-all duration-500 ease-out">
                <div className="absolute inset-0 bg-[#FF65A0] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] shadow-[0_20px_50px_rgba(255,101,160,0.4)]"></div>
                <span className="relative text-7xl md:text-8xl z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">❤️</span>
              </div>
              <h4 className="text-2xl font-bold mb-4 drop-shadow-sm">Mejora tu salud</h4>
              <p className="text-sm md:text-base text-gray-400 leading-relaxed px-4 opacity-90">
                Quema calorías y mejora tus reflejos. Cada partida es esfuerzo físico.
              </p>
            </div>

            {/* Orange Blob */}
            <div className="flex flex-col items-center text-center group cursor-default">
              <div className="relative w-48 h-48 md:w-56 md:h-56 mb-10 flex items-center justify-center transform group-hover:scale-110 group-hover:-translate-y-4 group-hover:-rotate-6 transition-all duration-500 ease-out">
                <div className="absolute inset-0 bg-[#FF6B4B] rounded-[50%_40%_30%_70%/60%_50%_40%_50%] shadow-[0_20px_50px_rgba(255,107,75,0.4)]"></div>
                <span className="relative text-7xl md:text-8xl z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">🧠</span>
              </div>
              <h4 className="text-2xl font-bold mb-4 drop-shadow-sm">Enfoque Científico</h4>
              <p className="text-sm md:text-base text-gray-400 leading-relaxed px-4 opacity-90">
                El IA Coach post-partida analiza tu postura y desempeño automáticamente.
              </p>
            </div>

            {/* Cyan Blob */}
            <div className="flex flex-col items-center text-center group cursor-default">
              <div className="relative w-48 h-48 md:w-56 md:h-56 mb-10 flex items-center justify-center transform group-hover:scale-110 group-hover:-translate-y-4 group-hover:rotate-12 transition-all duration-500 ease-out">
                <div className="absolute inset-0 bg-[#2BD4C1] rounded-[40%_60%_50%_50%/50%_40%_60%_40%] shadow-[0_20px_50px_rgba(43,212,193,0.4)] rounded-full animate-[pulse_4s_infinite]"></div>
                <span className="relative text-7xl md:text-8xl z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">👥</span>
              </div>
              <h4 className="text-2xl font-bold mb-4 drop-shadow-sm">Modo Multijugador</h4>
              <p className="text-sm md:text-base text-gray-400 leading-relaxed px-4 opacity-90">
                Agrega amigos, supera sus puntajes y mantengan un historial sano.
              </p>
            </div>
          </div>

          <div className="flex justify-center mt-32" id="ayudaCTA">
            <button
              onClick={() => { setAuthMode('register'); setShowAuth(true); }}
              className="px-10 py-5 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-extrabold rounded-full hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all hover:scale-105 active:scale-95 text-base tracking-widest uppercase border border-cyan-400/30"
            >
              JUGAR AHORA
            </button>
          </div>
        </section>

        {/* Footer Section */}
        <footer className="w-full py-12 px-8 border-t border-white/5 bg-[#0a0a1a] text-center text-gray-500 relative z-20">
          <p className="text-sm font-medium tracking-wide">🏋️ Gymcito © 2026. Haz ejercicio divirtiéndote.</p>
        </footer>

        {showAuth && (
          <AuthModal
            initialMode={authMode}
            onClose={() => setShowAuth(false)}
            onAuth={() => {
              setShowAuth(false);
              void supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Hand cursor overlay */}
      {inputMode === 'camera' && handPos && (
        <HandCursor x={handPos.x} y={handPos.y} confirmProgress={confirmProgress} />
      )}

      {/* ── Header ── */}
      <header className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
        <h1 className="text-2xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 filter drop-shadow">🏋️ GYMCITO</h1>

        <div className="flex items-center gap-4">
          {username && (
            <span className="text-gray-400 text-sm">
              Hola, <span className="text-white font-bold">{username}</span>
            </span>
          )}

          {/* Friends button */}
          <button
            id="friends-toggle-btn"
            onClick={() => setShowFriendsPanel(true)}
            className="relative p-2 bg-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-all cursor-pointer"
            title="Amigos"
          >
            <Users className="w-5 h-5" />
            {pendingFriendsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-gray-950 badge-pulse">
                {pendingFriendsCount}
              </span>
            )}
          </button>

          {/* Mode toggle */}
          <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
            <button
              id="mode-mouse-btn"
              onClick={() => setInputMode('mouse')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${inputMode === 'mouse'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              🖱️ Mouse
            </button>
            <button
              id="mode-camera-btn"
              onClick={() => setInputMode('camera')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${inputMode === 'camera'
                  ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              📷 Cámara
            </button>
          </div>

          <button
            id="logout-btn"
            onClick={() => void supabase.auth.signOut()}
            className="text-sm text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ── MOUSE MODE: 2D grid ── */}
      {inputMode === 'mouse' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold font-mono mb-2">Elige tu juego</h2>
            <p className="text-gray-500">Haz click para empezar a jugar</p>
          </div>
          <div className="flex gap-8 flex-wrap justify-center px-8">
            {GAMES.map((game) => (
              <GameCard
                key={game.slug}
                title={game.title}
                description={game.description}
                emoji={game.emoji}
                slug={game.slug}
                onClick={() => void navigateToGame(game.slug)}
              />
            ))}
          </div>
        </main>
      )}

      {/* ── CAMERA MODE: 3D carousel with MediaPipe Hands ── */}
      {inputMode === 'camera' && (
        <main className="flex-1 flex gap-6 p-6">
          {/* Left panel: live camera feed */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${cameraReady ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                  }`}
              />
              <span className="text-sm text-gray-400">
                {cameraReady ? 'Mano detectada ✋' : 'Iniciando cámara...'}
              </span>
            </div>

            {/* Video + skeleton overlay */}
            <div
              className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-900"
              style={{ aspectRatio: '4/3' }}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={skeletonCanvasRef}
                className="absolute inset-0 w-full h-full"
                width={640}
                height={480}
              />
            </div>

            {/* Instructions */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-sm text-gray-400 space-y-2">
              <p>✋ Mueve la mano izquierda → ir izquierda</p>
              <p>✋ Mueve la mano derecha → ir derecha</p>
              <p>🖐️ Quédate quieto en el centro 2 seg para seleccionar</p>
            </div>
          </div>

          {/* Right panel: 3D carousel */}
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold font-mono text-green-400">
                {GAMES[centerIndex].emoji} {GAMES[centerIndex].title}
              </h2>
              <p className="text-gray-400 mt-1">{GAMES[centerIndex].description}</p>
            </div>

            {/* 3D carousel */}
            <div
              className="relative flex items-center justify-center"
              style={{ perspective: '1000px', width: '100%', height: 260 }}
            >
              {GAMES.map((game, idx) => (
                <GameCard3D
                  key={game.slug}
                  title={game.title}
                  description={game.description}
                  emoji={game.emoji}
                  slug={game.slug}
                  position={getCardPosition(idx)}
                  confirmProgress={idx === centerIndex ? confirmProgress : 0}
                  onClick={() => void navigateToGame(game.slug)}
                />
              ))}
            </div>

            {/* Dot indicators */}
            <div className="flex gap-3">
              {GAMES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCenterIndex(idx);
                    confirmStartRef.current = null;
                    setConfirmProgress(0);
                  }}
                  className={`w-3 h-3 rounded-full transition-all cursor-pointer ${idx === centerIndex ? 'bg-green-400 scale-125' : 'bg-gray-600 hover:bg-gray-400'
                    }`}
                />
              ))}
            </div>
          </div>
        </main>
      )}

      {/* ── Friends Overlays ── */}
      {showFriendsPanel && (
        <FriendsPanel
          onClose={() => setShowFriendsPanel(false)}
          pendingCount={pendingFriendsCount}
          onPendingCountChange={setPendingFriendsCount}
          onCompare={(id, name) => {
            setComparisonFriend({ id, name });
            setShowFriendsPanel(false);
          }}
        />
      )}

      {comparisonFriend && (
        <FriendScoreComparison
          friendId={comparisonFriend.id}
          friendName={comparisonFriend.name}
          onClose={() => setComparisonFriend(null)}
        />
      )}
    </div>
  );
}
