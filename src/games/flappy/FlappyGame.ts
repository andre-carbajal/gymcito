import * as Phaser from 'phaser';
import {
  COLORS,
  drawMarioPipe,
  spawnClouds,
  drawGround,
  drawBirdGraphics,
  PIPE_BODY_WIDTH,
  type CloudData,
} from './FlappyVisuals';

const GROUND_HEIGHT = 40;

class MainScene extends Phaser.Scene {
  // El pájaro ahora es un Container con gráficos bonitos + un hitbox invisible
  private birdContainer!: Phaser.GameObjects.Container;
  private birdHitbox!: Phaser.GameObjects.Arc & { body: Phaser.Physics.Arcade.Body };

  private pipes!: Phaser.Physics.Arcade.Group;
  private ground!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.StaticBody };
  private scoreText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;

  private clouds: CloudData[] = [];

  private currentScore: number = 0;
  private pipeVelocity: number = -200;
  private pipeEvent?: Phaser.Time.TimerEvent;
  private gameState: 'CALIBRATION' | 'PLAYING' | 'GAMEOVER' = 'CALIBRATION';
  private parentGame!: FlappyGame;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: { parentGame: FlappyGame }) {
    this.parentGame = data.parentGame;
    this.currentScore = 0;
    this.pipeVelocity = -200;
    this.gameState = 'CALIBRATION';
  }

  create() {
    const gameWidth = this.sys.game.config.width as number;
    const gameHeight = this.sys.game.config.height as number;

    // ── Fondo celeste ──
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.sky, 1);
    bg.fillRect(0, 0, gameWidth, gameHeight);

    // ── Nubes flotantes ──
    this.clouds = spawnClouds(this, gameWidth);

    // ── Suelo con pasto ──
    drawGround(this, gameWidth, gameHeight, GROUND_HEIGHT);

    // Hitbox invisible del suelo para colisiones
    this.ground = this.add.rectangle(
      gameWidth / 2, gameHeight - GROUND_HEIGHT / 2,
      gameWidth, GROUND_HEIGHT, 0x000000, 0
    ) as any;
    this.physics.add.existing(this.ground, true);

    // ── Pájaro con diseño ──
    this.birdContainer = drawBirdGraphics(this, gameWidth * 0.2, gameHeight / 2);
    this.birdContainer.setDepth(8);

    // Hitbox circular invisible para colisiones precisas
    this.birdHitbox = this.add.circle(gameWidth * 0.2, gameHeight / 2, 16, 0xff0000, 0) as any;
    this.physics.add.existing(this.birdHitbox);
    this.birdHitbox.body.setGravityY(0);
    this.birdHitbox.body.setCollideWorldBounds(true);
    this.birdHitbox.body.setCircle(16);

    // ── Grupo de tuberías ──
    this.pipes = this.physics.add.group();

    // ── Colisiones ──
    this.physics.add.collider(this.birdHitbox, this.ground, this.handleGameOver, undefined, this);
    this.physics.add.collider(this.birdHitbox, this.pipes, this.handleGameOver, undefined, this);

    // ── Textos ──
    this.scoreText = this.add.text(20, 20, 'Score: 0', {
      fontSize: '32px',
      color: COLORS.textWhite,
      fontStyle: 'bold',
      stroke: COLORS.strokeBlack,
      strokeThickness: 4,
    });
    this.scoreText.setDepth(10);
    this.scoreText.setVisible(false);

    this.countdownText = this.add.text(gameWidth / 2, gameHeight / 2, '3', {
      fontSize: '80px',
      color: COLORS.textWhite,
      fontStyle: 'bold',
      stroke: COLORS.strokeBlack,
      strokeThickness: 6,
    });
    this.countdownText.setOrigin(0.5);
    this.countdownText.setDepth(10);

    this.startCalibration();
  }

  private startCalibration() {
    let count = 3;
    this.time.addEvent({
      delay: 1000,
      repeat: 3,
      callback: () => {
        count--;
        if (count > 0) {
          this.countdownText.setText(count.toString());
        } else if (count === 0) {
          this.countdownText.setText('¡Listo!');
        } else {
          this.countdownText.setVisible(false);
          this.startGame();
        }
      },
    });
  }

  private startGame() {
    this.gameState = 'PLAYING';
    this.birdHitbox.body.setGravityY(600);

    this.flap();
    this.scoreText.setVisible(true);
    this.spawnPipes();

    this.pipeEvent = this.time.addEvent({
      delay: 1800,
      loop: true,
      callback: this.spawnPipes,
      callbackScope: this,
    });
  }

  private spawnPipes() {
    if (this.gameState !== 'PLAYING') return;

    const gameWidth = this.sys.game.config.width as number;
    const gameHeight = this.sys.game.config.height as number;

    const gap = Math.max(150, 280 - Math.floor(this.currentScore / 3) * 10);
    const minHeight = 60;
    const maxHeight = gameHeight - GROUND_HEIGHT - gap - minHeight;
    const topPipeHeight = Phaser.Math.Between(minHeight, maxHeight);

    // ── Tubo superior (estilo Mario) ──
    const topContainer = drawMarioPipe(this, gameWidth + 60, topPipeHeight, 'top', gameHeight, GROUND_HEIGHT);
    topContainer.setDepth(4);

    // Hitbox rectangular invisible para colisiones
    const topHitbox = this.add.rectangle(gameWidth + 60, topPipeHeight / 2, PIPE_BODY_WIDTH, topPipeHeight, 0xff0000, 0) as any;
    this.physics.add.existing(topHitbox);
    this.pipes.add(topHitbox);
    topHitbox.body.setVelocityX(this.pipeVelocity);
    topHitbox.body.setAllowGravity(false);
    topHitbox.body.setImmovable(true);
    topHitbox.setData('passed', false);
    topHitbox.setData('visual', topContainer);

    // ── Tubo inferior (estilo Mario) ──
    const bottomPipeHeight = gameHeight - GROUND_HEIGHT - topPipeHeight - gap;
    const bottomContainer = drawMarioPipe(this, gameWidth + 60, bottomPipeHeight, 'bottom', gameHeight, GROUND_HEIGHT);
    bottomContainer.setDepth(4);

    const bottomY = topPipeHeight + gap + bottomPipeHeight / 2;
    const bottomHitbox = this.add.rectangle(gameWidth + 60, bottomY, PIPE_BODY_WIDTH, bottomPipeHeight, 0xff0000, 0) as any;
    this.physics.add.existing(bottomHitbox);
    this.pipes.add(bottomHitbox);
    bottomHitbox.body.setVelocityX(this.pipeVelocity);
    bottomHitbox.body.setAllowGravity(false);
    bottomHitbox.body.setImmovable(true);
    bottomHitbox.setData('visual', bottomContainer);
  }

  update() {
    if (this.gameState === 'GAMEOVER') return;

    // Sincronizar posición visual del pájaro con su hitbox
    this.birdContainer.setPosition(this.birdHitbox.x, this.birdHitbox.y);

    // Ligera rotación del pájaro según velocidad vertical
    if (this.gameState === 'PLAYING') {
      const vy = this.birdHitbox.body.velocity.y;
      this.birdContainer.setAngle(Phaser.Math.Clamp(vy * 0.1, -30, 60));
    }

    // Mover nubes lentamente
    for (const cloud of this.clouds) {
      cloud.graphics.x -= cloud.speed;
      if (cloud.graphics.x < -120) {
        cloud.graphics.x = (this.sys.game.config.width as number) + 120;
      }
    }

    if (this.gameState !== 'PLAYING') return;

    this.pipes.getChildren().forEach((child) => {
      const pipe = child as Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
      const visual = pipe.getData('visual') as Phaser.GameObjects.Container | undefined;

      // Sincronizar el contenedor visual con el hitbox
      if (visual) {
        visual.x = pipe.x;
      }

      // Puntuación (solo tubos superiores marcados con 'passed')
      if (pipe.getData('passed') === false) {
        if (pipe.x + pipe.width / 2 < this.birdHitbox.x - 16) {
          pipe.setData('passed', true);
          this.currentScore++;
          this.parentGame.score = this.currentScore;
          this.scoreText.setText(`Score: ${this.currentScore}`);

          if (this.currentScore > 0 && this.currentScore % 5 === 0) {
            this.pipeVelocity -= 10;
            this.pipes.getChildren().forEach((p: any) => p.body.setVelocityX(this.pipeVelocity));
          }
        }
      }

      // Limpiar tubos fuera de pantalla
      if (pipe.x < -120) {
        if (visual) visual.destroy();
        pipe.destroy();
      }
    });
  }

  flap() {
    if (this.gameState === 'PLAYING') {
      this.birdHitbox.body.setVelocityY(-350);
    }
  }

  private handleGameOver() {
    if (this.gameState === 'GAMEOVER') return;
    this.gameState = 'GAMEOVER';

    this.birdHitbox.body.setVelocity(0, 0);
    this.birdHitbox.body.setAllowGravity(false);

    this.pipes.getChildren().forEach((p: any) => p.body.setVelocityX(0));

    if (this.pipeEvent) {
      this.pipeEvent.remove();
    }

    const gameWidth = this.sys.game.config.width as number;
    const gameHeight = this.sys.game.config.height as number;

    this.add.text(gameWidth / 2, gameHeight / 2 - 40, 'GAME OVER', {
      fontSize: '64px',
      color: COLORS.textRed,
      fontStyle: 'bold',
      stroke: COLORS.strokeBlack,
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(gameWidth / 2, gameHeight / 2 + 30, `Score: ${this.currentScore}`, {
      fontSize: '40px',
      color: COLORS.textWhite,
      fontStyle: 'bold',
      stroke: COLORS.strokeBlack,
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.parentGame.triggerGameOver(this.currentScore);
  }
}

export class FlappyGame {
  private game: Phaser.Game | null = null;
  private gameOverCallback: ((score: number) => void) | null = null;
  public score: number = 0;
  
  // Registro global para matar instancias zombies si React re-renderiza antes de terminar de cargar
  private static activeInstance: FlappyGame | null = null;

  constructor(containerElement: string | HTMLElement) {
    // 1. Destruimos cualquier instancia previa agresivamente
    if (FlappyGame.activeInstance) {
      FlappyGame.activeInstance.destroy();
    }
    FlappyGame.activeInstance = this;

    // 2. Extraemos el contenedor HTML (React pasa un HTMLElement, no un string)
    const container = typeof containerElement === 'string' 
      ? document.getElementById(containerElement) 
      : containerElement;

    // 3. Limpieza profunda del DOM
    if (container) {
      const canvases = container.getElementsByTagName('canvas');
      while (canvases.length > 0) {
        canvases[0].parentNode?.removeChild(canvases[0]);
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.CANVAS, // Solo canvas, como fue requerido
      parent: containerElement,
      width: 800,
      height: 600,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 }, // La gravedad se aplica a nivel body cuando comience el juego
          debug: false
        }
      },
      // Excluimos la carga de la escena en la config para que Phaser arranque en blanco
    };

    this.game = new Phaser.Game(config);

    // Inyectamos la clase (no instancia) y pasamos 'this' a través del método init() de forma asíncrona segura
    this.game.scene.add('MainScene', MainScene, true, { parentGame: this });
  }

  getScore(): number {
    return this.score;
  }

  triggerFlap() {
    if (!this.game) return;
    const scene = this.game.scene.getScene('MainScene') as MainScene;
    if (scene) {
      scene.flap();
    }
  }

  onGameOver(callback: (score: number) => void) {
    this.gameOverCallback = callback;
  }

  triggerGameOver(finalScore: number) {
    if (this.gameOverCallback) {
      this.gameOverCallback(finalScore);
    }
  }

  pause() {
    this.game?.scene.getScene('MainScene')?.scene.pause();
  }

  resume() {
    this.game?.scene.getScene('MainScene')?.scene.resume();
  }

  destroy() {
    this.game?.destroy(true);
    if (FlappyGame.activeInstance === this) {
      FlappyGame.activeInstance = null;
    }
  }
}
