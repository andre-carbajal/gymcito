'use client';

import { useState, useEffect } from 'react';
import type { InputMode } from '@/src/lib/types';

interface UseInputModeReturn {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
}

export function useInputMode(): UseInputModeReturn {
  const [inputMode, setInputMode] = useState<InputMode>('mouse');

  // Auto-detect on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    setInputMode(isTouch ? 'touch' : 'mouse');
  }, []);

  return { inputMode, setInputMode };
}
