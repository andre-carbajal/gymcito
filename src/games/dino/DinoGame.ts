/**
 * DinoGame.ts — Gymcito Dino Runner
 *
 * ARCHITECTURE CONTRACT:
 * - This file only builds the Phaser physics engine.
 * - Camera, MoveNet AI, keyboard fallback, and skeleton drawing are
 *   handled externally by GameWrapper.tsx.
 * - GameWrapper calls triggerJump() / triggerDuck() based on pose
 *   detection or key presses. This class must not duplicate that logic.
 *
 * PUBLIC API (GameInstance interface):
 *   new DinoGame(container: HTMLElement)
 *   triggerJump(): void
 *   triggerDuck(): void
 *   onGameOver(cb: (score: number) => void): void
 *   pause(): void
 *   resume(): void
 *   getScore(): number
 *   destroy(): void
 */

import * as Phaser from 'phaser';
import type { GameInstance } from '@/src/lib/types';
import { DINO_CONFIG as C, THEMES, type GameTheme, type ThemeData } from './DinoConfig';

// ─ Module-level theme ──────────────────────────────────────────────────────────────
// Stored here (not in registry) so it survives scene restarts and is
// accessible before the first Phaser.Game is constructed.
let _currentTheme: GameTheme = 'desert';

/** Called by GameWrapper when the player picks a difficulty level. */
export function setGameTheme(theme: GameTheme): void {
  _currentTheme = theme;
}

// ─────────────────────────────────────────────────────────────────────────────
// CalibrationScene
// A blocking pre-game screen: shows positioning tips + 3-2-1 countdown.
// Transitions to DinoScene automatically when the countdown ends.
// ─────────────────────────────────────────────────────────────────────────────
class CalibrationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CalibrationScene' });
  }

  create(): void {
    const W = C.canvasWidth;
    const H = C.canvasHeight;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.9);

    this.add
      .text(W / 2, H / 2 - 80, '🏋️‍♂️ PREPÁRATE', {
        fontSize: '44px',
        color: '#FFD700',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 - 10, 'Asegúrate de que la cámara capte todo tu cuerpo', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, H / 2 + 25, '⬆️ Tu salto esquiva cactus  |  ⬇️ Tu sentadilla esquiva pájaros', {
        fontSize: '15px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    let count = 3;
    const countText = this.add
      .text(W / 2, H / 2 + 110, count.toString(), {
        fontSize: '60px',
        color: '#4caf50',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        count--;
        if (count === 0) {
          countText.setText('¡GO!');
          this.time.delayedCall(400, () => this.scene.start('DinoScene'));
        } else {
          countText.setText(count.toString());
        }
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DinoScene  –  the actual gameplay
// ─────────────────────────────────────────────────────────────────────────────
class DinoScene extends Phaser.Scene {
  // ── Physics objects ───────────────────────────────────────────────────────
  private dino!: Phaser.Physics.Arcade.Image;
  private groundGroup!: Phaser.Physics.Arcade.StaticGroup;
  private obstacles!: Phaser.Physics.Arcade.Group;

  // ── HUD ───────────────────────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;

  // ── Game state ────────────────────────────────────────────────────────────
  private score = 0;
  /**
   * True while the game is running. Set to false by _endGame() to prevent
   * double-fire (guards against multiple collision events in the same frame).
   */
  private gameRunning = false;
  public isPaused = false;

  // ── Timers & speed ────────────────────────────────────────────────────────
  private scoreTimer = 0;
  private spawnTimer = 0;
  private currentSpawnInterval: number = C.spawnInterval;
  private currentSpeed: number = Math.abs(C.initialObstacleSpeed);
  private lastSpeedMilestone = 0;
  private lastSpawnMilestone = 0;

  // ── Duck state ────────────────────────────────────────────────────────────
  private isDucking = false;
  private duckTimer = 0;

  // ── Tutorial state ──────────────────────────────────────────────────────────
  /** While true, obstacles do not spawn and score does not tick. */
  private tutorialDone = false;
  private tutorialJumped = false;
  private tutorialDucked = false;
  // References to tutorial UI so we can destroy them when done
  private tutJumpText!: Phaser.GameObjects.Text;
  private tutDuckText!: Phaser.GameObjects.Text;
  private tutJumpCheck!: Phaser.GameObjects.Text;
  private tutDuckCheck!: Phaser.GameObjects.Text;
  private tutReadyText!: Phaser.GameObjects.Text;
  private tutPanel!: Phaser.GameObjects.Rectangle;

  // ── Callback — injected via Phaser registry (see DinoGame.onGameOver) ──────
  private gameOverCb: ((score: number) => void) | null = null;

  // ── Active theme ────────────────────────────────────────────────────────────
  private theme!: ThemeData;
  private groundDashes!: Phaser.GameObjects.TileSprite;

  constructor() {
    super({ key: 'DinoScene' });
  }

  // ─────────────────────────────────────────────────────────────────────────
  create(): void {
    const W = C.canvasWidth;    // 1050
    const H = C.canvasHeight;   // 500
    const { groundY } = C;      // 445

    // Read current theme
    this.theme = THEMES[_currentTheme];
    const T = this.theme;

    // ── Themed sky gradient (two filled rectangles) ───────────────────────
    const sky = this.add.graphics();
    sky.fillStyle(T.skyTop);
    sky.fillRect(0, 0, W, groundY * 0.55);           // upper sky
    sky.fillStyle(T.skyBot);
    sky.fillRect(0, groundY * 0.55, W, groundY * 0.45); // lower sky / horizon

    // ── Background decorative elements per theme ───────────────────────
    this._drawBackground(T, W, groundY);


    // ── Ground fill + solid top line ─────────────────────────────────
    const gfx = this.add.graphics();
    gfx.fillStyle(T.groundColor);
    gfx.fillRect(0, groundY, W, H - groundY);         // ground fill
    gfx.fillStyle(T.groundLine);
    gfx.fillRect(0, groundY, W, 3);                   // top line

    // ── Scrolling ground dashes (TileSprite) ─────────────────────────
    this._buildDashTexture(T);
    this.groundDashes = this.add
      .tileSprite(0, groundY + 6, W, 3, `dash_${_currentTheme}`)
      .setOrigin(0, 0)
      .setDepth(1);

    // Pull the callback stored in registry by DinoGame.onGameOver().
    const cb = this.registry.get('gameOverCallback') as ((s: number) => void) | undefined;
    if (cb) this.gameOverCb = cb;

    // ── Ground — static physics body ──────────────────────────────────
    this.groundGroup = this.physics.add.staticGroup();
    const groundRect = this.add.rectangle(W / 2, groundY + 5, W, 10, 0x000000, 0);
    this.physics.add.existing(groundRect, true); // true → static body
    // Sync StaticBody position with the rectangle's actual coordinates
    (groundRect.body as Phaser.Physics.Arcade.StaticBody).reset(W / 2, groundY + 5);
    this.groundGroup.add(groundRect);

    // ── Pre-bake all textures before first spawn ────────────────────────────────
    this._buildDinoTexture();
    this._buildCactusTexture();
    this._buildBirdTexture();

    // ── Dino ─────────────────────────────────────────────────────────────────
    this.dino = this.physics.add.image(
      C.dinoX,
      groundY - C.dinoHeight / 2,
      'dino_rect',
    );
    this.dino.setOrigin(0.5, 0.5);
    this.dino.setDisplaySize(C.dinoWidth, C.dinoHeight);

    const dinoBody = this.dino.body as Phaser.Physics.Arcade.Body;
    dinoBody.setSize(C.dinoWidth, C.dinoHeight);
    // Prevent dino from ever falling through the canvas bottom
    dinoBody.setCollideWorldBounds(true);
    this.dino.setDepth(2);

    // ── Collider: dino ↔ ground ───────────────────────────────────────────────
    this.physics.add.collider(this.dino, this.groundGroup);

    // ── Obstacles group ───────────────────────────────────────────────────────
    // allowGravity: false on the group prevents Phaser from re-enabling
    // gravity when obstacles are added to it (which would override the
    // per-body setting and make cactuses fall off the screen).
    this.obstacles = this.physics.add.group({ allowGravity: false });

    // ── Score HUD ─────────────────────────────────────────────────────────────
    this.scoreText = this.add
      .text(W - 20, 15, 'Score: 0', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setDepth(5);
    this.scoreText.setVisible(false); // Hidden in favor of HTML wrapper overlay

    // ── Reset all state ───────────────────────────────────────────────────────
    this.score = 0;
    this.gameRunning = true;
    this.isPaused = false;
    this.isDucking = false;
    this.duckTimer = 0;
    this.scoreTimer = 0;
    this.spawnTimer = 0;
    this.currentSpeed = Math.abs(C.initialObstacleSpeed);
    this.currentSpawnInterval = C.spawnInterval;
    this.lastSpeedMilestone = 0;
    this.lastSpawnMilestone = 0;
    // Tutorial starts locked — obstacles won't spawn until player practices
    this.tutorialDone = false;
    this.tutorialJumped = false;
    this.tutorialDucked = false;

    // ── Tutorial UI (Minimalist) ──────────────────────────────────────────────
    const TY = 40;

    this.tutPanel = this.add
      .rectangle(W / 2, TY, 300, 30, 0x000000, 0.3)
      .setDepth(8);

    this.tutJumpText = this.add
      .text(W / 2 - 110, TY, '⬆️ SALTA', {
        fontSize: '14px', color: '#80cbc4', fontFamily: 'monospace'
      })
      .setOrigin(1, 0.5).setDepth(9);

    this.tutJumpCheck = this.add
      .text(W / 2 - 80, TY, '', {
        fontSize: '14px', color: '#4caf50', fontFamily: 'monospace'
      })
      .setOrigin(0.5).setDepth(9);

    this.tutDuckText = this.add
      .text(W / 2 + 10, TY, '⬇️ AGÁCHATE', {
        fontSize: '14px', color: '#ce93d8', fontFamily: 'monospace'
      })
      .setOrigin(0, 0.5).setDepth(9);

    this.tutDuckCheck = this.add
      .text(W / 2 + 115, TY, '', {
        fontSize: '14px', color: '#4caf50', fontFamily: 'monospace'
      })
      .setOrigin(0.5).setDepth(9);

    this.tutReadyText = this.add
      .text(W / 2, TY + 30, '', {
        fontSize: '14px', color: '#4caf50', fontStyle: 'bold', fontFamily: 'monospace'
      })
      .setOrigin(0.5).setDepth(9);

    this.tweens.add({
      targets: [this.tutJumpText, this.tutDuckText],
      alpha: { from: 1, to: 0.5 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ── Themed background drawing ──────────────────────────────────────────────
  private _drawBackground(T: ThemeData, W: number, groundY: number): void {
    const bg = this.add.graphics();
    if (_currentTheme === 'desert') {
      // Rolling sand dunes (3 overlapping ellipses)
      bg.fillStyle(T.bgDecoB);
      bg.fillEllipse(120, groundY - 2, 320, 100);
      bg.fillEllipse(440, groundY - 2, 280, 80);
      bg.fillEllipse(750, groundY - 2, 240, 70);
      bg.fillEllipse(980, groundY - 2, 200, 60);
      bg.fillStyle(T.bgDecoA);
      bg.fillEllipse(200, groundY, 280, 80);
      bg.fillEllipse(560, groundY, 320, 90);
      bg.fillEllipse(870, groundY, 260, 75);
    } else if (_currentTheme === 'jungle') {
      // Tree silhouettes
      const drawTree = (x: number, h: number) => {
        bg.fillStyle(T.bgDecoA);
        bg.fillRect(x - 6, groundY - h, 12, h); // trunk
        bg.fillStyle(T.bgDecoB);
        bg.fillTriangle(x - 40, groundY - h + 20, x + 40, groundY - h + 20, x, groundY - h - 60);
        bg.fillTriangle(x - 32, groundY - h - 20, x + 32, groundY - h - 20, x, groundY - h - 80);
      };
      [80, 220, 400, 580, 760, 940].forEach((x, i) => drawTree(x, 100 + (i % 3) * 30));
    } else if (_currentTheme === 'night') {
      // City silhouette buildings
      const drawBuilding = (x: number, w: number, h: number, lit: boolean) => {
        bg.fillStyle(T.bgDecoA);
        bg.fillRect(x, groundY - h, w, h);
        if (lit) {
          bg.fillStyle(0xf9a825, 0.6);  // lit windows
          for (let wy = groundY - h + 8; wy < groundY - 8; wy += 14) {
            for (let wx = x + 4; wx < x + w - 4; wx += 10) {
              if (Math.random() > 0.35) bg.fillRect(wx, wy, 5, 7);
            }
          }
        }
      };
      drawBuilding(0, 70, 140, true);
      drawBuilding(80, 50, 200, true);
      drawBuilding(140, 80, 100, false);
      drawBuilding(230, 60, 160, true);
      drawBuilding(300, 90, 120, false);
      drawBuilding(400, 55, 180, true);
      drawBuilding(465, 75, 90, false);
      drawBuilding(550, 65, 150, true);
      drawBuilding(620, 85, 110, false);
      drawBuilding(720, 70, 170, true);
      drawBuilding(800, 100, 130, false);
      drawBuilding(910, 60, 160, true);
      drawBuilding(980, 80, 90, false);
    }
  }

  /** Creates a 50×3 tile texture for the scrolling ground dash line. */
  private _buildDashTexture(T: ThemeData): void {
    const key = `dash_${_currentTheme}`;
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(T.decoColor);
    g.fillRect(0, 0, 14, 3);
    g.generateTexture(key, 24, 3); // 14px dash + 10px gap repeating
    g.destroy();
  }

  // ── Texture builders ──────────────────────────────────────────────────────

  /**
   * Draws a pixel-art T-Rex silhouette onto a texture.
   * Canvas size matches C.dinoWidth × C.dinoHeight (50×60).
   */
  private _buildDinoTexture(): void {
    if (this.textures.exists('dino_rect')) return;
    const W = C.dinoWidth;   // 50
    const H = C.dinoHeight;  // 60
    const g = this.make.graphics({ x: 0, y: 0 });

    const body = 0x4caf50; // green body
    const dark = 0x2e7d32; // dark green outline / detail
    const cream = 0xc8e6c9; // light belly
    const eye = 0x1a1a1a; // dark eye

    // ─ Body (main torso) ────────────────────────────────────────────────
    g.fillStyle(body);
    g.fillRect(10, 20, 32, 22); // torso

    // ─ Tail ──────────────────────────────────────────────────────────
    g.fillStyle(body);
    g.fillRect(0, 30, 14, 10); // tail base
    g.fillRect(0, 26, 6, 14);  // tail tip
    g.fillStyle(dark);
    g.fillRect(0, 25, 4, 2);   // tail tip accent

    // ─ Neck ──────────────────────────────────────────────────────────
    g.fillStyle(body);
    g.fillRect(32, 8, 12, 18);  // neck

    // ─ Head ──────────────────────────────────────────────────────────
    g.fillStyle(body);
    g.fillRect(34, 2, 16, 14);  // head block
    // Snout
    g.fillRect(44, 8, 6, 8);    // snout extension
    // Cream belly/jaw
    g.fillStyle(cream);
    g.fillRect(36, 10, 10, 6);  // jaw / underside of head
    g.fillRect(44, 10, 4, 6);   // snout underside
    // Eye
    g.fillStyle(eye);
    g.fillRect(42, 4, 4, 4);    // eye socket
    g.fillStyle(0xffffff);
    g.fillRect(44, 4, 2, 2);    // eye glint
    // Nostril
    g.fillStyle(dark);
    g.fillRect(48, 9, 2, 2);

    // ─ Tiny arms (T-Rex characteristic) ─────────────────────────────
    g.fillStyle(dark);
    g.fillRect(34, 22, 6, 4);   // upper arm
    g.fillRect(36, 26, 6, 3);   // forearm
    g.fillRect(38, 29, 4, 2);   // claw hint

    // ─ Belly (lighter stripe) ────────────────────────────────────
    g.fillStyle(cream);
    g.fillRect(14, 26, 16, 12); // belly stripe

    // ─ Legs ──────────────────────────────────────────────────────────
    g.fillStyle(body);
    g.fillRect(14, 42, 10, 14); // left thigh
    g.fillRect(28, 42, 10, 14); // right thigh
    // Lower legs / feet
    g.fillStyle(dark);
    g.fillRect(12, 52, 12, 8);  // left foot
    g.fillRect(26, 52, 12, 8);  // right foot
    // Foot claws
    g.fillStyle(0x1b5e20);
    g.fillRect(10, 58, 4, 2);
    g.fillRect(16, 58, 4, 2);
    g.fillRect(24, 58, 4, 2);
    g.fillRect(30, 58, 4, 2);

    // ─ Dark outline pass ────────────────────────────────────────────
    g.lineStyle(1, dark, 0.6);
    g.strokeRect(10, 20, 32, 22);
    g.strokeRect(34, 2, 16, 14);

    g.generateTexture('dino_rect', W, H);
    g.destroy();
  }

  /** Draws a themed cactus/obstacle silhouette onto a texture. */
  private _buildCactusTexture(): void {
    const key = `cactus_${_currentTheme}`;
    if (this.textures.exists(key)) return;
    const W = C.cactusWidth;
    const H = C.cactusHeight;
    const g = this.make.graphics({ x: 0, y: 0 });
    const T = this.theme;

    if (_currentTheme === 'night') {
      // Traffic cone
      g.fillStyle(T.cactusA);
      g.fillTriangle(W / 2, 0, W, H, 0, H);      // cone body
      g.fillStyle(0xffffff);
      g.fillRect(2, H - 8, W - 4, 4);              // white base stripe
      g.fillRect(4, H * 0.4, W - 8, 3);           // white mid stripe
    } else if (_currentTheme === 'jungle') {
      // Mossy log
      g.fillStyle(T.cactusA);
      g.fillRect(6, 0, W - 12, H);                // log trunk
      g.fillStyle(T.cactusB);
      g.fillRect(6, 0, W - 12, 6);               // moss top
      g.fillStyle(0x4e342e);
      g.fillRect(8, H * 0.3, 4, 6); g.fillRect(8, H * 0.6, 4, 4); // bark
      g.fillRect(W - 12, H * 0.25, 4, 8);
    } else {
      // Desert cactus (original shape)
      g.fillStyle(T.cactusA);
      g.fillRect(10, 0, 10, H);
      g.fillRect(0, 12, 14, 8);
      g.fillRect(0, 4, 8, 16);
      g.fillRect(16, 18, 14, 8);
      g.fillRect(22, 10, 8, 16);
      g.fillStyle(T.cactusB);
      g.fillRect(13, 2, 4, H - 4);
      g.fillRect(2, 6, 3, 10);
      g.fillRect(25, 12, 3, 10);
    }
    g.generateTexture(key, W, H);
    g.destroy();
  }

  /** Draws a themed bird/aerial obstacle onto a texture. */
  private _buildBirdTexture(): void {
    const key = `bird_${_currentTheme}`;
    if (this.textures.exists(key)) return;
    const W = C.birdWidth;
    const H = C.birdHeight;
    const g = this.make.graphics({ x: 0, y: 0 });
    const T = this.theme;

    if (_currentTheme === 'night') {
      // Bat
      g.fillStyle(T.birdA);
      g.fillEllipse(W / 2, H * 0.55, 10, 8);     // bat body
      g.fillTriangle(0, H, W * 0.45, H * 0.3, W * 0.2, H); // left wing
      g.fillTriangle(W, H, W * 0.55, H * 0.3, W * 0.8, H); // right wing
      g.fillStyle(0xff1744); g.fillRect(W / 2 - 1, 1, 2, 2); // eyes
    } else if (_currentTheme === 'jungle') {
      // Colourful parrot
      g.fillStyle(T.birdA);   // red body / wings
      g.fillRect(0, 4, 18, 6);
      g.fillRect(22, 4, 18, 6);
      g.fillRect(2, 2, 12, 4);
      g.fillRect(26, 2, 12, 4);
      g.fillStyle(T.birdB);   // green head + center
      g.fillRect(16, 6, 8, 10);
      g.fillRect(22, 2, 8, 8);
      g.fillStyle(T.birdC);   // yellow beak
      g.fillRect(28, 5, 10, 3);
      g.fillStyle(0x212121); g.fillRect(25, 3, 3, 3);
    } else {
      // Vulture (desert)
      g.fillStyle(T.birdA);
      g.fillRect(0, 4, 18, 6);
      g.fillRect(22, 4, 18, 6);
      g.fillRect(2, 2, 12, 4);
      g.fillRect(26, 2, 12, 4);
      g.fillStyle(T.birdB);
      g.fillRect(16, 6, 8, 10);
      g.fillRect(20, 2, 8, 8);
      g.fillStyle(T.birdC);   // yellow beak
      g.fillRect(26, 5, 12, 3);
      g.fillStyle(0x212121); g.fillRect(23, 3, 3, 3);
    }
    g.generateTexture(key, W, H);
    g.destroy();
  }

  // ── Fallback solid-color texture (used only if builder is skipped) ───────
  private _ensureTexture(key: string, w: number, h: number, color: number): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // ─────────────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (!this.gameRunning || this.isPaused) return;

    // ── Tutorial phase: no score, no obstacles, wait for jump + duck ──────────
    if (!this.tutorialDone) return;

    // ── Scroll ground dashes ─────────────────────────────────────────────────
    this.groundDashes.tilePositionX += (this.currentSpeed * delta) / 1000;

    // ── Score: +1 every scoreInterval ms ─────────────────────────────────────
    this.scoreTimer += delta;
    if (this.scoreTimer >= C.scoreInterval) {
      this.scoreTimer -= C.scoreInterval;
      this.score += 1;
      this.scoreText.setText(`Score: ${this.score}`);
    }

    // ── Difficulty: speed increases every 200 points ──────────────────────────
    const speedMilestone = Math.floor(this.score / C.speedIncreaseEvery);
    if (speedMilestone > this.lastSpeedMilestone) {
      this.currentSpeed +=
        C.speedIncreaseAmount * (speedMilestone - this.lastSpeedMilestone);
      this.lastSpeedMilestone = speedMilestone;
    }

    // ── Difficulty: spawn interval shrinks every 300 points ───────────────────
    const spawnMilestone = Math.floor(this.score / C.spawnDecreaseEvery);
    if (spawnMilestone > this.lastSpawnMilestone) {
      const steps = spawnMilestone - this.lastSpawnMilestone;
      this.currentSpawnInterval = Math.max(
        C.minSpawnInterval,
        this.currentSpawnInterval - C.spawnDecreaseAmount * steps,
      );
      this.lastSpawnMilestone = spawnMilestone;
    }

    // ── Spawn obstacles from the right ────────────────────────────────────────
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.currentSpawnInterval) {
      this.spawnTimer = 0;
      // Recalculate next interval with ±300ms variance
      const variance = (Math.random() * 2 - 1) * C.spawnVariance;
      this.currentSpawnInterval = Math.max(
        C.minSpawnInterval,
        C.spawnInterval -
        Math.floor(this.score / C.spawnDecreaseEvery) * C.spawnDecreaseAmount +
        variance,
      );
      this._spawnObstacle();
    }

    // ── Move obstacles left; destroy when off-screen ──────────────────────────
    const toDestroy: Phaser.Physics.Arcade.Image[] = [];
    this.obstacles.getChildren().forEach((obj) => {
      const obs = obj as Phaser.Physics.Arcade.Image;
      obs.x -= (this.currentSpeed * delta) / 1000;
      if (obs.x < -50) toDestroy.push(obs);
    });
    toDestroy.forEach((obs) => obs.destroy());

    // Auto-restore duck timer REMOVED. Ducking is now held as long as the player 
    // maintains the squat posture (or holds the down arrow).

    // ── AABB collision detection (with 5px forgiveness margin) ───────────────
    const body = this.dino.body as Phaser.Physics.Arcade.Body;
    const margin = 5;
    const dl = this.dino.x - body.halfWidth + margin;
    const dr = this.dino.x + body.halfWidth - margin;
    const dt = this.dino.y - body.halfHeight + margin;
    const db = this.dino.y + body.halfHeight - margin;

    for (const obj of this.obstacles.getChildren()) {
      const obs = obj as Phaser.Physics.Arcade.Image;
      const ob = obs.body as Phaser.Physics.Arcade.Body;
      const ol = obs.x - ob.halfWidth;
      const or_ = obs.x + ob.halfWidth;
      const ot = obs.y - ob.halfHeight;
      const ob_ = obs.y + ob.halfHeight;

      if (dr > ol && dl < or_ && db > ot && dt < ob_) {
        this._endGame();
        return;
      }
    }
  }

  // ── Obstacle factory ──────────────────────────────────────────────────────
  private _spawnObstacle(): void {
    const isBird =
      this.score > C.birdScoreThreshold && Math.random() < C.birdProbability;

    if (isBird) {
      const birdKey = `bird_${_currentTheme}`;
      const birdsCount = 3; // Cantidad de aves en formación
      const birdSpacing = 60; // Espacio en píxeles entre cada ave

      for (let i = 0; i < birdsCount; i++) {
        // Desplazamos cada ave hacia la derecha sumando el spacing
        const spawnX = C.obstacleSpawnX + (i * birdSpacing);

        const bird = this.obstacles.create(
          spawnX, C.birdY, birdKey,
        ) as Phaser.Physics.Arcade.Image;

        bird.setOrigin(0.5, 0.5);
        bird.setDisplaySize(C.birdWidth, C.birdHeight);
        bird.setDepth(2);

        const bBody = bird.body as Phaser.Physics.Arcade.Body;
        bBody.setSize(C.birdWidth, C.birdHeight);
        bBody.allowGravity = false;
        bBody.setGravityY(-C.gravity);
      }
    } else {
      const cactusKey = `cactus_${_currentTheme}`;
      const cactusY = C.groundY - C.cactusHeight / 2;
      const cactus = this.obstacles.create(
        C.obstacleSpawnX, cactusY, cactusKey,
      ) as Phaser.Physics.Arcade.Image;
      cactus.setOrigin(0.5, 0.5);
      cactus.setDisplaySize(C.cactusWidth, C.cactusHeight);
      cactus.setDepth(2);
      const cBody = cactus.body as Phaser.Physics.Arcade.Body;
      cBody.setSize(C.cactusWidth, C.cactusHeight);
      cBody.allowGravity = false;
      cBody.setGravityY(-C.gravity);
    }
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  private _endGame(): void {
    if (!this.gameRunning) return; // double-fire guard
    this.gameRunning = false;

    // Freeze all physics (stops gravity on dino + obstacle movement)
    this.physics.pause();

    const W = C.canvasWidth;
    const H = C.canvasHeight;

    // Semi-transparent overlay
    this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)
      .setDepth(10);

    // "GAME OVER" — vertically centred for 600px canvas
    this.add
      .text(W / 2, H / 2 - 60, 'GAME OVER', {
        fontSize: '52px',
        color: '#ff4444',
        fontStyle: 'bold',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(11);

    // Final score
    this.add
      .text(W / 2, H / 2 + 10, `Score final: ${this.score}`, {
        fontSize: '26px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(11);

    // Fire callback after 1 500 ms
    this.time.delayedCall(C.gameOverDelay, () => {
      this.gameOverCb?.(this.score);
    });
  }

  // ── Public controls (called by DinoGame via triggerJump/triggerDuck) ──────

  /**
   * Apply upward velocity ONLY when the dino is touching the ground.
   * Uses body.blocked.down || body.touching.down for reliability across
   * different physics tick timings.
   */
  public doJump(): void {
    if (!this.gameRunning || this.isPaused) return;
    if (!this.dino?.body) return;
    const body = this.dino.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down || body.touching.down) {
      // Cancel any active duck before jumping
      this.isDucking = false;
      body.setSize(C.dinoWidth, C.dinoHeight);
      this.dino.setDisplaySize(C.dinoWidth, C.dinoHeight);
      body.setVelocityY(C.jumpVelocity); // -600 px/s

      // ── Tutorial: mark jump as done ───────────────────────────────────
      if (!this.tutorialJumped) {
        this.tutorialJumped = true;
        this.tutJumpCheck.setText('✅');
        this.tweens.killTweensOf(this.tutJumpText);
        this.tutJumpText.setAlpha(1).setColor('#4caf50');
        this._checkTutorialDone();
      }
    }
  }

  /**
   * Reduce hitbox and display to half height for 500 ms, then restore.
   * Only acts when the dino is on the ground (no mid-air ducking).
   */
  public doDuck(): void {
    if (!this.gameRunning || this.isPaused) return;
    if (!this.dino?.body) return;
    const body = this.dino.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.down && !body.touching.down) return; // airborne – skip

    this.isDucking = true;
    this.duckTimer = 0;
    const duckH = C.dinoHeight * 0.5;
    body.setSize(C.dinoWidth, duckH);
    this.dino.setDisplaySize(C.dinoWidth, duckH);
    // Shift Y so the bottom stays flush with the ground
    this.dino.y = C.groundY - duckH / 2;

    // ── Tutorial: mark duck as done ───────────────────────────────────
    if (!this.tutorialDucked) {
      this.tutorialDucked = true;
      this.tutDuckCheck.setText('✅');
      this.tweens.killTweensOf(this.tutDuckText);
      this.tutDuckText.setAlpha(1).setColor('#4caf50');
      this._checkTutorialDone();
    }
  }

  /** Called after each tutorial action completes. Starts game when both done. */
  private _checkTutorialDone(): void {
    if (!this.tutorialJumped || !this.tutorialDucked) return;
    if (this.tutorialDone) return;

    // Show the ready message
    this.tutReadyText.setText('¡Perfecto! — Los obstáculos comienzan en 2s...');

    // Fade out the panel after 2 seconds, then start spawning
    this.time.delayedCall(2_000, () => {
      this.tweens.add({
        targets: [
          this.tutPanel, this.tutJumpText, this.tutDuckText,
          this.tutJumpCheck, this.tutDuckCheck, this.tutReadyText,
        ],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.tutPanel.destroy();
          this.tutJumpText.destroy();
          this.tutDuckText.destroy();
          this.tutJumpCheck.destroy();
          this.tutDuckCheck.destroy();
          this.tutReadyText.destroy();
        },
      });
      // Unlock spawning
      this.tutorialDone = true;
      this.spawnTimer = 0;
    });
  }

  public doStandUp(): void {
    if (!this.isDucking) return;
    this.isDucking = false;
    const body = this.dino.body as Phaser.Physics.Arcade.Body;
    body.setSize(C.dinoWidth, C.dinoHeight);
    this.dino.setDisplaySize(C.dinoWidth, C.dinoHeight);
    this.dino.y = C.groundY - C.dinoHeight / 2;
  }

  public getScore(): number {
    return this.score;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DinoGame  –  public wrapper that satisfies GameInstance
//
// GameWrapper.tsx instantiates this class with an HTMLElement container and
// calls triggerJump() / triggerDuck() based on MoveNet pose data or keyboard
// fallback events. This class must not duplicate any of that input logic.
// ─────────────────────────────────────────────────────────────────────────────
export class DinoGame implements GameInstance {
  private game: Phaser.Game | null = null;
  private gameOverCb: ((score: number) => void) | null = null;

  /**
   * @param container  The HTMLElement div where Phaser mounts its canvas.
   *                   Passed directly by GameWrapper.tsx (containerRef.current).
   */
  constructor(container: HTMLElement) {
    if (typeof window === 'undefined') return;

    // Remove any orphaned <canvas> elements (React StrictMode double-mount
    // in development calls the constructor twice; the first canvas is left
    // behind without this cleanup).
    container.querySelectorAll('canvas').forEach((c) => c.remove());

    // Destroy any existing Phaser instance (extra safety guard)
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      width: C.canvasWidth,   // 1050
      height: C.canvasHeight, // 500
      parent: container,
      backgroundColor: '#111111',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: C.gravity }, // 1 600 px/s²
          debug: false,
        },
      },
      scene: [CalibrationScene, DinoScene],
    });
  }

  // ── Helper: returns DinoScene only when it is the active scene ────────────
  private getActiveScene(): DinoScene | null {
    if (!this.game) return null;
    const scene = this.game.scene.getScene('DinoScene') as DinoScene | null;
    if (!scene?.scene.isActive('DinoScene')) return null;
    return scene;
  }

  // ── GameInstance interface ────────────────────────────────────────────────

  /** Called by GameWrapper when MoveNet detects an upward hip movement. */
  triggerJump(): void {
    this.getActiveScene()?.doJump();
  }

  /** Called by GameWrapper when MoveNet detects a crouching posture. */
  triggerDuck(): void {
    this.getActiveScene()?.doDuck();
  }

  /** Called by GameWrapper when player explicitly stands up without jumping. */
  triggerStandUp(): void {
    this.getActiveScene()?.doStandUp();
  }

  /**
   * Register the game-over callback.
   * The callback is also stored in the Phaser registry so DinoScene can
   * read it from create() without any race condition.
   */
  onGameOver(callback: (score: number) => void): void {
    this.gameOverCb = callback;
    this.game?.registry.set('gameOverCallback', callback);
  }

  pause(): void {
    const scene = this.getActiveScene();
    if (scene) scene.isPaused = true;
  }

  resume(): void {
    const scene = this.getActiveScene();
    if (scene) scene.isPaused = false;
  }

  getScore(): number {
    return this.getActiveScene()?.getScore() ?? 0;
  }

  /** Release all Phaser resources. Called by GameWrapper on component unmount. */
  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }

  /**
   * Switch to a different difficulty/theme and restart the game.
   * Called by the level selector buttons in GameWrapper.tsx.
   */
  restartWithTheme(theme: GameTheme): void {
    setGameTheme(theme);
    if (!this.game) return;
    // Re-register callback so it survives the scene restart
    if (this.gameOverCb) {
      this.game.registry.set('gameOverCallback', this.gameOverCb);
    }
    // Stop all active scenes then restart from CalibrationScene
    const sceneManager = this.game.scene;
    if (sceneManager.isActive('DinoScene')) sceneManager.stop('DinoScene');
    if (sceneManager.isActive('CalibrationScene')) sceneManager.stop('CalibrationScene');
    sceneManager.start('CalibrationScene');
  }
}
