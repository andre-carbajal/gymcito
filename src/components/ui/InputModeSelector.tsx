'use client';

import type { InputMode } from '@/src/lib/types';
import { Camera, Mouse, Smartphone } from 'lucide-react';

interface InputModeSelectorProps {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
}

const modes: { id: InputMode; label: string; icon: typeof Camera; emoji: string }[] = [
  { id: 'camera', label: 'Cámara', icon: Camera, emoji: '📷' },
  { id: 'touch', label: 'Touch', icon: Smartphone, emoji: '👆' },
  { id: 'mouse', label: 'Mouse', icon: Mouse, emoji: '🖱️' },
];

export function InputModeSelector({ inputMode, setInputMode }: InputModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {modes.map(({ id, label, icon: Icon }) => {
        const isActive = inputMode === id;
        return (
          <button
            key={id}
            id={`input-mode-${id}`}
            onClick={() => setInputMode(id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-300 cursor-pointer border
              ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white border-purple-400/50 shadow-lg shadow-purple-500/25 scale-105'
                  : 'bg-[#1a1a2e] text-gray-400 border-[#2a2a4a] hover:text-white hover:border-purple-500/30 hover:bg-[#252547]'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
