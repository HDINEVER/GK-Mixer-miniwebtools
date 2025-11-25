export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface CMYK {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface ColorData {
  id: string;
  hex: string;
  rgb: RGB;
  cmyk: CMYK;
  source: 'auto' | 'manual';
}

export interface PaintBrand {
  id: string;
  brand: 'Mr.Hobby' | 'Gaia' | 'Jumpwind';
  code: string;
  name: string;
  hex: string;
}

export interface MixRecipe {
  baseColor: ColorData;
  cmykRatio: string;
  aiSuggestion: string;
  nearestPaints: PaintBrand[];
}

export enum AppMode {
  ANALYZE = 'ANALYZE'
}

export type Language = 'en' | 'zh' | 'ja';
export type Theme = 'light' | 'dark';