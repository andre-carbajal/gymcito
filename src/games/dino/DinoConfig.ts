// ── DinoConfig.ts ──────────────────────────────────────────────────────────
// All tunable constants for the Dino Runner game.
// Edit values here; the game code reads them automatically.

// ── Theme system ──────────────────────────────────────────────────────────────
export type GameTheme = 'desert' | 'jungle' | 'night';

export interface ThemeData {
  /** Human-readable label shown in the level selector. */
  label:       string;
  emoji:       string;
  /** Sky colour (top portion of canvas). */
  skyTop:      number;
  /** Horizon / lower sky colour. */
  skyBot:      number;
  /** Ground fill colour. */
  groundColor: number;
  /** Thin line on top of the ground strip. */
  groundLine:  number;
  /** Moving dashes colour on the ground. */
  decoColor:   number;
  /** Background decorative element colour (dunes, trees, buildings). */
  bgDecoA:     number;
  bgDecoB:     number;
  /** Primary cactus/ground-obstacle colour. */
  cactusA:     number;
  /** Secondary cactus colour (shading stripe). */
  cactusB:     number;
  /** Bird wing colour. */
  birdA:       number;
  /** Bird body colour. */
  birdB:       number;
  /** Bird beak/accent colour. */
  birdC:       number;
  // ── Difficulty multipliers ────────────────────────────────────────────────
  /** Obstacle speed multiplier (1 = base speed). */
  speedMult:   number;
  /** Spawn interval multiplier (>1 = more spaced, <1 = denser). */
  spawnMult:   number;
}

export const THEMES: Record<GameTheme, ThemeData> = {
  // ── 🏜️  Desierto — Fácil ──────────────────────────────────────────────────
  desert: {
    label:      'Fácil',
    emoji:      '🏜️',
    skyTop:     0x87ceeb,   // pale sky blue
    skyBot:     0xf5c87a,   // warm sandy horizon
    groundColor: 0xc2935a,  // sand brown
    groundLine:  0x8b6028,
    decoColor:   0xa07840,
    bgDecoA:     0xe8c278,  // distant dunes
    bgDecoB:     0xd4a84a,
    cactusA:    0x2e7d32,   // green cactus
    cactusB:    0x43a047,
    birdA:      0x8d6e63,   // vulture
    birdB:      0x6d4c41,
    birdC:      0xffca28,
    speedMult:  0.75,
    spawnMult:  1.5,        // longest gaps
  },
  // ── 🌿  Jungla — Medio ────────────────────────────────────────────────────
  jungle: {
    label:      'Medio',
    emoji:      '🌿',
    skyTop:     0x0d3b10,   // deep forest canopy
    skyBot:     0x2a6e2a,
    groundColor: 0x4e342e,  // muddy ground
    groundLine:  0x3e2723,
    decoColor:   0x6d4c41,
    bgDecoA:     0x1b5e20,  // tree silhouettes
    bgDecoB:     0x388e3c,
    cactusA:    0x5d4037,   // fallen log (brown)
    cactusB:    0x8d6e63,
    birdA:      0xe53935,   // parrot (red)
    birdB:      0x43a047,   // parrot (green)
    birdC:      0xfdd835,
    speedMult:  1.0,
    spawnMult:  1.0,
  },
  // ── 🌙  Ciudad Nocturna — Difícil ─────────────────────────────────────────
  night: {
    label:      'Difícil',
    emoji:      '🌙',
    skyTop:     0x060614,   // near-black
    skyBot:     0x101030,
    groundColor: 0x1e1e30,  // dark asphalt
    groundLine:  0x4040a0,  // neon-blue edge
    decoColor:   0x5050c0,
    bgDecoA:     0x0e0e28,  // city silhouette
    bgDecoB:     0x1a1a48,
    cactusA:    0xff5722,   // warning cone (orange)
    cactusB:    0xff8a65,
    birdA:      0x1a1a2e,   // bat (near-black)
    birdB:      0x37474f,
    birdC:      0x607d8b,
    speedMult:  1.35,
    spawnMult:  0.65,       // shortest gaps
  },
};

// ── Main game constants ───────────────────────────────────────────────────────
export const DINO_CONFIG = {
  // ── Canvas ─────────────────────────────────────────────────────────────────
  /** Widened from 800 to fill more of the game page. */
  canvasWidth:  1050,
  canvasHeight: 500,

  // ── Physics ────────────────────────────────────────────────────────────────
  gravity:      1800,   // lowered gravity for a longer, floatier arc
  jumpVelocity: -850,   // increased upward burst

  // ── Dino geometry ──────────────────────────────────────────────────────────
  dinoX:        120,
  dinoWidth:     50,
  dinoHeight:    60,
  /** Y-coordinate of the top edge of the ground strip (90 % of canvas). */
  groundY:       445,

  // ── Obstacle dimensions ────────────────────────────────────────────────────
  cactusWidth:   30,
  cactusHeight:  50,
  birdWidth:     44,
  birdHeight:    22,
  /** Bird height above ground the player can duck under. */
  birdY:         395,
  /** X where new obstacles are created (just past the right edge). */
  obstacleSpawnX: 1110,

  // ── Fallback colours (used if a theme builder is bypassed) ─────────────────
  colorDino:    0x4caf50,
  colorGround:  0xffffff,
  colorCactus:  0x8b4513,
  colorBird:    0x9e9e9e,

  // ── Speed & spawn intervals ────────────────────────────────────────────────
  /** Base obstacle speed in px/s — theme multiplier is applied on top. */
  initialObstacleSpeed: -280,
  /** ms between obstacle spawns (base) — theme multiplier is applied. */
  spawnInterval:        2800,
  /** ±ms random variance per spawn. */
  spawnVariance:         400,

  // ── Scoring ────────────────────────────────────────────────────────────────
  scoreInterval:         100,   // ms per +1 point
  birdScoreThreshold:    100,   // score before aerial obstacles appear
  birdProbability:       0.30,

  // ── Difficulty scaling ─────────────────────────────────────────────────────
  speedIncreaseEvery:    200,   // points per speed step
  speedIncreaseAmount:    25,   // px/s added per step
  spawnDecreaseEvery:    300,
  spawnDecreaseAmount:    80,   // ms removed per step
  minSpawnInterval:      1400,

  // ── Duck ───────────────────────────────────────────────────────────────────
  duckDuration:          320,

  // ── Game-over ──────────────────────────────────────────────────────────────
  gameOverDelay:        1500,
} as const;
