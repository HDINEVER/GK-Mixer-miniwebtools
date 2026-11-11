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

export type PigmentRole = 'base' | 'primary' | 'cmy' | 'secondary';

export interface PaintBrand {
  id: string;
  brand: string;
  code: string;
  displayCode?: string;
  name: string;
  hex: string;
  type?: PaintType;
  role?: PigmentRole;
  roleLabel?: string;
  propertyLabel?: string;
  isSecondary?: boolean;
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
  useSecondaryColors?: boolean;
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

/** 模拟试色台可回溯工程快照（随涂装库零件持久化，用于「继续编辑模拟上色」） */
export interface StudioSessionRegionSnapshot {
  id: number;
  baseHex: string;
  shadeHex: string;
  highlightHex: string;
  baseLum: number;
  paintName?: string;
  paintBrand?: string;
  paintCode?: string;
  /** 已涂装像素索引的游程编码 (base64) */
  pixelsRle: string;
}

export interface StudioSessionStagedSwatch {
  hex: string;
  brand: string;
  code: string;
  name: string;
  pinned?: boolean;
}

export interface StudioSessionSnapshot {
  version: 1;
  /** 原始未上色的模型拍摄图 / 线稿底图（工作分辨率） */
  rawSourceImageDataUrl: string;
  /** 当前已上色合成后的预览图（可选缓存） */
  compositedPreviewDataUrl?: string;
  workWidth: number;
  workHeight: number;
  shadingMode: 'four-layer' | 'intrinsic' | 'flat';
  scenePreset: string;
  extractionMode: 'xdog' | 'threshold';
  algorithmParams: {
    lineThreshold: number;
    lineSoftness: number;
    filterRedStamp: boolean;
    xdogSigma: number;
    xdogP: number;
    xdogEpsilon: number;
    xdogPhi: number;
    xdogInkFill: boolean;
    useCannyBarrier: boolean;
    cannyLow: number;
    cannyHigh: number;
    gapCloseRadius: number;
    fillTolerance: number;
    localStepThreshold: number;
    edgeAbsorb: number;
    lineOpacity: number;
    paperBgStyle: 'source' | 'white';
  };
  /** 已涂装区域（哪些地方涂了、涂的什么色、绑定的油漆） */
  regions: StudioSessionRegionSnapshot[];
  nextRegionId: number;
  /** 用户线稿补线 / 擦线修补游程编码 */
  userLineEditsRle: string;
  /** 备选与最近用色缓存盘（移动选色模块） */
  stagedSwatches: StudioSessionStagedSwatch[];
  activeHex: string;
  savedAt: number;
}

export interface PartCanvas {
  id: string;
  partName: string;
  sourceImageDataUrl: string; // Clean un-annotated source image data URL
  nodes: FloatingSwatchNode[];
  steps: PaintingStep[];
  createdAt: number;
  /** 模拟试色台可回溯快照（点击「继续编辑模拟上色」时完整恢复） */
  studioSession?: StudioSessionSnapshot;
}

// ==========================================
// 取件表 (Parts Checklist) —— 零版权：玩家实拍封面 + 板件色彩编码 + 部位 Icon + 号码方块
// ==========================================

/** 多色成型板件 / 同板分色涂装：按零件号覆盖颜色与色卡信息 */
export interface RunnerPartColorOverride {
  colorHex: string;
  paintBrand?: string;
  paintCode?: string;
  paintName?: string;
}

/** 板件（流道）定义：A / B / K / PC / Iron Chain … */
export interface ChecklistRunner {
  id: string; // 板件代号，如 "A"、"K"、"PC"
  maxNumber: number; // 该板件最大零件号（自动生成 1..maxNumber 号码池）
  colorHex: string; // 板件主底色（可从项目指派油漆一键绑定）
  paintBrand?: string;
  paintCode?: string;
  paintName?: string; // 关联的油漆名称或成形色名称
  /** 多色成型板件 / 同板分色：按零件号独立指派颜色（如 A1~A10 颜色1、A11~A18 颜色2） */
  partColors?: Record<number, RunnerPartColorOverride>;
}

/** 角标：*2 对称件 / *4 / x2 两件 / ▲ 隐藏水口或预涂装件 */
export type ChecklistBadge = '*2' | '*4' | 'x2' | '▲';

/** 部位中的单个零件号（渲染时按板件归组，连续号自动折叠为 22-24） */
export interface ChecklistPart {
  id: string;
  runnerId: string;
  number: number;
  badge?: ChecklistBadge;
  qty?: number; // 非标准数量（如外部导入的 ×8 / ×12）；有 badge 时以 badge 为准
  isCut?: boolean; // 实操时已剪下 / 已打磨
}

export type ChecklistRegionCategory =
  | 'head'
  | 'torso'
  | 'core'
  | 'backpack'
  | 'waist'
  | 'arm_common'
  | 'arm_r'
  | 'arm_l'
  | 'shoulder'
  | 'leg_common'
  | 'leg_l'
  | 'leg_r'
  | 'weapon'
  | 'shield'
  | 'effect'
  | 'adapter'
  | 'decal'
  | 'other';

export interface ChecklistRegion {
  id: string;
  category: ChecklistRegionCategory;
  title: string; // 如 "头部"、"手臂/右手"、"武器/光束步枪"
  parts: ChecklistPart[];
}

/** 取件表视图分组：按部位（数据源） / 按板件（实时倒排视图） */
export type ChecklistGroupBy = 'region' | 'runner';

/** 外部取件表来源（仅记录文本数据出处，不含任何板件实拍图） */
export interface ChecklistImportSource {
  provider: 'dammiz';
  schemeId: number;
  url: string;
  title: string;
  revision?: string;
  importedAt: number;
}

export interface PartsChecklist {
  version: 1;
  groupBy?: ChecklistGroupBy; // 剪件打勾 / 海报导出的视图分组（默认按部位）
  source?: ChecklistImportSource;
  modelTitle?: string; // 海报机型大标题（默认取项目标题）
  subtitle?: string; // 比例 / 版本，如 "1/100 MG"
  coverImageDataUrl?: string; // 取件表专用封面（默认取项目封面）
  mergeConsecutive: boolean; // 连号自动折叠
  runners: ChecklistRunner[];
  regions: ChecklistRegion[];
  updatedAt: number;
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
  /** 整台模型的交互式取件表（按项目而非单张零件图存储） */
  partsChecklist?: PartsChecklist;
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
  partsChecklist?: PartsChecklist; // Optional web checklist data (ignored gracefully by iOS Codable CodingKeys)
}
