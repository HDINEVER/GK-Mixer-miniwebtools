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

export interface HSL {
  h: number;
  s: number;
  l: number;
}

// HSB (Hue, Saturation, Brightness) - 与 PS 取色器一致
export interface HSB {
  h: number; // 0-360
  s: number; // 0-100
  b: number; // 0-100
}

// LAB (CIE L*a*b*) - 感知均匀色彩空间
export interface LAB {
  l: number; // 0-100
  a: number; // -128~127
  b: number; // -128~127
}

export type TonalRole = 'highlight' | 'base' | 'shadow';

export interface TonalStep {
  id: string;
  hex: string;
  label: string;
  role?: TonalRole;
}

export interface ColorData {
  id: string;
  hex: string;
  rgb: RGB;
  cmyk: CMYK;
  hsb: HSB;
  lab: LAB;
  hsl?: HSL;
  name?: string;
  dominance?: number;
  source: 'auto' | 'manual';
  colorSpace?: ColorSpace;
  sampleX?: number;
  sampleY?: number;
  labelNx?: number;
  labelNy?: number;
  labelScale?: number;
  assignedPaint?: CatalogPaint;
  tonalGradient?: TonalStep[];
}

export type PaintType = 'hobby' | 'ral' | 'pantone';

export interface PaintBrand {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
  type?: PaintType;
}

export type PaintFinish =
  | 'standard'
  | 'gloss'
  | 'semi_gloss'
  | 'matte'
  | 'metallic'
  | 'pearl'
  | 'clear'
  | 'fluorescent'
  | 'primer'
  | 'additive'
  | 'wash'
  | 'ink'
  | 'other'
  | string;

export interface CatalogPaint {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
  set: string;
  finish: string;
  source?: string;
  approx?: boolean;
  lab: [number, number, number] | number[];
}

export interface PaintMatch {
  paint: CatalogPaint;
  deltaE: number;
}

export interface PaintBrandGroup {
  brand: string;
  matches: PaintMatch[];
}

// RAL 工业标准色卡
export interface RALColor {
  ral: number;
  name: string;
  lrv: number;
  hex: string;
  rgb: RGB;
  type: 'ral';
}

export interface MixRecipe {
  baseColor: ColorData;
  cmykRatio: string;
  aiSuggestion: string;
  nearestPaints: PaintBrand[];
  ralMatch?: RALColor;
}

export enum AppMode {
  ANALYZE = 'ANALYZE',
}

export type Language = 'en' | 'zh' | 'ja';
export type Theme = 'light' | 'dark';
export type ColorSpace = 'srgb' | 'display-p3' | 'adobe-rgb';

export type MixingMode = 'mixbox' | 'professional';

export interface SliderState {
  id: string;
  color: string;
  angle: number;
  position: number;
  weight: number;
  scale: number;
}

export interface BaseColor {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
}

export interface MixerResultCache {
  mixingMode: MixingMode;
  bottleVolume: number;
}

export interface RadialMixerCache {
  sliders: SliderState[];
  cmyAdded: boolean;
  bwAdded: boolean;
  targetVolume: number;
}

export interface BasicMixerCache {
  baseColors: BaseColor[];
  mixRatios: number[];
  totalVolume: number;
}

// ==========================================
// Tab 3 涂装工程与色卡收纳核心数据模型 (与 iOS ProjectModels.swift 1:1 同步)
// ==========================================

export interface PaintingStep {
  id: string;
  iconName: string; // e.g. 'Stack', 'PaintBrushBroad', 'Sparkle', 'ShieldCheck', 'Drop', 'Wind'
  actionText: string; // e.g. '水补土打底', '主色平喷', '高光提亮', '阴影预置', '消光封层'
  actionCode?: string; // e.g. 'bp', 'sd'
  paintID?: string; // e.g. 'Gaia 071'
  ratioAndPressure?: string; // e.g. '1:2.0 | 1.2bar/18psi | 薄喷 2 遍 | 0.3mm'
  nozzle?: string; // e.g. '0.3mm'
}

export interface FloatingSwatchNode {
  id: string;
  anchorX: number; // 0-1 normalized pin X
  anchorY: number; // 0-1 normalized pin Y
  offsetX: number; // 0-1 normalized card top-left X
  offsetY: number; // 0-1 normalized card top-left Y
  paintBrand: string;
  paintCode: string;
  paintName: string;
  hex: string;
  basePaintHex?: string; // Original commercial bottle paint HEX when fine-tuned
  tintBadgeText?: string; // Compact drop-in modifier formula badge (e.g. "NDL033 (90%) + 白 (10%) · [+9%L 提亮]")
  mixRatio?: string;
  lightness?: number;
  chroma?: number;
  tonalGradient?: TonalStep[];
  labelScale?: number;
}

export interface PartCanvas {
  id: string;
  partName: string;
  sourceImageDataUrl: string; // Clean un-annotated source image data URL
  nodes: FloatingSwatchNode[];
  steps: PaintingStep[];
  createdAt: number;
}

export interface PaintProject {
  id: string;
  title: string;
  coverImageDataUrl?: string;
  customCoverImageDataUrl?: string;
  createdAt: number;
  updatedAt: number;
  categoryId?: string | null;
  parts: PartCanvas[];
}

export interface PaletteCategory {
  id: string;
  name: string;
  createdAt: number;
}

export interface SavedColor {
  id: string;
  hex: string;
  name: string;
  categoryId?: string | null;
  createdAt: number;
  brand?: string;
  code?: string;
}

// ==========================================
// 跨端二维码名片 (gkm1:) & 工程归档 (.gkmix v2) 协议模型
// ==========================================

export interface QRNode {
  c: string; // Hex without '#'
  pid?: string; // Paint code
  b?: string; // Brand
  pos: number[]; // [anchorX, anchorY, offsetX, offsetY] rounded to 3 decimals
  st?: number; // Tonal steps count
}

export interface QRStep {
  a: string; // 2字符基底动作短码 (如 "bp", "sd")，或兼容历史文本名称 (如 "主色平喷")
  cn?: string; // 可选：自定义工序名称 (Custom Name，!= defaultName 时赋值)
  pid?: string; // 可选：关联油漆唯一色号/ID
  nz?: string; // 可选：喷笔口径 (如 "0.3mm", "0.5mm")
  rp?: string; // 可选：稀释比例 (如 "1:2.0")
  mp?: string; // 可选：喷涂气压 (如 "1.2bar/18psi")
  mt?: string; // 可选：手法/备注说明 (自定义手法时赋值)
  i?: string; // 可选：图标名称
}

export interface QRSharePayload {
  t: string; // Project title
  p: string; // Part name
  r?: number[]; // [x, y, w, h] normalized crop rect in poster (default [0, 0, 1, 0.58])
  n: QRNode[];
  s: QRStep[];
}

export interface GKMixArchivePart {
  partName: string;
  cleanSourceImageData: string; // Base64 encoded JPEG/PNG bytes
  nodes: QRNode[];
  steps: QRStep[];
}

export interface GKMixArchivePayload {
  version: number; // 2
  projectTitle: string;
  createdAt: number;
  parts: GKMixArchivePart[];
  customCoverData?: string; // Base64 encoded JPEG/PNG bytes (optional)
}
