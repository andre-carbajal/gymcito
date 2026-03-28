// ── Game identifiers ──────────────────────────────────────────────
export type Game = 'flappy' | 'dino' | 'ironboard';

// ── Input modes ───────────────────────────────────────────────────
export type InputMode = 'camera' | 'touch' | 'mouse';

// ── Database row types ────────────────────────────────────────────
export interface Score {
  id: string;
  user_id: string;
  game: Game;
  score: number;
  input_mode: InputMode;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
}

// ── MoveNet keypoint ──────────────────────────────────────────────
export interface Keypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}

// ── Leaderboard entry (score joined with profile) ─────────────────
export interface LeaderboardEntry {
  id: string;
  user_id: string;
  game: Game;
  score: number;
  input_mode: InputMode;
  created_at: string;
  profiles: {
    username: string;
  } | null;
}

// ── Friendship types ──────────────────────────────────────────────
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  // Joined profile of the OTHER user (not the current user)
  friend_profile: {
    id: string;
    username: string;
  } | null;
}

export interface FriendScoreComparison {
  game: Game;
  my_best_score: number;
  friend_best_score: number;
}

export interface UserSearchResult {
  id: string;
  username: string;
}

// ── Game class interface (shared contract for all 3 games) ────────
export interface GameInstance {
  triggerFlap?: () => void;
  triggerJump?: () => void;
  triggerDuck?: () => void;
  setTilt?: (angle: number) => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  onGameOver: (callback: (score: number) => void) => void;
  getScore: () => number;
}

// ── Game metadata for the menu ────────────────────────────────────
export interface GameMeta {
  id: Game;
  title: string;
  description: string;
  color: string;
  icon: string;
}

export const GAME_LIST: GameMeta[] = [
  {
    id: 'flappy',
    title: 'Flappy Bird',
    description: 'Salta entre los tubos agitando los brazos o haciendo click. ¡No toques nada!',
    color: '#06b6d4',
    icon: '🐦',
  },
  {
    id: 'dino',
    title: 'Dino Runner',
    description: 'Salta y agáchate para esquivar obstáculos. ¡Corre lo más lejos posible!',
    color: '#a855f7',
    icon: '🦖',
  },
  {
    id: 'ironboard',
    title: 'Iron Board',
    description: 'Inclínate para esquivar obstáculos en la tabla. ¡Mantén la postura perfecta!',
    color: '#22c55e',
    icon: '🏄',
  },
];
