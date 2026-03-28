'use client';

import { useState, useEffect } from 'react';
import type { InputMode } from '@/src/lib/types';

interface UseInputModeReturn {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
}

export function useInputMode(): UseInputModeReturn {
  const [inputMode, setInputMode] = useState<InputMode>('camera');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gymcito_input_mode') as InputMode;
      if (saved) setInputMode(saved);
    }
  }, []);

  const setAndSaveInputMode = (mode: InputMode) => {
    setInputMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gymcito_input_mode', mode);
    }
  };

  return { inputMode, setInputMode: setAndSaveInputMode };
}
