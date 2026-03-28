import type { Metadata } from 'next';
import { Geist, Geist_Mono, Press_Start_2P } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const pressStart = Press_Start_2P({
  variable: '--font-press-start',
  weight: '400',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Gymcito – Minijuegos con Cámara',
  description:
    'Plataforma de minijuegos controlados por cámara usando detección de postura corporal. Flappy Bird, Dino Runner e Iron Board.',
  keywords: ['juegos', 'cámara', 'pose detection', 'MoveNet', 'fitness', 'gaming'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a12]">{children}</body>
    </html>
  );
}
