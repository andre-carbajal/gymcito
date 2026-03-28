'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, getPendingRequests, subscribeFriendships } from '@/src/lib/supabase';
import { AuthModal } from '@/src/components/ui/AuthModal';
import { InputModeSelector } from '@/src/components/ui/InputModeSelector';
import { Leaderboard } from '@/src/components/ui/Leaderboard';
import { FriendsPanel } from '@/src/components/ui/FriendsPanel';
import { FriendScoreComparison } from '@/src/components/ui/FriendScoreComparison';
import { useInputMode } from '@/src/hooks/useInputMode';
import { GAME_LIST } from '@/src/lib/types';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { LogOut, Gamepad2, Trophy, Users } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [compareTarget, setCompareTarget] = useState<{
    friendId: string;
    friendName: string;
  } | null>(null);
  const { inputMode, setInputMode } = useInputMode();

  // Check initial session
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch username
  useEffect(() => {
    if (!user) {
      setUsername('');
      return;
    }

    void supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setUsername(data?.username ?? user.email?.split('@')[0] ?? 'Jugador');
      });
  }, [user]);

  // Fetch pending friend request count
  const refreshPendingCount = useCallback(async () => {
    if (!user) return;
    const pending = await getPendingRequests();
    setPendingCount(pending.length);
  }, [user]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  // Realtime subscription for friendship changes (pending count badge)
  useEffect(() => {
    if (!user) return;

    const channel = subscribeFriendships(() => {
      void refreshPendingCount();
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [user, refreshPendingCount]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function handleCompare(friendId: string, friendName: string) {
    setCompareTarget({ friendId, friendName });
    setShowFriends(false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-grid">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 font-heading animate-pulse">
            GYMCITO
          </h1>
        </div>
      </div>
    );
  }

  // NOT authenticated
  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-grid p-4">
        <div className="text-center max-w-md animate-slide-up">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 font-heading mb-3">
              GYMCITO
            </h1>
            <p className="text-gray-400 text-sm">
              Minijuegos controlados por tu cuerpo 🎮
            </p>
          </div>

          {/* Game preview icons */}
          <div className="flex justify-center gap-6 mb-8">
            {GAME_LIST.map((game, i) => (
              <div
                key={game.id}
                className="text-4xl animate-float"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                {game.icon}
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            id="start-playing-btn"
            onClick={() => setShowAuth(true)}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-lg rounded-2xl hover:from-purple-500 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 cursor-pointer"
          >
            <Gamepad2 className="w-5 h-5 inline-block mr-2 -mt-0.5" />
            Empezar a jugar
          </button>

          <p className="text-gray-600 text-xs mt-4">
            Usa tu cámara, touch o mouse para controlar los juegos
          </p>
        </div>

        {showAuth && (
          <AuthModal
            onClose={() => setShowAuth(false)}
            onAuth={() => {
              setShowAuth(false);
              void supabase.auth.getUser().then(({ data: { user: u } }) => {
                setUser(u ?? null);
              });
            }}
          />
        )}
      </div>
    );
  }

  // AUTHENTICATED: Game menu
  return (
    <div className="flex-1 flex flex-col bg-grid">
      {/* Header */}
      <header className="border-b border-[#2a2a4a] bg-[#0a0a12]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 font-heading">
            GYMCITO
          </h1>

          <div className="flex items-center gap-4">
            <button
              id="friends-toggle-btn"
              onClick={() => setShowFriends(!showFriends)}
              className="relative flex items-center gap-1.5 text-sm text-gray-400 hover:text-purple-400 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Amigos</span>
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] text-[9px] bg-red-500 text-white rounded-full flex items-center justify-center font-bold badge-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              id="leaderboard-toggle-btn"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-yellow-400 transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span className="hidden sm:inline">Ranking</span>
            </button>

            <span className="text-sm text-gray-300">
              👋 <span className="font-semibold text-white">{username}</span>
            </span>

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        {/* Input mode selector */}
        <div className="flex justify-center mb-8">
          <InputModeSelector inputMode={inputMode} setInputMode={setInputMode} />
        </div>

        {/* Game cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {GAME_LIST.map((game, index) => (
            <Link
              key={game.id}
              href={`/game/${game.id}?input=${inputMode}`}
              className="game-card animate-slide-up block"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="bg-[#12122a] border border-[#2a2a4a] rounded-2xl p-6 h-full flex flex-col">
                {/* Icon */}
                <div className="text-5xl mb-4 animate-float" style={{ animationDelay: `${index * 0.2}s` }}>
                  {game.icon}
                </div>

                {/* Title */}
                <h2
                  className="text-lg font-bold mb-2 font-heading"
                  style={{ color: game.color }}
                >
                  {game.title}
                </h2>

                {/* Description */}
                <p className="text-gray-400 text-sm flex-1 mb-4">
                  {game.description}
                </p>

                {/* Play button */}
                <div
                  className="w-full py-3 rounded-xl font-bold text-center text-white text-sm transition-all duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${game.color}cc, ${game.color}66)`,
                  }}
                >
                  ▶ JUGAR
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Leaderboard section */}
        {showLeaderboard && (
          <div className="animate-slide-up">
            <Leaderboard game="flappy" />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a2e] py-4 text-center text-xs text-gray-600">
        Gymcito © {new Date().getFullYear()} — Controlado por tu cuerpo 💪
      </footer>

      {/* Friends Panel (slide-in from right) */}
      {showFriends && (
        <FriendsPanel
          onClose={() => setShowFriends(false)}
          onCompare={handleCompare}
          pendingCount={pendingCount}
          onPendingCountChange={setPendingCount}
        />
      )}

      {/* Score Comparison Modal */}
      {compareTarget && (
        <FriendScoreComparison
          friendId={compareTarget.friendId}
          friendName={compareTarget.friendName}
          onClose={() => setCompareTarget(null)}
        />
      )}
    </div>
  );
}
