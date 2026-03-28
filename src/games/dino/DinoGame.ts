import * as Phaser from 'phaser';
import type { GameInstance } from '@/src/lib/types';

// ── Constants ─────────────────────────────────────────────────────
const GAME_WIDTH = 800;
const GAME_HEIGHT = 300;
const GROUND_Y = 250;
const DINO_WIDTH = 30;
const DINO_HEIGHT = 50;
const DINO_DUCK_HEIGHT = 25;
const JUMP_VELOCITY = -500;
const GRAVITY = 1200;
const BASE_SPEED = 300;
const SPEED_INCREMENT = 0.4;

type ObstacleType = 'cactus_small' | 'cactus_tall' | 'bird';

interface Obstacle {
  rect: Phaser.GameObjects.Rectangle;
  type: ObstacleType;
  width: number;
  height: number;
}

// ── Dino Scene ────────────────────────────────────────────────────
class DinoScene extends Phaser.Scene {
  private dino!: Phaser.GameObjects.Rectangle;
  private ground!: Phaser.GameObjects.Rectangle;
  private obstacles: Obstacle[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private groundDots: Phaser.GameObjects.Rectangle[] = [];

  private dinoVelocityY = 0;
  private isJumping = false;
  private isDucking = false;
  private score = 0;
  private speed = BASE_SPEED;
  private obstacleTimer = 0;
  private obstacleInterval = 1500;
  private isGameOver = false;
  private elapsed = 0;

  public gameOverCallback: ((score: number) => void) | null = null;
  public isPaused = false;

  constructor() {
    super({ key: 'DinoScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Ground line
    this.ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 2, GAME_WIDTH, 4, 0x3b3b5c);

    // Ground texture dots
    this.groundDots = [];
    for (let i = 0; i < 40; i++) {
      const dot = this.add.rectangle(
        Phaser.Math.Between(0, GAME_WIDTH),
        GROUND_Y + Phaser.Math.Between(5, 25),
        2,
        2,
        0x2a2a4a,
      );
      this.groundDots.push(dot);
    }

    // Dino
    this.dino = this.add.rectangle(
      80,
      GROUND_Y - DINO_HEIGHT / 2,
      DINO_WIDTH,
      DINO_HEIGHT,
      0x22c55e,
    );

    // Eye
    this.add.rectangle(90, GROUND_Y - DINO_HEIGHT + 10, 4, 4, 0x1a1a2e);

    // Score
    this.scoreText = this.add.text(GAME_WIDTH - 20, 20, '00000', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#8b8ba7',
    });
    this.scoreText.setOrigin(1, 0);

    this.resetState();
  }

  private resetState(): void {
    this.dinoVelocityY = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.score = 0;
    this.speed = BASE_SPEED;
    this.obstacleTimer = 0;
    this.elapsed = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.obstacles = [];

    const cb = (this.game as any).gymcitoGameOverCallback;
    if (cb) this.gameOverCallback = cb;
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.isPaused) return;

    const dt = delta / 1000;
    this.elapsed += dt;

    // Score (increases with time)
    this.score = Math.floor(this.elapsed * 10);
    this.scoreText.setText(String(this.score).padStart(5, '0'));

    // Progressive speed
    this.speed = BASE_SPEED + this.elapsed * SPEED_INCREMENT * 60;

    // Dino physics
    if (this.isJumping) {
      this.dinoVelocityY += GRAVITY * dt;
      this.dino.y += this.dinoVelocityY * dt;

      const standingY = GROUND_Y - (this.isDucking ? DINO_DUCK_HEIGHT : DINO_HEIGHT) / 2;
      if (this.dino.y >= standingY) {
        this.dino.y = standingY;
        this.dinoVelocityY = 0;
        this.isJumping = false;
      }
    }

    // Obstacle spawn
    this.obstacleTimer += delta;
    const minInterval = Math.max(600, this.obstacleInterval - this.elapsed * 15);
    if (this.obstacleTimer >= minInterval) {
      this.obstacleTimer = 0;
      this.spawnObstacle();
    }

    // Move obstacles
    const toRemove: number[] = [];
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      obs.rect.x -= this.speed * dt;

      if (obs.rect.x < -obs.width) {
        toRemove.push(i);
      }

      // Collision
      if (this.checkCollision(obs)) {
        this.endGame();
        return;
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this.obstacles[idx].rect.destroy();
      this.obstacles.splice(idx, 1);
    }

    // Move ground dots
    for (const dot of this.groundDots) {
      dot.x -= this.speed * dt * 0.3;
      if (dot.x < -5) {
        dot.x = GAME_WIDTH + 5;
      }
    }
  }

  private spawnObstacle(): void {
    const types: ObstacleType[] = ['cactus_small', 'cactus_tall', 'bird'];
    const type = types[Phaser.Math.Between(0, this.elapsed > 5 ? 2 : 1)];

    let width: number;
    let height: number;
    let y: number;
    let color: number;

    switch (type) {
      case 'cactus_small':
        width = 16;
        height = 35;
        y = GROUND_Y - height / 2;
        color = 0xa855f7;
        break;
      case 'cactus_tall':
        width = 20;
        height = 55;
        y = GROUND_Y - height / 2;
        color = 0x7c3aed;
        break;
      case 'bird':
        width = 30;
        height = 18;
        y = GROUND_Y - Phaser.Math.Between(40, 90);
        color = 0xf43f5e;
        break;
    }

    const rect = this.add.rectangle(GAME_WIDTH + width, y, width, height, color);
    this.obstacles.push({ rect, type, width, height });
  }

  private checkCollision(obs: Obstacle): boolean {
    const dinoH = this.isDucking ? DINO_DUCK_HEIGHT : DINO_HEIGHT;
    const dx = this.dino.x - DINO_WIDTH / 2;
    const dy = this.dino.y - dinoH / 2;
    const ox = obs.rect.x - obs.width / 2;
    const oy = obs.rect.y - obs.height / 2;

    return (
      dx < ox + obs.width &&
      dx + DINO_WIDTH > ox &&
      dy < oy + obs.height &&
      dy + dinoH > oy
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

  public jump(): void {
    if (this.isGameOver || this.isPaused || this.isJumping) return;
    this.isJumping = true;
    this.isDucking = false;
    this.dinoVelocityY = JUMP_VELOCITY;
    this.dino.setSize(DINO_WIDTH, DINO_HEIGHT);
  }

  public duck(): void {
    if (this.isGameOver || this.isPaused || this.isJumping) return;
    this.isDucking = true;
    this.dino.setSize(DINO_WIDTH, DINO_DUCK_HEIGHT);
    this.dino.y = GROUND_Y - DINO_DUCK_HEIGHT / 2;
  }

  public standUp(): void {
    if (!this.isDucking) return;
    this.isDucking = false;
    this.dino.setSize(DINO_WIDTH, DINO_HEIGHT);
    this.dino.y = GROUND_Y - DINO_HEIGHT / 2;
  }

  public getScore(): number {
    return this.score;
  }
}

// ── DinoGame wrapper class ────────────────────────────────────────
export class DinoGame implements GameInstance {
  private phaserGame: Phaser.Game | null = null;
  private scene: DinoScene | null = null;
  private gameOverCb: ((score: number) => void) | null = null;

  constructor(container: HTMLElement) {
    if (typeof window === 'undefined') return;

    const scene = new DinoScene();
    this.scene = scene;

    this.phaserGame = new Phaser.Game({
      type: Phaser.CANVAS,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent: container,
      backgroundColor: '#1a1a2e',
      scene: scene,
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

  triggerJump(): void {
    this.scene?.jump();
  }

  triggerDuck(): void {
    this.scene?.duck();
  }

  onGameOver(callback: (score: number) => void): void {
    this.gameOverCb = callback;
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('DinoScene') as any;
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
