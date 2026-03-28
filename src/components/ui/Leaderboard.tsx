'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard, subscribeLeaderboard } from '@/src/lib/supabase';
import type { Game, LeaderboardEntry } from '@/src/lib/types';
import { Trophy, Medal, Award } from 'lucide-react';

const GAME_LABELS: Record<Game, string> = {
  flappy: '🐦 Flappy',
  dino: '🦖 Dino',
  ironboard: '🏄 Iron Board',
};

interface LeaderboardProps {
  game: Game;
}

export function Leaderboard({ game: initialGame }: LeaderboardProps) {
  const [activeGame, setActiveGame] = useState<Game>(initialGame);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard on game change
  useEffect(() => {
    setLoading(true);
    void getLeaderboard(activeGame).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [activeGame]);

  // Realtime subscription
  useEffect(() => {
    const channel = subscribeLeaderboard(activeGame, (data) => {
      setEntries(data);
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [activeGame]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 1:
        return <Medal className="w-4 h-4 text-gray-300" />;
      case 2:
        return <Award className="w-4 h-4 text-amber-600" />;
      default:
        return <span className="w-4 h-4 text-center text-xs text-gray-500">{index + 1}</span>;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[#1a1a2e] rounded-lg p-1">
        {(Object.keys(GAME_LABELS) as Game[]).map((g) => (
          <button
            key={g}
            id={`leaderboard-tab-${g}`}
            onClick={() => setActiveGame(g)}
            className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer ${
              activeGame === g
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-white hover:bg-[#252547]'
            }`}
          >
            {GAME_LABELS[g]}
          </button>
        ))}
      </div>

      {/* Title */}
      <h3 className="text-center text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-3 font-heading">
        🏆 TOP 10
      </h3>

      {/* Table */}
      <div className="bg-[#12122a] rounded-xl border border-[#2a2a4a] overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            Sin puntuaciones aún. ¡Sé el primero!
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a4a] text-xs text-gray-400">
                <th className="py-2 px-3 text-left w-10">#</th>
                <th className="py-2 px-3 text-left">Jugador</th>
                <th className="py-2 px-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={`border-b border-[#1e1e3a] transition-colors hover:bg-[#1a1a35] ${
                    index === 0 ? 'bg-yellow-500/5' : ''
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center">
                      {getRankIcon(index)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-sm text-gray-200 font-medium">
                    {entry.profiles?.username ?? 'Anónimo'}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right font-bold text-cyan-400 font-mono">
                    {entry.score.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
