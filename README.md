# 🎮 Gymcito

Plataforma web con **3 minijuegos controlados por cámara** usando detección de postura corporal (MoveNet). También soporta control por touch y mouse.

## 🕹️ Juegos

| Juego | Descripción | Control Cámara |
|-------|-------------|----------------|
| 🐦 **Flappy Bird** | Salta entre tubos sin tocar nada | Levanta las manos |
| 🦖 **Dino Runner** | Salta y agáchate para esquivar obstáculos | Brazos arriba / Agáchate |
| 🏄 **Iron Board** | Inclínate para esquivar obstáculos en la tabla | Inclina los hombros |

## 🛠️ Stack Tecnológico

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (Auth + Postgres + Realtime)
- **TensorFlow.js** + MoveNet (SINGLEPOSE_LIGHTNING)
- **Phaser 3** para los juegos
- **lucide-react** para iconos

## 🚀 Setup

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/gymcito.git
cd gymcito
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 3. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve al **SQL Editor** y ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`
3. En **Authentication > Settings**, habilita el proveedor de Email
4. En **Database > Replication**, asegúrate de que la tabla `scores` tenga Realtime habilitado

### 4. Instalar dependencias

```bash
pnpm install
```

### 5. Ejecutar en desarrollo

```bash
pnpm dev
```

Visita [http://localhost:3000](http://localhost:3000)

## 👥 Asignación de Desarrollo

| Dev | Área | Archivos |
|-----|------|----------|
| **Dev 1** | AI + Lib + App | `src/ai/*`, `src/lib/*`, `src/hooks/*`, `app/*` |
| **Dev 2** | Flappy Bird | `src/games/flappy/*`, ajustes en `GameWrapper` |
| **Dev 3** | Dino Runner | `src/games/dino/*`, ajustes en `GameWrapper` |
| **Dev 4** | Iron Board + UI | `src/games/ironboard/*`, `src/components/ui/*` |

## 📁 Estructura del Proyecto

```
gymcito/
├── app/                          # Rutas Next.js (App Router)
│   ├── layout.tsx                # Layout raíz
│   ├── page.tsx                  # Página principal (menú)
│   ├── globals.css               # Estilos globales
│   └── game/
│       └── [slug]/
│           └── page.tsx          # Página de juego dinámica
├── src/
│   ├── ai/
│   │   └── usePoseDetection.ts   # Hook de detección de pose (MoveNet)
│   ├── hooks/
│   │   ├── useCamera.ts          # Hook de cámara
│   │   └── useInputMode.ts       # Hook de modo de input
│   ├── lib/
│   │   ├── supabase.ts           # Cliente Supabase + helpers
│   │   └── types.ts              # Tipos TypeScript
│   ├── components/
│   │   ├── game/
│   │   │   └── GameWrapper.tsx   # Wrapper de juegos con input bridging
│   │   └── ui/
│   │       ├── AuthModal.tsx     # Modal de login/registro
│   │       ├── InputModeSelector.tsx # Selector de modo de input
│   │       └── Leaderboard.tsx   # Leaderboard en tiempo real
│   └── games/
│       ├── flappy/
│       │   └── FlappyGame.ts     # Motor Flappy Bird (Phaser 3)
│       ├── dino/
│       │   └── DinoGame.ts       # Motor Dino Runner (Phaser 3)
│       └── ironboard/
│           └── IronGame.ts       # Motor Iron Board (Phaser 3)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Schema de base de datos
├── .env.example
├── package.json
└── README.md
```

## 🎯 Modos de Input

| Modo | Descripción |
|------|-------------|
| 📷 **Cámara** | Detección de postura con MoveNet |
| 👆 **Touch** | Gestos táctiles en móvil |
| 🖱️ **Mouse** | Click y teclado en escritorio |

## 📄 Licencia

MIT
