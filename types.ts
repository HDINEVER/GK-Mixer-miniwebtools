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

// HSB (Hue, Saturation, Brightness) - 与 PS 取色器一致
// H: 色相 0-360°, S: 饱和度 0-100%, B: 明度 0-100%
export interface HSB {
  h: number; // 0-360
  s: number; // 0-100
  b: number; // 0-100
}

// LAB (CIE L*a*b*) - 感知均匀色彩空间
// L: 明度 0-100, a: 绿-红轴 -128~127, b: 蓝-黄轴 -128~127
export interface LAB {
  l: number; // 0-100
  a: number; // -128~127
  b: number; // -128~127
}

export interface ColorData {
  id: string;
  hex: string;
  rgb: RGB;
  cmyk: CMYK;
  hsb: HSB;   // 新增：HSB 色彩空间
  lab: LAB;   // 新增：LAB 色彩空间
  source: 'auto' | 'manual';
  colorSpace?: ColorSpace;
}

export type PaintType = 'hobby' | 'ral' | 'pantone';

export interface PaintBrand {
  id: string;
  brand: 'Mr.Hobby' | 'Gaia' | 'Jumpwind' | 'Gunze';
  code: string;
  name: string;
  hex: string;
  type?: PaintType; // 漆料类型标识
}

// RAL 工业标准色卡
export interface RALColor {
  ral: number;        // RAL 编号 (如 3009)
  name: string;       // 颜色名称
  lrv: number;        // Light Reflectance Value (反光值)
  hex: string;        // 对应的 Hex 值
  rgb: RGB;           // RGB 值
  type: 'ral';        // 类型标识
}

export interface MixRecipe {
  baseColor: ColorData;
  cmykRatio: string;
  aiSuggestion: string;
  nearestPaints: PaintBrand[];
  ralMatch?: RALColor; // RAL 标准色匹配结果
}

export enum AppMode {
  ANALYZE = 'ANALYZE'
}

export type Language = 'en' | 'zh' | 'ja';
export type Theme = 'light' | 'dark';
export type ColorSpace = 'srgb' | 'display-p3' | 'adobe-rgb';