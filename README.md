# 🎮 Gymcito

> **Proyecto desarrollado para el hackathon [Road to Build with AI - Tacna 2026](https://gdg.community.dev/events/details/google-gdg-tacna-presents-road-to-build-with-ai-tacna-2026/), organizado por [GDG Tacna](https://gdg.community.dev/gdg-tacna/).**

Plataforma web con **3 minijuegos controlados por cámara** usando detección de postura corporal (MoveNet). También soporta control por touch y mouse.

🚀 **[Prueba el Demo en Vivo](https://gymcito.vercel.app/)**

---

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
git clone https://github.com/andre-carbajal/gymcito.git
cd gymcito
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales de Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=c
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
OPENAI_API_KEY=tu-api-key
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
├── app
│   ├── api
│   │   └── coach
│   │       └── route.ts
│   ├── game
│   │   └── [slug]
│   │       └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── src
│   ├── ai
│   │   └── usePoseDetection.ts
│   ├── components
│   │   ├── game
│   │   │   └── GameWrapper.tsx
│   │   └── ui
│   │       ├── AuthModal.tsx
│   │       ├── FriendScoreComparison.tsx
│   │       ├── FriendsPanel.tsx
│   │       ├── GameCard.tsx
│   │       ├── GameCard3D.tsx
│   │       ├── HandCursor.tsx
│   │       ├── InputModeSelector.tsx
│   │       └── Leaderboard.tsx
│   ├── games
│   │   ├── dino
│   │   │   ├── DinoConfig.ts
│   │   │   └── DinoGame.ts
│   │   ├── flappy
│   │   │   ├── FlappyGame.ts
│   │   │   └── FlappyVisuals.ts
│   │   └── ironboard
│   │       └── IronGame.ts
│   ├── hooks
│   │   ├── useCamera.ts
│   │   └── useInputMode.ts
│   └── lib
│       ├── coach.ts
│       ├── mediapipe-stub.js
│       ├── supabase.ts
│       └── types.ts
├── supabase
│   └── migrations
│       ├── 001_initial_schema.sql
│       └── 002_friends_schema.sql
├── .gitignore
├── README.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── tsconfig.json
└── typescript_errors.txt
```
