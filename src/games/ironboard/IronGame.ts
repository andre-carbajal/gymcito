import * as Phaser from 'phaser';
import type { GameInstance } from '@/src/lib/types';

// ── Constants ─────────────────────────────────────────────────────
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 50;
const PLAYER_Y = 520;
const BASE_SPEED = 200;
const SPEED_INCREMENT = 0.35;
const PERFECT_THRESHOLD = 0.15; // angle threshold for "perfect posture"
const PERFECT_BONUS_INTERVAL = 500; // ms between perfect posture bonuses

// ── Iron Scene ────────────────────────────────────────────────────
class IronScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private board!: Phaser.GameObjects.Rectangle;
  private obstacles: Phaser.GameObjects.Rectangle[] = [];
  private particles: Phaser.GameObjects.Rectangle[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private perfectText!: Phaser.GameObjects.Text;
  private laneLines: Phaser.GameObjects.Rectangle[] = [];

  private tilt = 0; // -1 to 1
  private score = 0;
  private speed = BASE_SPEED;
  private obstacleTimer = 0;
  private obstacleInterval = 1200;
  private isGameOver = false;
  private elapsed = 0;
  private perfectTimer = 0;
  private perfectStreak = 0;
  private showPerfect = false;
  private perfectFadeTimer = 0;

  public gameOverCallback: ((score: number) => void) | null = null;
  public isPaused = false;

  constructor() {
    super({ key: 'IronScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0f0f23');

    // Lane lines for visual depth
    const laneCount = 5;
    this.laneLines = [];
    for (let i = 0; i < laneCount; i++) {
      const x = (GAME_WIDTH / (laneCount + 1)) * (i + 1);
      const line = this.add.rectangle(x, GAME_HEIGHT / 2, 1, GAME_HEIGHT, 0x1a1a3e);
      line.setAlpha(0.3);
      this.laneLines.push(line);
    }

    // Board
    this.board = this.add.rectangle(
      GAME_WIDTH / 2,
      PLAYER_Y + PLAYER_HEIGHT / 2 + 8,
      PLAYER_WIDTH + 30,
      8,
      0x06b6d4,
    );

    // Player
    this.player = this.add.rectangle(
      GAME_WIDTH / 2,
      PLAYER_Y,
      PLAYER_WIDTH,
      PLAYER_HEIGHT,
      0x22c55e,
    );

    // Score
    this.scoreText = this.add.text(GAME_WIDTH / 2, 30, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px',
      color: '#ffffff',
    });
    this.scoreText.setOrigin(0.5);

    // Perfect posture text
    this.perfectText = this.add.text(GAME_WIDTH / 2, 70, '✨ PERFECT! ✨', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#fbbf24',
    });
    this.perfectText.setOrigin(0.5);
    this.perfectText.setAlpha(0);

    this.resetState();
  }

  private resetState(): void {
    this.tilt = 0;
    this.score = 0;
    this.speed = BASE_SPEED;
    this.obstacleTimer = 0;
    this.elapsed = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.perfectTimer = 0;
    this.perfectStreak = 0;
    this.obstacles = [];
    this.particles = [];
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    const dt = delta / 1000;
    this.elapsed += dt;

    // Progressive speed
    this.speed = BASE_SPEED + this.elapsed * SPEED_INCREMENT * 60;

    // Base score (time based)
    this.score = Math.floor(this.elapsed * 8);

    // Move player based on tilt
    const targetX = GAME_WIDTH / 2 + this.tilt * (GAME_WIDTH / 2 - PLAYER_WIDTH);
    this.player.x += (targetX - this.player.x) * 0.12;
    this.board.x = this.player.x;

    // Clamp to bounds
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      PLAYER_WIDTH / 2 + 10,
      GAME_WIDTH - PLAYER_WIDTH / 2 - 10,
    );
    this.board.x = this.player.x;

    // Board tilt visual (rotate slightly)
    this.board.setRotation(this.tilt * 0.2);

    // Perfect posture bonus
    if (Math.abs(this.tilt) < PERFECT_THRESHOLD) {
      this.perfectTimer += delta;
      if (this.perfectTimer >= PERFECT_BONUS_INTERVAL) {
        this.perfectTimer = 0;
        this.perfectStreak++;
        this.score += 5 * this.perfectStreak;
        this.showPerfectNotice();

        // Spawn particle effect
        this.spawnPerfectParticles();
      }
    } else {
      this.perfectTimer = 0;
      this.perfectStreak = 0;
    }

    // Perfect text fade
    if (this.showPerfect) {
      this.perfectFadeTimer -= delta;
      if (this.perfectFadeTimer <= 0) {
        this.showPerfect = false;
        this.perfectText.setAlpha(0);
      } else {
        this.perfectText.setAlpha(this.perfectFadeTimer / 800);
      }
    }

    this.scoreText.setText(String(this.score));

    // Obstacle spawn
    this.obstacleTimer += delta;
    const minInterval = Math.max(400, this.obstacleInterval - this.elapsed * 12);
    if (this.obstacleTimer >= minInterval) {
      this.obstacleTimer = 0;
      this.spawnObstacle();
    }

    // Move obstacles
    const toRemove: number[] = [];
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      obs.y += this.speed * dt;

      // Scale effect (getting closer)
      const progress = obs.y / GAME_HEIGHT;
      const scale = 0.5 + progress * 0.8;
      obs.setScale(scale);
      obs.setAlpha(0.5 + progress * 0.5);

      if (obs.y > GAME_HEIGHT + 50) {
        toRemove.push(i);
      }

      // Collision (only when near the player)
      if (obs.y > PLAYER_Y - 40 && obs.y < PLAYER_Y + PLAYER_HEIGHT + 10) {
        if (this.checkCollision(obs)) {
          this.endGame();
          return;
        }
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this.obstacles[idx].destroy();
      this.obstacles.splice(idx, 1);
    }

    // Move particles
    const particlesToRemove: number[] = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.y -= 60 * dt;
      p.setAlpha(p.alpha - dt * 2);
      if (p.alpha <= 0) {
        particlesToRemove.push(i);
      }
    }
    for (let i = particlesToRemove.length - 1; i >= 0; i--) {
      const idx = particlesToRemove[i];
      this.particles[idx].destroy();
      this.particles.splice(idx, 1);
    }
  }

  private spawnObstacle(): void {
    const width = Phaser.Math.Between(30, 70);
    const height = Phaser.Math.Between(15, 30);
    const x = Phaser.Math.Between(width / 2 + 20, GAME_WIDTH - width / 2 - 20);

    const colors = [0xf43f5e, 0xa855f7, 0xf97316, 0xef4444];
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];

    const rect = this.add.rectangle(x, -20, width, height, color);
    rect.setAlpha(0.3);
    this.obstacles.push(rect);
  }

  private spawnPerfectParticles(): void {
    for (let i = 0; i < 5; i++) {
      const p = this.add.rectangle(
        this.player.x + Phaser.Math.Between(-20, 20),
        this.player.y + Phaser.Math.Between(-10, 10),
        4,
        4,
        0xfbbf24,
      );
      this.particles.push(p);
    }
  }

  private showPerfectNotice(): void {
    this.showPerfect = true;
    this.perfectFadeTimer = 800;
    this.perfectText.setAlpha(1);
    this.perfectText.setText(
      this.perfectStreak > 3
        ? `🔥 STREAK x${this.perfectStreak}! 🔥`
        : '✨ PERFECT! ✨',
    );
  }

  private checkCollision(obs: Phaser.GameObjects.Rectangle): boolean {
    const scale = obs.scaleX;
    const ow = obs.width * scale;
    const oh = obs.height * scale;

    const px = this.player.x - PLAYER_WIDTH / 2;
    const py = this.player.y - PLAYER_HEIGHT / 2;
    const ox = obs.x - ow / 2;
    const oy = obs.y - oh / 2;

    return (
      px < ox + ow &&
      px + PLAYER_WIDTH > ox &&
      py < oy + oh &&
      py + PLAYER_HEIGHT > oy
    );
  }

  private endGame(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.cameras.main.flash(200, 255, 0, 0);

    if (this.gameOverCallback) {
      this.gameOverCallback(this.score);
    }
  }

  public updateTilt(angle: number): void {
    this.tilt = Phaser.Math.Clamp(angle, -1, 1);
  }

  public getScore(): number {
    return this.score;
  }
}

// ── IronGame wrapper class ────────────────────────────────────────
export class IronGame implements GameInstance {
  private game: Phaser.Game | null = null;
  private scene: IronScene | null = null;
  private gameOverCb: ((score: number) => void) | null = null;

  constructor(container: HTMLElement) {
    if (typeof window === 'undefined') return;

    const scene = new IronScene();
    this.scene = scene;

    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: container,
      backgroundColor: '#0f0f23',
      scene: scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    scene.events.once('create', () => {
      if (this.gameOverCb) {
        scene.gameOverCallback = this.gameOverCb;
      }
    });
  }

  setTilt(angle: number): void {
    this.scene?.updateTilt(angle);
  }

  onGameOver(callback: (score: number) => void): void {
    this.gameOverCb = callback;
    if (this.scene) {
      this.scene.gameOverCallback = callback;
    }
  }

  pause(): void {
    if (this.scene) this.scene.isPaused = true;
  }

  resume(): void {
    if (this.scene) this.scene.isPaused = false;
  }

  getScore(): number {
    return this.scene?.getScore() ?? 0;
  }

  destroy(): void {
    this.game?.destroy(true);
    this.game = null;
    this.scene = null;
  }
}
