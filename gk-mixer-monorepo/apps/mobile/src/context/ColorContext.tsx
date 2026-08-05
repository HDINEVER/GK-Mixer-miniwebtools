import React, { createContext, useCallback, useContext, useState } from 'react';
import type { ColorData } from '@gk-mixer/core';

interface ColorContextValue {
  targetColor: ColorData | null;
  setTargetColor: (c: ColorData | null) => void;
}

const ColorContext = createContext<ColorContextValue>({
  targetColor: null,
  setTargetColor: () => {},
});

export function ColorProvider({ children }: { children: React.ReactNode }) {
  const [targetColor, setTargetColor] = useState<ColorData | null>(null);
  return (
    <ColorContext.Provider value={{ targetColor, setTargetColor }}>
      {children}
    </ColorContext.Provider>
  );
}

export function useTargetColor() {
  return useContext(ColorContext);
}
