import * as Phaser from 'phaser';
import type { GameInstance } from '@/src/lib/types';

export class IronGame implements GameInstance {
  private phaserGame: Phaser.Game | null = null;
  private gameOverCb: ((score: number) => void) | null = null;

  constructor(containerId: HTMLElement) {
    if (typeof window === 'undefined') return;

    const W = containerId.clientWidth || Math.floor(window.innerWidth * 0.6);
    const H = containerId.clientHeight || window.innerHeight;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS,
      width: W,
      height: H,
      parent: containerId,
      backgroundColor: '#000510',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false }
      },
      scene: [IronScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      callbacks: {
        postBoot: (game: Phaser.Game) => {
          if (this.gameOverCb) {
            (game as any).gymcitoGameOverCallback = this.gameOverCb;
          }
        }
      }
    };
    this.phaserGame = new Phaser.Game(config);
  }

  setTilt(angle: number) {
    if (!this.phaserGame) return;
    const scene = this.phaserGame.scene.getScene('IronScene') as any;
    if (scene) scene.currentTilt = angle;
  }

  onGameOver(callback: (score: number) => void) {
    this.gameOverCb = callback;
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('IronScene') as any;
      if (scene) scene.gameOverCallback = callback;
      (this.phaserGame as any).gymcitoGameOverCallback = callback;
    }
  }

  pause(): void {
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('IronScene');
      if (scene) scene.scene.pause();
    }
  }

  resume(): void {
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('IronScene');
      if (scene) scene.scene.resume();
    }
  }

  getScore(): number {
    if (this.phaserGame) {
      const scene = this.phaserGame.scene.getScene('IronScene') as any;
      if (scene) return scene.score || 0;
    }
    return 0;
  }

  destroy() {
    this.phaserGame?.destroy(true);
    this.phaserGame = null;
  }
}

class IronScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private shipBody!: Phaser.GameObjects.Graphics;
  private asteroids!: Phaser.Physics.Arcade.Group;
  private scoreText!: Phaser.GameObjects.Text;
  public postureText!: Phaser.GameObjects.Text;
  private tiltIndicator!: Phaser.GameObjects.Graphics;
  private bonusText!: Phaser.GameObjects.Text;

  public currentTilt: number = 0;
  public gameOverCallback: ((score: number) => void) | null = null;

  public score: number = 0;
  private isGameOver: boolean = false;
  private asteroidSpeed: number = 180;
  private perfectPostureAccum: number = 0;
  private lastSpeedIncrease: number = 0;
  private shipVelocityX: number = 0;

  private gameTime: number = 0;
  private spawnAccum: number = 0;
  private edgeTimer: number = 0;
  private lastEdgeSide: 'left' | 'right' | null = null;
  private readonly EDGE_THRESHOLD = 80;
  private readonly EDGE_PUNISH_MS = 3000;

  constructor() {
    super({ key: 'IronScene' });
  }

  preload() {
    const asteroidSizes = [56, 36, 84];
    const asteroidColors = [
      { body: '#7a7a7a', crater: '#505050' },
      { body: '#9a9a9a', crater: '#707070' },
      { body: '#5a5a5a', crater: '#353535' },
    ];

    for (let variant = 0; variant < 3; variant++) {
      const key = `asteroid_${variant}`;
      if (this.textures.exists(key)) continue;

      const size = asteroidSizes[variant];
      const colors = asteroidColors[variant];
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const cx = size / 2;
      const cy = size / 2;

      // Forma irregular del asteroide
      const sides = 9;
      const offsets = [1.0, 0.82, 0.95, 0.78, 1.0, 0.85, 0.92, 0.80, 0.96];
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const r = (size / 2 - 4) * offsets[i % sides];
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Sombra exterior
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = colors.body;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Borde oscuro
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cráteres
      const craterCount = variant === 2 ? 4 : 2;
      const craterData = [
        { cx: size * 0.35, cy: size * 0.38, r: size * 0.10 },
        { cx: size * 0.62, cy: size * 0.55, r: size * 0.07 },
        { cx: size * 0.45, cy: size * 0.65, r: size * 0.08 },
        { cx: size * 0.25, cy: size * 0.58, r: size * 0.06 },
      ];
      for (let c = 0; c < craterCount; c++) {
        const cd = craterData[c];
        ctx.beginPath();
        ctx.arc(cd.cx, cd.cy, cd.r, 0, Math.PI * 2);
        ctx.fillStyle = colors.crater;
        ctx.fill();
        // Brillo del cráter
        ctx.beginPath();
        ctx.arc(cd.cx - cd.r * 0.2, cd.cy - cd.r * 0.2, cd.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
      }

      // Highlight general
      ctx.beginPath();
      ctx.ellipse(size * 0.3, size * 0.27, size * 0.12, size * 0.07, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();

      // Registrar textura en Phaser
      this.textures.addCanvas(key, canvas);
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    // Fondo estrellado
    const stars = this.add.graphics();
    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(0, H);
      const r = Math.random() > 0.85 ? 2 : 1;
      stars.fillStyle(0xffffff, 0.3 + Math.random() * 0.7);
      stars.fillCircle(x, y, r);
    }

    // Nave
    this.ship = this.add.container(W / 2, H - 100);
    this.shipBody = this.add.graphics();
    this.drawShip(false);
    this.ship.add(this.shipBody);
    this.physics.add.existing(this.ship);
    const shipBody = this.ship.body as Phaser.Physics.Arcade.Body;
    shipBody.setCollideWorldBounds(true);
    shipBody.setSize(40, 50);

    // Asteroides
    this.asteroids = this.physics.add.group({ enableBody: false } as any);

    // UI
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '24px', color: '#ffffff',
      fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 4
    }).setDepth(10);

    this.postureText = this.add.text(W / 2, 16, '', {
      fontSize: '18px', color: '#00ff88',
      fontFamily: 'monospace'
    }).setOrigin(0.5, 0).setDepth(10);

    this.tiltIndicator = this.add.graphics().setDepth(10);

    this.bonusText = this.add.text(W / 2, H / 2, '', {
      fontSize: '32px', color: '#FFD700',
      fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // Generador de asteroides
    this.time.addEvent({
      delay: 50,
      callback: () => {
        if (this.isGameOver) return;
        // Calcular delay actual según dificultad
        const currentDelay = Math.max(400, 1200 - Math.floor(this.gameTime / 10000) * 100);
        // Usar un acumulador manual
        this.spawnAccum = (this.spawnAccum || 0) + 50;
        if (this.spawnAccum >= currentDelay) {
          this.spawnAccum = 0;
          this.spawnAsteroid();
        }
      },
      loop: true
    });

    // Score por tiempo
    this.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.isGameOver) {
          this.score += 1;
          this.scoreText.setText(`Score: ${this.score}`);
        }
      },
      loop: true
    });

    // Colisión
    this.physics.add.overlap(
      this.ship,
      this.asteroids,
      () => this.handleCollision(),
      undefined,
      this
    );

    // Recuperar callback
    const cb = (this.game as any).gymcitoGameOverCallback;
    if (cb) this.gameOverCallback = cb;

    // Primer asteroide después de 500ms para dar tiempo a cargar
    this.time.delayedCall(500, () => {
      this.spawnAsteroid();
    });
  }

  drawShip(hit: boolean) {
    this.shipBody.clear();
    this.shipBody.fillStyle(hit ? 0xff4444 : 0x4488ff, 1);
    this.shipBody.fillTriangle(0, -28, -22, 22, 22, 22);
    this.shipBody.fillStyle(0xff6600, 1);
    this.shipBody.fillRect(-10, 20, 20, 10);
    this.shipBody.fillStyle(0x88ccff, 0.9);
    this.shipBody.fillCircle(0, -6, 9);
    this.shipBody.fillStyle(0xff9900, 0.4);
    this.shipBody.fillRect(-14, 28, 28, 7);
  }

  spawnAsteroid() {
    if (this.isGameOver) return;
    const W = this.scale.width;
    const x = Phaser.Math.Between(40, W - 40);
    this.spawnAsteroidAt(x, this.asteroidSpeed);
  }

  spawnAsteroidAt(x: number, speed: number) {
    if (this.isGameOver) return;

    const variant = Phaser.Math.Between(0, 2);
    const key = `asteroid_${variant}`;
    if (!this.textures.exists(key)) return;

    const sizes = [56, 36, 84];
    const size = sizes[variant];

    // 1. Crear sprite con física
    const asteroid = this.physics.add.sprite(x, -size - 10, key);
    asteroid.setDepth(5);
    asteroid.setAngle(Phaser.Math.Between(0, 360));
    asteroid.setAngularVelocity(Phaser.Math.Between(-80, 80));

    // 2. Agregar al grupo ANTES de configurar velocidad
    //    (el grupo ya no resetea porque enableBody:false)
    this.asteroids.add(asteroid, false);

    // 3. Configurar body DESPUÉS del add()
    const body = asteroid.body as Phaser.Physics.Arcade.Body;
    body.setSize(size * 0.65, size * 0.65);

    // 35% apunta hacia la nave
    if (Math.random() < 0.35 && this.ship) {
      const dx = this.ship.x - x;
      const dy = this.scale.height + 150;
      const dist = Math.sqrt(dx * dx + dy * dy);
      body.setVelocityX((dx / dist) * speed * 0.6);
      body.setVelocityY((dy / dist) * speed * 1.1);
    } else {
      body.setVelocityX(Phaser.Math.Between(-40, 40));
      body.setVelocityY(speed);
    }
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;

    this.gameTime += delta;

    // Aumentar velocidad cada 15 segundos
    const speedTier = Math.floor(this.gameTime / 15000);
    const timeBonus = speedTier * 20;

    // También aumentar por score
    const scoreBonus = Math.floor(this.score / 60) * 15;

    this.asteroidSpeed = Math.min(500, 180 + timeBonus + scoreBonus);

    const H = this.scale.height;
    const W = this.scale.width;

    // Mover nave con suavizado
    const targetVX = this.currentTilt * 400;
    this.shipVelocityX += (targetVX - this.shipVelocityX) * 0.12;
    const body = this.ship.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.shipVelocityX);
    this.ship.setRotation(this.currentTilt * 0.28);

    const isAtLeft = this.ship.x < this.EDGE_THRESHOLD;
    const isAtRight = this.ship.x > W - this.EDGE_THRESHOLD;

    if (isAtLeft || isAtRight) {
      const side: 'left' | 'right' = isAtLeft ? 'left' : 'right';

      if (this.lastEdgeSide === side) {
        this.edgeTimer += delta;
      } else {
        this.edgeTimer = 0;
        this.lastEdgeSide = side;
      }

      // Advertencia progresiva
      const secondsLeft = Math.ceil((this.EDGE_PUNISH_MS - this.edgeTimer) / 1000);
      if (this.edgeTimer > 500) {
        this.postureText.setText(`⚠️ ¡Sal del borde! ${secondsLeft}s`);
        this.postureText.setColor('#ff4444');
      }

      // Parpadeo de la nave al acercarse al límite
      if (this.edgeTimer > 2000) {
        this.ship.setAlpha(this.ship.alpha === 1 ? 0.4 : 1);
      }

      // Muerte instantánea al llegar a 3 segundos
      if (this.edgeTimer >= this.EDGE_PUNISH_MS) {
        this.handleCollision();
        return;
      }
    } else {
      this.edgeTimer = 0;
      this.lastEdgeSide = null;
      this.ship.setAlpha(1);
      // Restaurar color del postureText si estaba en rojo
      if (this.postureText.style.color === '#ff4444') {
        this.postureText.setColor('#00ff88');
      }
    }

    // Postura perfecta
    if (Math.abs(this.currentTilt) < 0.1) {
      this.perfectPostureAccum += delta;
      if (this.perfectPostureAccum >= 2000) {
        this.score += 50;
        this.perfectPostureAccum = 0;
        this.showBonus('+50 ¡Postura Perfecta! 🏆');
      }
      const p = this.perfectPostureAccum / 2000;
      // Solo sobreescribir si no está en rojo por la advertencia
      if (this.postureText.style.color !== '#ff4444') {
        this.postureText.setText(`⬆️ Postura: ${Math.round(p * 100)}%`);
      }
    } else {
      this.perfectPostureAccum = 0;
      // Solo borrar si no está en rojo por la advertencia
      if (this.postureText.style.color !== '#ff4444') {
        this.postureText.setText('');
      }
    }

    // Indicador de inclinación
    this.drawTiltIndicator();

    // Limpiar asteroides fuera de pantalla
    this.asteroids.getChildren().forEach((obj: any) => {
      if (obj.y > this.scale.height + 100) obj.destroy();
    });
  }

  drawTiltIndicator() {
    const g = this.tiltIndicator;
    const H = this.scale.height;
    g.clear();
    const bx = 28, bH = 140, bY = H / 2 - 70;
    g.fillStyle(0x222222, 0.9);
    g.fillRoundedRect(bx - 10, bY, 20, bH, 10);
    const iY = bY + bH / 2 + this.currentTilt * bH / 2;
    const neutral = Math.abs(this.currentTilt) < 0.1;
    g.fillStyle(neutral ? 0x00ff88 : 0xff6600, 1);
    g.fillCircle(bx, iY, 9);
    g.lineStyle(2, 0x444444, 1);
    g.lineBetween(bx - 12, bY + bH / 2, bx + 12, bY + bH / 2);
  }

  showBonus(text: string) {
    const H = this.scale.height;
    this.bonusText.setText(text);
    this.bonusText.setAlpha(1).setY(H / 2);
    this.tweens.add({
      targets: this.bonusText,
      y: H / 2 - 90, alpha: 0,
      duration: 1800, ease: 'Power2'
    });
  }

  handleCollision() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    const W = this.scale.width;
    const H = this.scale.height;

    this.drawShip(true);
    this.cameras.main.flash(300, 255, 50, 50);
    this.cameras.main.shake(300, 0.02);

    const overlay = this.add.graphics().setDepth(25);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, W, H);

    this.add.text(W / 2, H / 2 - 70, '💥 GAME OVER', {
      fontSize: '42px', color: '#ff4444',
      fontFamily: 'monospace',
      stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setDepth(30);

    this.add.text(W / 2, H / 2, `Score: ${this.score}`, {
      fontSize: '30px', color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(30);

    this.add.text(W / 2, H / 2 + 55, '¡Buen esfuerzo!', {
      fontSize: '20px', color: '#aaaaaa',
      fontFamily: 'monospace'
    }).setOrigin(0.5).setDepth(30);

    this.time.delayedCall(1500, () => {
      if (this.gameOverCallback) this.gameOverCallback(this.score);
    });
  }
}
