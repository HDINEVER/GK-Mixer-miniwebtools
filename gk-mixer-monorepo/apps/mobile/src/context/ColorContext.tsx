import React, { createContext, useCallback, useContext, useState } from 'react';
import type { ColorData } from '@gk-mixer/core';

interface ColorContextValue {
  targetColor: ColorData | null;
  setTargetColor: (c: ColorData | null) => void;
  extractedColors: ColorData[];
  setExtractedColors: (c: ColorData[]) => void;
}

const ColorContext = createContext<ColorContextValue>({
  targetColor: null,
  setTargetColor: () => {},
  extractedColors: [],
  setExtractedColors: () => {},
});

export function ColorProvider({ children }: { children: React.ReactNode }) {
  const [targetColor, setTargetColor] = useState<ColorData | null>(null);
  const [extractedColors, setExtractedColors] = useState<ColorData[]>([]);
  return (
    <ColorContext.Provider value={{ targetColor, setTargetColor, extractedColors, setExtractedColors }}>
      {children}
    </ColorContext.Provider>
  );
}

export function useTargetColor() {
  return useContext(ColorContext);
}
