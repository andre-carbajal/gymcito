import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Game, InputMode, LeaderboardEntry } from './types';

// ── Supabase client ───────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Save a score ──────────────────────────────────────────────────
export async function saveScore(
  game: Game,
  score: number,
  inputMode: InputMode,
): Promise<{ success: boolean; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  const { error } = await supabase.from('scores').insert({
    user_id: user.id,
    game,
    score,
    input_mode: inputMode,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ── Get leaderboard (top 10) ─────────────────────────────────────
export async function getLeaderboard(
  game: Game,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('id, user_id, game, score, input_mode, created_at, profiles(username)')
    .eq('game', game)
    .order('score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching leaderboard:', error.message);
    return [];
  }

  if (!data) return [];

  return data.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    game: row.game as Game,
    score: row.score as number,
    input_mode: row.input_mode as InputMode,
    created_at: row.created_at as string,
    profiles: Array.isArray(row.profiles)
      ? (row.profiles[0] as { username: string } | undefined) ?? null
      : (row.profiles as unknown as { username: string } | null),
  }));
}

// ── Realtime subscription to leaderboard changes ──────────────────
export function subscribeLeaderboard(
  game: Game,
  callback: (entries: LeaderboardEntry[]) => void,
): RealtimeChannel {
  const channel = supabase
    .channel(`leaderboard-${game}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'scores',
        filter: `game=eq.${game}`,
      },
      () => {
        // Re-fetch the full leaderboard on any insert for this game
        void getLeaderboard(game).then(callback);
      },
    )
    .subscribe();

  return channel;
}
