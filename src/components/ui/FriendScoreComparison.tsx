'use client';

import { useEffect, useState } from 'react';
import { getFriendScoreComparison } from '@/src/lib/supabase';
import type { FriendScoreComparison as FriendScoreComparisonType, Game } from '@/src/lib/types';
import { X, Loader2, Trophy, Crown, Minus } from 'lucide-react';

const GAME_META: Record<Game, { icon: string; label: string; color: string }> = {
  flappy: { icon: '🐦', label: 'Flappy Bird', color: '#06b6d4' },
  dino: { icon: '🦖', label: 'Dino Runner', color: '#a855f7' },
  ironboard: { icon: '🏄', label: 'Iron Board', color: '#22c55e' },
};

interface FriendScoreComparisonProps {
  friendId: string;
  friendName: string;
  onClose: () => void;
}

export function FriendScoreComparison({
  friendId,
  friendName,
  onClose,
}: FriendScoreComparisonProps) {
  const [scores, setScores] = useState<FriendScoreComparisonType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getFriendScoreComparison(friendId).then((data) => {
      setScores(data);
      setLoading(false);
    });
  }, [friendId]);

  // Count wins
  const myWins = scores.filter((s) => s.my_best_score > s.friend_best_score).length;
  const friendWins = scores.filter((s) => s.friend_best_score > s.my_best_score).length;
  const ties = scores.filter(
    (s) => s.my_best_score === s.friend_best_score && s.my_best_score > 0,
  ).length;

  const overallWinner =
    myWins > friendWins ? 'me' : friendWins > myWins ? 'friend' : 'tie';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#0e0e1f] border border-[#2a2a4a] rounded-2xl shadow-2xl shadow-purple-500/10 z-10 animate-slide-up overflow-hidden">
        {/* Header with gradient */}
        <div className="relative px-6 pt-6 pb-4 border-b border-[#2a2a4a]">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-cyan-600/10" />
          <button
            id="score-comparison-close-btn"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 font-heading mb-1">
              ⚔️ COMPARACIÓN
            </h2>
            <p className="text-gray-400 text-sm">
              Tú vs <span className="text-white font-semibold">{friendName}</span>
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Score cards */}
              <div className="space-y-3 mb-6">
                {scores.map((entry) => {
                  const meta = GAME_META[entry.game as Game];
                  const iWin = entry.my_best_score > entry.friend_best_score;
                  const friendWin = entry.friend_best_score > entry.my_best_score;
                  const isTie =
                    entry.my_best_score === entry.friend_best_score;
                  const bothZero =
                    entry.my_best_score === 0 && entry.friend_best_score === 0;

                  return (
                    <div
                      key={entry.game}
                      className="bg-[#12122a] border border-[#2a2a4a] rounded-xl p-4 hover:border-purple-500/20 transition-all"
                    >
                      {/* Game title */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{meta.icon}</span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {/* Score comparison bar */}
                      <div className="flex items-center gap-3">
                        {/* My score */}
                        <div
                          className={`flex-1 text-center py-2.5 rounded-lg border transition-all ${
                            iWin && !bothZero
                              ? 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/5'
                              : 'bg-[#1a1a2e] border-[#2a2a4a]'
                          }`}
                        >
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            Tú
                          </p>
                          <p
                            className={`text-lg font-bold font-mono ${
                              iWin && !bothZero ? 'text-green-400' : 'text-gray-300'
                            }`}
                          >
                            {entry.my_best_score.toLocaleString()}
                          </p>
                          {iWin && !bothZero && (
                            <Crown className="w-3.5 h-3.5 text-green-400 mx-auto mt-1" />
                          )}
                        </div>

                        {/* VS */}
                        <div className="text-xs text-gray-600 font-bold">VS</div>

                        {/* Friend score */}
                        <div
                          className={`flex-1 text-center py-2.5 rounded-lg border transition-all ${
                            friendWin && !bothZero
                              ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/5'
                              : 'bg-[#1a1a2e] border-[#2a2a4a]'
                          }`}
                        >
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                            {friendName}
                          </p>
                          <p
                            className={`text-lg font-bold font-mono ${
                              friendWin && !bothZero ? 'text-red-400' : 'text-gray-300'
                            }`}
                          >
                            {entry.friend_best_score.toLocaleString()}
                          </p>
                          {friendWin && !bothZero && (
                            <Crown className="w-3.5 h-3.5 text-red-400 mx-auto mt-1" />
                          )}
                        </div>
                      </div>

                      {/* Tie indicator */}
                      {isTie && !bothZero && (
                        <div className="text-center mt-2">
                          <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                            ⚡ Empate
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overall result */}
              <div
                className={`rounded-xl p-4 text-center border ${
                  overallWinner === 'me'
                    ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20'
                    : overallWinner === 'friend'
                    ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/20'
                    : 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20'
                }`}
              >
                <div className="text-2xl mb-1">
                  {overallWinner === 'me'
                    ? '🏆'
                    : overallWinner === 'friend'
                    ? '😤'
                    : '🤝'}
                </div>
                <p className="text-sm font-bold text-white">
                  {overallWinner === 'me'
                    ? '¡Vas ganando!'
                    : overallWinner === 'friend'
                    ? `${friendName} te supera`
                    : '¡Están empatados!'}
                </p>
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  <span className="text-green-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    Tú: {myWins}
                  </span>
                  <span className="text-gray-500 flex items-center gap-1">
                    <Minus className="w-3 h-3" />
                    Empates: {ties}
                  </span>
                  <span className="text-red-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" />
                    {friendName}: {friendWins}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
