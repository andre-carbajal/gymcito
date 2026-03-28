import * as Phaser from 'phaser';

// ─── Colores ────────────────────────────────────────────────────────
export const COLORS = {
  // Cielo
  sky: 0x87ceeb,

  // Tubos estilo Mario
  pipeBody: 0x2ecc71,
  pipeDark: 0x1a9c54,
  pipeLight: 0x5dde9e,
  pipeLip: 0x27ae60,
  pipeLipDark: 0x1e8449,
  pipeLipLight: 0x6eed9e,
  pipeOutline: 0x145a32,

  // Suelo
  groundTop: 0x5dbb3c,
  groundBody: 0x8b6914,
  groundDark: 0x6b4f10,

  // Pájaro
  birdBody: 0xffd700,
  birdBelly: 0xffe766,
  birdEye: 0xffffff,
  birdPupil: 0x222222,
  birdBeak: 0xff6b35,
  birdWing: 0xf0c000,

  // Nubes
  cloud: 0xffffff,
  cloudShadow: 0xe8e8e8,

  // UI
  textWhite: '#ffffff',
  textRed: '#ff0000',
  strokeBlack: '#000000',
};

// ─── Tubo estilo Mario ─────────────────────────────────────────────
const PIPE_WIDTH = 80;
const LIP_WIDTH = 96;
const LIP_HEIGHT = 30;

/**
 * Dibuja un tubo estilo Mario Bros usando Graphics.
 * Retorna el container para poder moverlo con físicas.
 */
export function drawMarioPipe(
  scene: Phaser.Scene,
  x: number,
  pipeHeight: number,
  direction: 'top' | 'bottom',
  gameHeight: number,
  groundHeight: number,
): Phaser.GameObjects.Container {
  const gfx = scene.add.graphics();
  const lipX = -(LIP_WIDTH / 2);
  const bodyX = -(PIPE_WIDTH / 2);

  if (direction === 'top') {
    // ── Cuerpo del tubo ──
    // Relleno principal
    gfx.fillStyle(COLORS.pipeBody, 1);
    gfx.fillRect(bodyX, 0, PIPE_WIDTH, pipeHeight - LIP_HEIGHT);

    // Sombra izquierda
    gfx.fillStyle(COLORS.pipeDark, 1);
    gfx.fillRect(bodyX, 0, 8, pipeHeight - LIP_HEIGHT);

    // Brillo derecho
    gfx.fillStyle(COLORS.pipeLight, 1);
    gfx.fillRect(bodyX + PIPE_WIDTH - 12, 0, 12, pipeHeight - LIP_HEIGHT);

    // Reflejo central
    gfx.fillStyle(COLORS.pipeLight, 0.3);
    gfx.fillRect(bodyX + 20, 0, 10, pipeHeight - LIP_HEIGHT);

    // ── Labio (boca del tubo, abajo) ──
    gfx.fillStyle(COLORS.pipeLip, 1);
    gfx.fillRect(lipX, pipeHeight - LIP_HEIGHT, LIP_WIDTH, LIP_HEIGHT);

    // Sombra labio
    gfx.fillStyle(COLORS.pipeLipDark, 1);
    gfx.fillRect(lipX, pipeHeight - LIP_HEIGHT, 8, LIP_HEIGHT);

    // Brillo labio
    gfx.fillStyle(COLORS.pipeLipLight, 1);
    gfx.fillRect(lipX + LIP_WIDTH - 12, pipeHeight - LIP_HEIGHT, 12, LIP_HEIGHT);

    // Borde superior del labio
    gfx.fillStyle(COLORS.pipeOutline, 1);
    gfx.fillRect(lipX, pipeHeight - LIP_HEIGHT, LIP_WIDTH, 3);
    // Borde inferior del labio
    gfx.fillRect(lipX, pipeHeight - 3, LIP_WIDTH, 3);

    // Contorno del cuerpo
    gfx.lineStyle(2, COLORS.pipeOutline, 1);
    gfx.strokeRect(bodyX, 0, PIPE_WIDTH, pipeHeight - LIP_HEIGHT);

    const container = scene.add.container(x, 0, [gfx]);
    return container;

  } else {
    // ── Tubo inferior ──
    const startY = 0;
    const bodyHeight = pipeHeight - LIP_HEIGHT;

    // ── Labio (boca del tubo, arriba) ──
    gfx.fillStyle(COLORS.pipeLip, 1);
    gfx.fillRect(lipX, startY, LIP_WIDTH, LIP_HEIGHT);

    gfx.fillStyle(COLORS.pipeLipDark, 1);
    gfx.fillRect(lipX, startY, 8, LIP_HEIGHT);

    gfx.fillStyle(COLORS.pipeLipLight, 1);
    gfx.fillRect(lipX + LIP_WIDTH - 12, startY, 12, LIP_HEIGHT);

    // Bordes del labio
    gfx.fillStyle(COLORS.pipeOutline, 1);
    gfx.fillRect(lipX, startY, LIP_WIDTH, 3);
    gfx.fillRect(lipX, startY + LIP_HEIGHT - 3, LIP_WIDTH, 3);

    // ── Cuerpo ──
    gfx.fillStyle(COLORS.pipeBody, 1);
    gfx.fillRect(bodyX, LIP_HEIGHT, PIPE_WIDTH, bodyHeight);

    gfx.fillStyle(COLORS.pipeDark, 1);
    gfx.fillRect(bodyX, LIP_HEIGHT, 8, bodyHeight);

    gfx.fillStyle(COLORS.pipeLight, 1);
    gfx.fillRect(bodyX + PIPE_WIDTH - 12, LIP_HEIGHT, 12, bodyHeight);

    gfx.fillStyle(COLORS.pipeLight, 0.3);
    gfx.fillRect(bodyX + 20, LIP_HEIGHT, 10, bodyHeight);

    gfx.lineStyle(2, COLORS.pipeOutline, 1);
    gfx.strokeRect(bodyX, LIP_HEIGHT, PIPE_WIDTH, bodyHeight);

    const yPos = gameHeight - groundHeight - pipeHeight;
    const container = scene.add.container(x, yPos, [gfx]);
    return container;
  }
}

// ─── Nubes ──────────────────────────────────────────────────────────
export interface CloudData {
  graphics: Phaser.GameObjects.Graphics;
  speed: number;
  baseY: number;
}

export function createCloud(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale: number,
): CloudData {
  const gfx = scene.add.graphics();
  gfx.setDepth(1);

  // Sombra
  gfx.fillStyle(COLORS.cloudShadow, 0.6);
  gfx.fillEllipse(x + 2, y + 4, 80 * scale, 30 * scale);
  gfx.fillEllipse(x - 25 * scale + 2, y + 6 * scale + 4, 50 * scale, 22 * scale);
  gfx.fillEllipse(x + 25 * scale + 2, y + 6 * scale + 4, 50 * scale, 22 * scale);

  // Nube principal
  gfx.fillStyle(COLORS.cloud, 0.9);
  gfx.fillEllipse(x, y, 80 * scale, 30 * scale);
  gfx.fillEllipse(x - 25 * scale, y + 6 * scale, 50 * scale, 22 * scale);
  gfx.fillEllipse(x + 25 * scale, y + 6 * scale, 50 * scale, 22 * scale);
  gfx.fillEllipse(x - 10 * scale, y - 8 * scale, 40 * scale, 20 * scale);
  gfx.fillEllipse(x + 15 * scale, y - 5 * scale, 35 * scale, 18 * scale);

  const speed = 0.15 + Math.random() * 0.3;

  return { graphics: gfx, speed, baseY: y };
}

export function spawnClouds(scene: Phaser.Scene, gameWidth: number): CloudData[] {
  const clouds: CloudData[] = [];
  const positions = [
    { x: 100, y: 60, s: 1.2 },
    { x: 350, y: 100, s: 0.8 },
    { x: 600, y: 45, s: 1.0 },
    { x: 200, y: 150, s: 0.6 },
    { x: 700, y: 130, s: 0.9 },
    { x: 450, y: 70, s: 0.7 },
  ];

  for (const pos of positions) {
    clouds.push(createCloud(scene, pos.x, pos.y, pos.s));
  }

  return clouds;
}

// ─── Suelo con pasto ────────────────────────────────────────────────
export function drawGround(
  scene: Phaser.Scene,
  gameWidth: number,
  gameHeight: number,
  groundHeight: number,
): void {
  const gfx = scene.add.graphics();
  gfx.setDepth(5);

  const groundY = gameHeight - groundHeight;

  // Capa de tierra
  gfx.fillStyle(COLORS.groundBody, 1);
  gfx.fillRect(0, groundY, gameWidth, groundHeight);

  // Línea oscura inferior
  gfx.fillStyle(COLORS.groundDark, 1);
  gfx.fillRect(0, gameHeight - 6, gameWidth, 6);

  // Franja de pasto
  gfx.fillStyle(COLORS.groundTop, 1);
  gfx.fillRect(0, groundY, gameWidth, 10);

  // Borde de pasto con picos
  gfx.fillStyle(0x4ca832, 1);
  for (let i = 0; i < gameWidth; i += 12) {
    gfx.fillTriangle(
      i, groundY,
      i + 6, groundY - 6,
      i + 12, groundY,
    );
  }
}

// ─── Pájaro con diseño ─────────────────────────────────────────────
export function drawBirdGraphics(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Container {
  const gfx = scene.add.graphics();

  // Cuerpo
  gfx.fillStyle(COLORS.birdBody, 1);
  gfx.fillCircle(0, 0, 18);

  // Barriga
  gfx.fillStyle(COLORS.birdBelly, 1);
  gfx.fillCircle(3, 4, 12);

  // Ala
  gfx.fillStyle(COLORS.birdWing, 1);
  gfx.fillEllipse(-8, -2, 18, 10);

  // Ojo (blanco)
  gfx.fillStyle(COLORS.birdEye, 1);
  gfx.fillCircle(8, -6, 7);

  // Pupila
  gfx.fillStyle(COLORS.birdPupil, 1);
  gfx.fillCircle(10, -6, 3.5);

  // Pico
  gfx.fillStyle(COLORS.birdBeak, 1);
  gfx.fillTriangle(16, -2, 28, 2, 16, 6);

  // Contorno
  gfx.lineStyle(2, 0x997a00, 1);
  gfx.strokeCircle(0, 0, 18);

  const container = scene.add.container(x, y, [gfx]);
  return container;
}

// Constantes reexportadas para uso en FlappyGame
export const PIPE_BODY_WIDTH = PIPE_WIDTH;
export const PIPE_LIP_W = LIP_WIDTH;
