import * as Phaser from 'phaser';
import type { GameInstance } from '@/src/lib/types';

// ── Constants ─────────────────────────────────────────────────────
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const BIRD_SIZE = 24;
const PIPE_WIDTH = 52;
const PIPE_GAP = 150;
const GRAVITY = 900;
const FLAP_VELOCITY = -320;
const BASE_PIPE_SPEED = 180;
const SPEED_INCREMENT = 0.3; // per second

// ── Flappy Scene ──────────────────────────────────────────────────
class FlappyScene extends Phaser.Scene {
  private bird!: Phaser.GameObjects.Rectangle;
  private pipes: Phaser.GameObjects.Rectangle[] = [];
  private ground!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;

  private birdVelocity = 0;
  private score = 0;
  private pipeSpeed = BASE_PIPE_SPEED;
  private pipeTimer = 0;
  private pipeInterval = 1800;
  private isGameOver = false;
  private elapsed = 0;

  public gameOverCallback: ((score: number) => void) | null = null;
  public isPaused = false;

  constructor() {
    super({ key: 'FlappyScene' });
  }

  create(): void {
    // Sky gradient background
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Ground
    this.ground = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 15,
      GAME_WIDTH,
      30,
      0x16213e,
    );

    // Bird
    this.bird = this.add.rectangle(
      100,
      GAME_HEIGHT / 2,
      BIRD_SIZE,
      BIRD_SIZE,
      0xfbbf24,
    );

    // Score text
    this.scoreText = this.add.text(GAME_WIDTH / 2, 40, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '24px',
      color: '#ffffff',
    });
    this.scoreText.setOrigin(0.5);

    this.birdVelocity = 0;
    this.score = 0;
    this.pipeSpeed = BASE_PIPE_SPEED;
    this.pipeTimer = 0;
    this.elapsed = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.pipes = [];

    const cb = (this.game as any).gymcitoGameOverCallback;
    if (cb) this.gameOverCallback = cb;
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    const dt = delta / 1000;
    this.elapsed += dt;

    // Gravity
    this.birdVelocity += GRAVITY * dt;
    this.bird.y += this.birdVelocity * dt;

    // Progressive speed
    this.pipeSpeed = BASE_PIPE_SPEED + this.elapsed * SPEED_INCREMENT * 60;

    // Pipe spawn timer
    this.pipeTimer += delta;
    if (this.pipeTimer >= this.pipeInterval) {
      this.pipeTimer = 0;
      this.spawnPipe();
    }

    // Move pipes
    const pipesToRemove: number[] = [];
    for (let i = 0; i < this.pipes.length; i += 2) {
      const topPipe = this.pipes[i];
      const bottomPipe = this.pipes[i + 1];

      if (!topPipe || !bottomPipe) continue;

      const moveAmount = this.pipeSpeed * dt;
      topPipe.x -= moveAmount;
      bottomPipe.x -= moveAmount;

      // Score: when bird passes the pipe center
      if (
        topPipe.x + PIPE_WIDTH / 2 < this.bird.x &&
        topPipe.x + PIPE_WIDTH / 2 >= this.bird.x - moveAmount
      ) {
        this.score++;
        this.scoreText.setText(String(this.score));
      }

      // Remove off-screen pipes
      if (topPipe.x < -PIPE_WIDTH) {
        pipesToRemove.push(i);
      }
    }

    // Clean up off-screen pipes (iterate in reverse)
    for (let i = pipesToRemove.length - 1; i >= 0; i--) {
      const idx = pipesToRemove[i];
      const top = this.pipes[idx];
      const bottom = this.pipes[idx + 1];
      top.destroy();
      bottom.destroy();
      this.pipes.splice(idx, 2);
    }

    // Collision: ground / ceiling
    if (this.bird.y + BIRD_SIZE / 2 >= GAME_HEIGHT - 30 || this.bird.y - BIRD_SIZE / 2 <= 0) {
      this.endGame();
      return;
    }

    // Collision: pipes
    for (let i = 0; i < this.pipes.length; i++) {
      const pipe = this.pipes[i];
      if (this.rectsOverlap(this.bird, pipe)) {
        this.endGame();
        return;
      }
    }
  }

  private spawnPipe(): void {
    const gapY = Phaser.Math.Between(120, GAME_HEIGHT - 120 - PIPE_GAP);
    const topHeight = gapY;
    const bottomY = gapY + PIPE_GAP;
    const bottomHeight = GAME_HEIGHT - 30 - bottomY;

    const topPipe = this.add.rectangle(
      GAME_WIDTH + PIPE_WIDTH / 2,
      topHeight / 2,
      PIPE_WIDTH,
      topHeight,
      0x0f3460,
    );

    const bottomPipe = this.add.rectangle(
      GAME_WIDTH + PIPE_WIDTH / 2,
      bottomY + bottomHeight / 2,
      PIPE_WIDTH,
      bottomHeight,
      0x0f3460,
    );

    this.pipes.push(topPipe, bottomPipe);
  }

  private rectsOverlap(
    a: Phaser.GameObjects.Rectangle,
    b: Phaser.GameObjects.Rectangle,
  ): boolean {
    const ax = a.x - a.width / 2;
    const ay = a.y - a.height / 2;
    const bx = b.x - b.width / 2;
    const by = b.y - b.height / 2;

    return (
      ax < bx + b.width &&
      ax + a.width > bx &&
      ay < by + b.height &&
      ay + a.height > by
    );
  }

  private endGame(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    // Flash effect
    this.cameras.main.flash(200, 255, 0, 0);

    if (this.gameOverCallback) {
      this.gameOverCallback(this.score);
    }
  }

  public flap(): void {
    if (this.isGameOver || this.isPaused) return;
    this.birdVelocity = FLAP_VELOCITY;
  }

  public getScore(): number {
    return this.score;
  }
}

// ── FlappyGame wrapper class ──────────────────────────────────────
export class FlappyGame implements GameInstance {
  private phaserGame: Phaser.Game | null = null;
  private scene: FlappyScene | null = null;
  private gameOverCb: ((score: number) => void) | null = null;

  constructor(container: HTMLElement) {
    if (typeof window === 'undefined') return;

    const scene = new FlappyScene();
    this.scene = scene;

    this.phaserGame = new Phaser.Game({
      type: Phaser.CANVAS,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: container,
      backgroundColor: '#1a1a2e',
      scene: scene,
      physics: { default: 'arcade' },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      callbacks: {
        postBoot: (game: Phaser.Game) => {
          if (this.gameOverCb) {
            (game as any).gymcitoGameOverCallback = this.gameOverCb;
          }
        },
      },
    });
  }

  triggerFlap(): void {
    this.scene?.flap();
  }

  onGameOver(callback: (score: number) => void): void {
    this.gameOverCb = callback;
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('FlappyScene') as any;
      if (scene) scene.gameOverCallback = callback;
      (this.phaserGame as any).gymcitoGameOverCallback = callback;
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
    this.phaserGame?.destroy(true);
    this.phaserGame = null;
    this.gameOverCb = null;
    this.scene = null;
  }
}
