import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Game, InputMode, LeaderboardEntry, Friendship, FriendScoreComparison, UserSearchResult } from './types';

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

// ══════════════════════════════════════════════════════════════════
// ── FRIENDS SYSTEM ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

// ── Search users by username ─────────────────────────────────────
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query.trim()) return [];

  const { data, error } = await supabase.rpc('search_users', {
    search_text: query.trim(),
  });

  if (error) {
    console.error('Error searching users:', error.message);
    return [];
  }

  return (data ?? []) as UserSearchResult[];
}

// ── Send a friend request ────────────────────────────────────────
export async function sendFriendRequest(
  friendId: string,
): Promise<{ success: boolean; error: string | null; autoAccepted?: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ user_id: user.id, friend_id: friendId })
    .select('status')
    .single();

  if (error) {
    // Check for duplicate
    if (error.code === '23505') {
      return { success: false, error: 'Ya enviaste una solicitud a este usuario' };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    error: null,
    autoAccepted: data?.status === 'accepted',
  };
}

// ── Respond to a friend request ──────────────────────────────────
export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', friendshipId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ── Remove a friend (delete friendship) ──────────────────────────
export async function removeFriend(
  friendshipId: string,
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ── Helper to map friendship rows to Friendship type ─────────────
function mapFriendships(
  rows: Record<string, unknown>[],
  currentUserId: string,
): Friendship[] {
  return rows.map((row) => {
    const isRequester = row.user_id === currentUserId;
    // The "other" profile is the one that isn't the current user
    const senderProfile = row.sender_profile as { id: string; username: string } | null;
    const receiverProfile = row.receiver_profile as { id: string; username: string } | null;
    const friendProfile = isRequester ? receiverProfile : senderProfile;

    return {
      id: row.id as string,
      user_id: row.user_id as string,
      friend_id: row.friend_id as string,
      status: row.status as Friendship['status'],
      created_at: row.created_at as string,
      friend_profile: friendProfile,
    };
  });
}

// ── Get accepted friends ─────────────────────────────────────────
export async function getFriends(): Promise<Friendship[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, user_id, friend_id, status, created_at, ' +
      'sender_profile:profiles!friendships_user_id_fkey(id, username), ' +
      'receiver_profile:profiles!friendships_friend_id_fkey(id, username)'
    )
    .eq('status', 'accepted')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  if (error) {
    console.error('Error fetching friends:', error.message);
    return [];
  }

  return mapFriendships((data ?? []) as unknown as Record<string, unknown>[], user.id);
}

// ── Get received pending requests ────────────────────────────────
export async function getPendingRequests(): Promise<Friendship[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, user_id, friend_id, status, created_at, ' +
      'sender_profile:profiles!friendships_user_id_fkey(id, username), ' +
      'receiver_profile:profiles!friendships_friend_id_fkey(id, username)'
    )
    .eq('status', 'pending')
    .eq('friend_id', user.id);

  if (error) {
    console.error('Error fetching pending requests:', error.message);
    return [];
  }

  return mapFriendships((data ?? []) as unknown as Record<string, unknown>[], user.id);
}

// ── Get sent pending requests ────────────────────────────────────
export async function getSentRequests(): Promise<Friendship[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(
      'id, user_id, friend_id, status, created_at, ' +
      'sender_profile:profiles!friendships_user_id_fkey(id, username), ' +
      'receiver_profile:profiles!friendships_friend_id_fkey(id, username)'
    )
    .eq('status', 'pending')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching sent requests:', error.message);
    return [];
  }

  return mapFriendships((data ?? []) as unknown as Record<string, unknown>[], user.id);
}

// ── Get score comparison with a friend ───────────────────────────
export async function getFriendScoreComparison(
  friendId: string,
): Promise<FriendScoreComparison[]> {
  const { data, error } = await supabase.rpc('get_friend_scores', {
    friend_uuid: friendId,
  });

  if (error) {
    console.error('Error fetching friend scores:', error.message);
    return [];
  }

  return (data ?? []) as FriendScoreComparison[];
}

// ── Realtime subscription to friendship changes ──────────────────
export function subscribeFriendships(
  callback: () => void,
): RealtimeChannel {
  const channel = supabase
    .channel('friendships-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
      },
      () => {
        callback();
      },
    )
    .subscribe();

  return channel;
}

