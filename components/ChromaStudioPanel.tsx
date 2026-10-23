import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  SquaresFour,
  SlidersHorizontal,
  Stack,
  CircleHalf,
  Eye,
  Palette,
  Drop,
  Sun,
  Eyedropper,
  Copy,
  Check,
  BookmarkSimple,
  Trash,
  UploadSimple,
  Sparkle,
  ArrowsClockwise,
  Crosshair,
  Info,
  CaretRight,
  Link,
  Plus
} from '@phosphor-icons/react';
import { CatalogPaint, ColorData, Language } from '../types';
import { loadPaintCatalog } from '../utils/paintCatalog';
import { computeBrandTintRecipe, findTopBrandMatchesForHex } from '../utils/brandTintRecipe';
import { loadWorkflowMode, THEME_SYNC_EVENT, WorkflowMode } from '../utils/accentTheme';
import { PaintBottleImg } from './PaintBottleHover';

// ==========================================
// 色彩科学算法工具库 (HEX <-> RGB <-> HSL <-> OKLCH 感知均匀空间)
// ==========================================

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 59, g: 110, b: 228 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp(Math.round(v * 255), 0, 255);
}

function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + b_ * b_);
  let h = (Math.atan2(b_, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l: clamp(L * 100, 0, 100), c: C, h };
}

function oklchToRgbRaw(L_pct: number, C: number, h: number): { lr: number; lg: number; lb: number } {
  const L = L_pct / 100;
  const hRad = (h * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b_ = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b_;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b_;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b_;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return { lr, lg, lb };
}

function oklchToRgbGamutMapped(L_pct: number, normSat_pct: number, h: number): {
  r: number;
  g: number;
  b: number;
  actualChroma: number;
  maxChroma: number;
} {
  let low = 0;
  let high = 0.37;
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    const { lr, lg, lb } = oklchToRgbRaw(L_pct, mid, h);
    if (lr >= -0.001 && lr <= 1.001 && lg >= -0.001 && lg <= 1.001 && lb >= -0.001 && lb <= 1.001) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const maxChromaForLH = Math.max(0.01, low);
  const targetC = (normSat_pct / 100) * maxChromaForLH;
  const { lr, lg, lb } = oklchToRgbRaw(L_pct, targetC, h);
  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
    actualChroma: targetC,
    maxChroma: maxChromaForLH
  };
}

function getPerceivedLuminance(r: number, g: number, b: number): number {
  const { l } = rgbToOklch(r, g, b);
  return Math.round(l);
}

// 实体颜料调色配比换算引擎
function calculatePigmentRecipe(
  baseHsl: { l: number; s: number },
  targetNode: { lStep: number; sStep: number },
  hueDeg: number
) {
  const getHueName = (h: number) => {
    if (h < 15 || h >= 345) return { base: '镉红 / 绯红', comp: '翠绿 / 酞青绿' };
    if (h < 45) return { base: '朱红 / 镉橙', comp: '群青 / 钴蓝' };
    if (h < 70) return { base: '镉黄 / 柠檬黄', comp: '群青紫' };
    if (h < 150) return { base: '树绿 / 翠绿', comp: '茜素红 / 品红' };
    if (h < 210) return { base: '天蓝 / 钴青', comp: '中镉橙' };
    if (h < 265) return { base: '群青 / 钴蓝', comp: '熟赭 / 镉橙' };
    if (h < 315) return { base: '群青紫', comp: '中镉黄' };
    return { base: '洋红 / 玫瑰红', comp: '黄绿 / 翠绿' };
  };

  const names = getHueName(hueDeg);
  const L = targetNode.lStep;
  const S = targetNode.sStep;

  let white = Math.max(0, (L - 48) * 1.65);
  let black = Math.max(0, (52 - L) * 1.45);
  let pureHue = (S / 100) * (100 - Math.abs(L - 50) * 1.15);
  let desaturator = ((100 - S) / 100) * 55;

  if (S === 0) {
    pureHue = 0;
    desaturator = 25;
  }

  const rawParts = [
    { key: 'hue', weight: pureHue },
    { key: 'white', weight: white },
    { key: 'comp', weight: desaturator },
    { key: 'black', weight: black }
  ];
  const totalWeight = Math.max(0.001, rawParts.reduce((acc, p) => acc + p.weight, 0));
  const allocated = rawParts.map(p => Math.floor((p.weight / totalWeight) * 100));
  let shortage = 100 - allocated.reduce((a, b) => a + b, 0);
  const remainders = rawParts.map((p, idx) => ({ idx, rem: (p.weight / totalWeight) * 100 - allocated[idx] }))
    .sort((a, b) => b.rem - a.rem);
  for (const r of remainders) {
    if (shortage <= 0) break;
    allocated[r.idx] += 1;
    shortage -= 1;
  }
  const pHue = allocated[0];
  const pWhite = allocated[1];
  const pComp = allocated[2];
  const pBlack = allocated[3];

  const deltaL = targetNode.lStep - Math.round(baseHsl.l);
  const deltaS = targetNode.sStep - Math.round(baseHsl.s);

  let actionTip = '';
  if (Math.abs(deltaL) <= 6 && Math.abs(deltaS) <= 8) {
    actionTip = '极其接近基准色，原色母打底 + 微量调色媒介稀释即可。';
  } else {
    const parts: string[] = [];
    if (deltaL > 6) parts.push(`加入约 ${pWhite}% 钛白提亮`);
    if (deltaL < -6) parts.push(`混入约 ${pBlack}% 象牙黑压暗`);
    if (deltaS < -8) parts.push(`点入微量【${names.comp.split(' ')[0]}】或中性灰降纯`);
    if (deltaS > 8) parts.push(`提高【${names.base.split(' ')[0]}】原浆占比拉升纯度`);
    actionTip = `调配建议：${parts.join('，')}。`;
  }

  return {
    pigments: [
      { name: `主色母 · ${names.base}`, pct: pHue, color: rgbToHex(hslToRgb(hueDeg, 90, 50).r, hslToRgb(hueDeg, 90, 50).g, hslToRgb(hueDeg, 90, 50).b) },
      { name: '提亮 · 钛白 (White)', pct: pWhite, color: '#F8FAFC' },
      { name: `降纯 · 互补/灰 (${names.comp.split(' ')[0]})`, pct: pComp, color: rgbToHex(hslToRgb((hueDeg + 180) % 360, 45, 45).r, hslToRgb((hueDeg + 180) % 360, 45, 45).g, hslToRgb((hueDeg + 180) % 360, 45, 45).b) },
      { name: '压暗 · 象牙黑 (Black)', pct: pBlack, color: '#1E293B' }
    ].filter((item) => item.pct > 0),
    actionTip,
    deltaL,
    deltaS
  };
}

function drawBuiltInArtwork(canvas: HTMLCanvasElement | null, presetType = 'cyber') {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = (canvas.width = 480);
  const h = (canvas.height = 280);

  if (presetType === 'cyber') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0F172A');
    sky.addColorStop(0.45, '#3B6EE4');
    sky.addColorStop(0.75, '#E05A47');
    sky.addColorStop(1, '#F4B942');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#FF6B4A';
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.42, 58, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.62);
    ctx.lineTo(w * 0.35, h * 0.45);
    ctx.lineTo(w * 0.65, h * 0.7);
    ctx.lineTo(w, h * 0.52);
    ctx.lineTo(w, h);
    ctx.fill();

    ctx.fillStyle = '#2DD4BF';
    ctx.beginPath();
    ctx.arc(w * 0.26, h * 0.76, 36, 0, Math.PI * 2);
    ctx.fill();
  } else if (presetType === 'morandi') {
    ctx.fillStyle = '#DCD6CE';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8FA395';
    ctx.fillRect(40, 40, 160, 220);
    ctx.fillStyle = '#C98A7B';
    ctx.beginPath();
    ctx.arc(280, 165, 85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6B7A8F';
    ctx.fillRect(330, 50, 110, 190);
    ctx.fillStyle = '#E6C79C';
    ctx.beginPath();
    ctx.arc(170, 210, 52, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ==========================================
// 组件主体
// ==========================================

export interface ChromaStudioPanelProps {
  color: ColorData | null;
  availableColors?: ColorData[];
  selectedColorId?: string | null;
  onSelectColorId?: (id: string) => void;
  lang: Language;
  onAddColor?: (hex: string) => void;
  onSelectColor?: (color: ColorData) => void;
  onNavigateToExtract?: () => void;
  pendingTonalSample?: ColorData | null;
  onConfirmTonalReplace?: (sampleId: string, newHex: string) => void;
  onCancelTonalReplace?: () => void;
}

export const ChromaStudioPanel: React.FC<ChromaStudioPanelProps> = ({
  color,
  availableColors,
  selectedColorId,
  onSelectColorId,
  lang,
  onAddColor,
  onSelectColor,
  onNavigateToExtract,
  pendingTonalSample,
  onConfirmTonalReplace,
  onCancelTonalReplace,
}) => {
  // 核心基准色：优先联动 Tab1 第一页当前选中的颜色
  const [baseHex, setBaseHex] = useState<string>(() => (color?.hex ? color.hex.toUpperCase() : '#3B6EE4'));

  // 当外部选中的 color 或 pendingTonalSample 变化时，自动联动更新基准色
  useEffect(() => {
    if (pendingTonalSample?.hex) {
      setBaseHex(pendingTonalSample.hex.toUpperCase());
    } else if (color?.hex) {
      setBaseHex(color.hex.toUpperCase());
    }
  }, [color?.hex, pendingTonalSample?.hex]);

  // 与 iOS 取色/取样点完全同步的有效色卡列表
  const effectiveSamples = useMemo(() => {
    if (availableColors && availableColors.length > 0) {
      return availableColors;
    }
    return [
      {
        id: 'sample-default-1',
        hex: baseHex,
        label: '#1',
        createdAt: Date.now()
      } as unknown as ColorData
    ];
  }, [availableColors, baseHex]);

  const handleSelectSample = (sample: ColorData, index: number) => {
    setBaseHex(sample.hex.toUpperCase());
    if (onSelectColorId && sample.id) {
      onSelectColorId(sample.id);
    }
    if (onSelectColor) {
      onSelectColor(sample);
    }
  };

  const isSampleActive = (sample: ColorData, index: number) => {
    if (selectedColorId && sample.id) {
      return sample.id === selectedColorId;
    }
    return sample.hex.toUpperCase() === baseHex.toUpperCase();
  };

  // 控制状态：默认适用白色背景
  const [colorSpace, setColorSpace] = useState<'oklch' | 'hsl'>('oklch');
  const [viewMode, setViewMode] = useState<'matrix' | 'dual' | 'pantone'>('matrix');
  const [showGrayscaleProof, setShowGrayscaleProof] = useState<boolean>(false);
  const [fullGrayscaleMode, setFullGrayscaleMode] = useState<boolean>(false);
  const [backdropTheme, setBackdropTheme] = useState<'dark' | 'neutral' | 'light'>('light');

  // 选中单元格
  const [selectedCell, setSelectedCell] = useState<{ rIdx: number; cIdx: number }>({ rIdx: 2, cIdx: 5 });
  const [hoveredCell, setHoveredCell] = useState<{ rIdx: number; cIdx: number } | null>(null);
  const [dualActiveRow, setDualActiveRow] = useState<number>(2);
  const [dualActiveCol, setDualActiveCol] = useState<number>(5);
  const [expandedFanRow, setExpandedFanRow] = useState<number>(2);

  // 取色器抽屉状态
  const [showImageDrawer, setShowImageDrawer] = useState<boolean>(false);
  const [catalogPaints, setCatalogPaints] = useState<CatalogPaint[]>([]);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(() => loadWorkflowMode());
  const [recipeTab, setRecipeTab] = useState<'brand-tint' | 'pigment'>(() =>
    loadWorkflowMode() === 'beginner' ? 'brand-tint' : 'brand-tint'
  );
  const [selectedBasePaintIdx, setSelectedBasePaintIdx] = useState<number>(0);

  useEffect(() => {
    let active = true;
    loadPaintCatalog().then((loaded) => {
      if (active) setCatalogPaints(loaded);
    });
    const syncMode = () => {
      const m = loadWorkflowMode();
      setWorkflowMode(m);
      if (m === 'beginner') setRecipeTab('brand-tint');
    };
    window.addEventListener(THEME_SYNC_EVENT, syncMode);
    return () => {
      active = false;
      window.removeEventListener(THEME_SYNC_EVENT, syncMode);
    };
  }, []);

  useEffect(() => {
    setSelectedBasePaintIdx(0);
  }, [baseHex]);
  const [extractedPalette, setExtractedPalette] = useState<string[]>([
    '#3B6EE4',
    '#FF6B4A',
    '#2DD4BF',
    '#F4B942',
    '#1E293B',
    '#8FA395'
  ]);
  const [hoverPixelHex, setHoverPixelHex] = useState<string | null>(null);
  const [savedSwatches, setSavedSwatches] = useState<string[]>(['#3B6EE4', '#689689', '#E04F44']);
  const [copiedText, setCopiedText] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 7 阶明度 × 7 阶饱和度
  const LIGHTNESS_STEPS = [90, 78, 66, 54, 42, 30, 18];
  const SATURATION_STEPS = [0, 16, 32, 50, 66, 82, 98];

  // 解析当前基准色属性并定位矩阵锚点
  const baseColorInfo = useMemo(() => {
    const rgb = hexToRgb(baseHex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);

    let refL = colorSpace === 'oklch' ? oklch.l : hsl.l;
    let refS = hsl.s;
    if (colorSpace === 'oklch') {
      const probe = oklchToRgbGamutMapped(oklch.l, 100, oklch.h);
      refS = clamp((oklch.c / Math.max(0.01, probe.maxChroma)) * 100, 0, 100);
    }

    let closestRow = 0;
    let minLDiff = 999;
    LIGHTNESS_STEPS.forEach((step, idx) => {
      const diff = Math.abs(step - refL);
      if (diff < minLDiff) {
        minLDiff = diff;
        closestRow = idx;
      }
    });

    let closestCol = 0;
    let minSDiff = 999;
    SATURATION_STEPS.forEach((step, idx) => {
      const diff = Math.abs(step - refS);
      if (diff < minSDiff) {
        minSDiff = diff;
        closestCol = idx;
      }
    });

    return {
      hex: baseHex.toUpperCase(),
      rgb,
      hsl,
      oklch,
      refL: Math.round(refL),
      refS: Math.round(refS),
      anchorRow: closestRow,
      anchorCol: closestCol
    };
  }, [baseHex, colorSpace]);

  // 基准色更新时同步双轨坐标
  useEffect(() => {
    setDualActiveRow(baseColorInfo.anchorRow);
    setDualActiveCol(baseColorInfo.anchorCol);
    setExpandedFanRow(baseColorInfo.anchorRow);
  }, [baseColorInfo.anchorRow, baseColorInfo.anchorCol]);

  // 生成 7×7 二维色卡网格
  const matrixGrid = useMemo(() => {
    const hue = colorSpace === 'oklch' ? baseColorInfo.oklch.h : baseColorInfo.hsl.h;

    return LIGHTNESS_STEPS.map((lStep, rIdx) => {
      return SATURATION_STEPS.map((sStep, cIdx) => {
        let rgb;
        if (colorSpace === 'oklch') {
          rgb = oklchToRgbGamutMapped(lStep, sStep, hue);
        } else {
          rgb = hslToRgb(hue, sStep, lStep);
        }
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        const perceivedL = getPerceivedLuminance(rgb.r, rgb.g, rgb.b);
        const grayRgb = oklchToRgbGamutMapped(perceivedL, 0, 0);
        const grayHex = rgbToHex(grayRgb.r, grayRgb.g, grayRgb.b);

        const isAnchor = rIdx === baseColorInfo.anchorRow && cIdx === baseColorInfo.anchorCol;

        return {
          rIdx,
          cIdx,
          lStep,
          sStep,
          hex,
          rgb,
          perceivedL,
          grayHex,
          isAnchor,
          deltaL: lStep - baseColorInfo.refL,
          deltaS: sStep - baseColorInfo.refS
        };
      });
    });
  }, [baseColorInfo, colorSpace]);

  // 检视的目标节点
  const activeInspectNode = useMemo(() => {
    const coord = hoveredCell || selectedCell;
    const row = matrixGrid[coord.rIdx] || matrixGrid[0];
    return row[coord.cIdx] || row[0];
  }, [hoveredCell, selectedCell, matrixGrid]);

  // 实体颜料配比计算
  const pigmentRecipe = useMemo(() => {
    return calculatePigmentRecipe(
      { l: baseColorInfo.refL, s: baseColorInfo.refS },
      activeInspectNode,
      baseColorInfo.hsl.h
    );
  }, [baseColorInfo, activeInspectNode]);

  // 现成品牌漆微调补正方案 (Brand Paint Tint Recipe)
  const topBrandCandidates = useMemo(() => {
    const matches = findTopBrandMatchesForHex(baseColorInfo.hex, catalogPaints, 3, lang);
    if (color?.assignedPaint) {
      const assigned = color.assignedPaint;
      const filtered = matches.filter((m) => m.paint.id !== assigned.id);
      return [
        {
          paint: assigned,
          deltaE: 0,
          brandZh: assigned.brand,
        },
        ...filtered.slice(0, 2),
      ];
    }
    return matches;
  }, [baseColorInfo.hex, catalogPaints, lang, color?.assignedPaint]);

  const activeBaseBrandPaint = useMemo(() => {
    if (topBrandCandidates.length === 0) return null;
    const safeIdx = Math.min(selectedBasePaintIdx, topBrandCandidates.length - 1);
    return topBrandCandidates[safeIdx]?.paint || topBrandCandidates[0].paint;
  }, [topBrandCandidates, selectedBasePaintIdx]);

  const brandTintRecipe = useMemo(() => {
    if (!activeBaseBrandPaint) return null;
    return computeBrandTintRecipe(activeInspectNode.hex, activeBaseBrandPaint, lang);
  }, [activeInspectNode.hex, activeBaseBrandPaint, lang]);

  // 初始化内置示例画布
  useEffect(() => {
    if (showImageDrawer && canvasRef.current) {
      drawBuiltInArtwork(canvasRef.current, 'cyber');
    }
  }, [showImageDrawer]);

  const extractDominantColorsFromCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height).data;
    const buckets: Record<string, { count: number; rSum: number; gSum: number; bSum: number }> = {};

    for (let i = 0; i < imgData.length; i += 64) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const a = imgData[i + 3];
      if (a < 128) continue;

      const qr = Math.round(r / 36) * 36;
      const qg = Math.round(g / 36) * 36;
      const qb = Math.round(b / 36) * 36;
      const key = `${qr},${qg},${qb}`;
      if (!buckets[key]) {
        buckets[key] = { count: 0, rSum: 0, gSum: 0, bSum: 0 };
      }
      buckets[key].count += 1;
      buckets[key].rSum += r;
      buckets[key].gSum += g;
      buckets[key].bSum += b;
    }

    const sorted = Object.values(buckets)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((b) =>
        rgbToHex(
          Math.round(b.rSum / b.count),
          Math.round(b.gSum / b.count),
          Math.round(b.bSum / b.count)
        )
      );

    if (sorted.length > 0) {
      setExtractedPalette(sorted);
      setBaseHex(sorted[0]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = 480;
        canvas.height = 280;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        extractDominantColorsFromCanvas(canvas);
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasPointer = (e: React.MouseEvent<HTMLCanvasElement>, isClick = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = clamp(Math.floor((e.clientX - rect.left) * scaleX), 0, canvas.width - 1);
    const y = clamp(Math.floor((e.clientY - rect.top) * scaleY), 0, canvas.height - 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    setHoverPixelHex(hex);
    if (isClick) {
      setBaseHex(hex);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 1800);
  };

  const toggleSaveSwatch = (hex: string) => {
    if (savedSwatches.includes(hex)) {
      setSavedSwatches(savedSwatches.filter((c) => c !== hex));
    } else {
      setSavedSwatches([...savedSwatches, hex]);
    }
  };

  const backdropClasses = {
    dark: 'bg-[#0B0D13] text-slate-100 border-slate-800/80 shadow-2xl',
    neutral: 'bg-[#808080] text-white border-white/25 shadow-2xl',
    light: 'bg-white text-slate-800 border-slate-200/90 shadow-sm'
  };

  const isLinkedWithTab1 = color?.hex && color.hex.toUpperCase() === baseHex.toUpperCase();

  return (
    <div className="w-full space-y-4 font-sans select-none animate-fadeIn">
      {/* 取色点明度微调重定向横幅 (与 iOS Tonal Redirection 1:1 同步) */}
      {pendingTonalSample && (
        <div className="rounded-2xl border border-amber-300/90 dark:border-amber-700/80 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/70 dark:via-orange-950/50 dark:to-rose-950/60 p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="h-7 w-7 rounded-xl border-2 border-white shadow-sm shrink-0"
              style={{ backgroundColor: pendingTonalSample.hex }}
            />
            <div>
              <div className="text-xs font-black text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                <ArrowsClockwise className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>正在微调取色点颜色 (替换后需重新指派油漆)</span>
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                在下方矩阵中点选目标明度/纯度变体，然后点击右侧「替换取色点颜色」返回拾色页重新指派油漆。
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onConfirmTonalReplace && (
              <button
                type="button"
                onClick={() => onConfirmTonalReplace(pendingTonalSample.id, activeInspectNode.hex)}
                className="rounded-xl bg-amber-600 hover:bg-amber-500 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-xs transition cursor-pointer"
              >
                替换为 {activeInspectNode.hex}
              </button>
            )}
            {onCancelTonalReplace && (
              <button
                type="button"
                onClick={onCancelTonalReplace}
                className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-white transition cursor-pointer"
              >
                取消
              </button>
            )}
          </div>
        </div>
      )}

      {/* 顶部控制栏：联动基准色、色值输入、取样点同步切换与参考图取色 */}
      <div className="bp-subcard-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* 左侧：基准参考色 + 与 iOS 取色同步的取样点切换栏 (桌面端显示，手机竖屏保留顶部全局当前色栏避免重复) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="bp-input flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 pr-2 sm:pr-2.5">
            <label className="relative flex items-center cursor-pointer mr-1.5 sm:mr-2" title="点击调出系统调色板">
              <input
                type="color"
                value={baseHex}
                onChange={(e) => setBaseHex(e.target.value.toUpperCase())}
                className="sr-only"
              />
              <span
                className="bp-swatch w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-white/30 shadow-inner flex items-center justify-center transition-colors"
                style={{ backgroundColor: baseHex }}
              >
                <Eyedropper className="w-3.5 h-3.5 text-white drop-shadow" />
              </span>
            </label>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-400 mr-1 sm:mr-1.5">基准色</span>
            <input
              type="text"
              value={baseHex}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                  setBaseHex(val.toUpperCase());
                }
              }}
              className="w-16 sm:w-18 bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>

          {/* 与 iOS 取色同步的取样点切换栏：仅在 lg 桌面宽屏显示，手机竖屏下由顶部全局「当前色：」接管避免重复 */}
          <div className="bp-segmented hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 overflow-x-auto max-w-[calc(100vw-360px)] no-scrollbar">
            {effectiveSamples.map((sample, idx) => {
              const active = isSampleActive(sample, idx);
              return (
                <button
                  key={sample.id || idx}
                  type="button"
                  onClick={() => handleSelectSample(sample, idx)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs transition-all flex-shrink-0 cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bp-pill-active bg-accent/10 dark:bg-accent/20 border-2 border-accent text-accent dark:text-accent-light font-bold shadow-xs'
                      : 'bp-pill bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                  title={`取样点 #${idx + 1} (${sample.hex})`}
                >
                  <span
                    className="bp-dot w-3.5 h-3.5 rounded-full border border-black/20 flex-shrink-0 shadow-xs"
                    style={{ backgroundColor: sample.hex }}
                  />
                  <span className="font-mono text-xs font-bold">#{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：参考图取色抽屉切换 & 跳回拾色页面 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onNavigateToExtract && (
            <button
              onClick={onNavigateToExtract}
              className="bp-pill px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition whitespace-nowrap"
              title="返回第一页图片拾色"
            >
              <Crosshair className="w-3.5 h-3.5 inline mr-1" />
              <span>去主图吸色</span>
            </button>
          )}

          <button
            onClick={() => setShowImageDrawer(!showImageDrawer)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all whitespace-nowrap ${
              showImageDrawer
                ? 'bp-pill-active bg-accent text-white border-accent shadow-sm'
                : 'bp-pill bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/70'
            }`}
          >
            <UploadSimple className="w-3.5 h-3.5" />
            <span>{showImageDrawer ? '收起画布' : '画布吸色'}</span>
          </button>
        </div>
      </div>

      {/* 模块一：可展开的「参考图上传 + 自动主色提取 + 画布吸色」工作抽屉 */}
      {showImageDrawer && (
        <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
              <Sparkle className="w-4 h-4 text-accent" />
              <span>画布取色与聚类</span>
              <span className="font-normal text-slate-400 text-[11px]">点击画布像素或提取色块即设为基准色</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  drawBuiltInArtwork(canvasRef.current, 'cyber');
                  if (canvasRef.current) extractDominantColorsFromCanvas(canvasRef.current);
                }}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition whitespace-nowrap"
              >
                赛博日落
              </button>
              <button
                onClick={() => {
                  drawBuiltInArtwork(canvasRef.current, 'morandi');
                  if (canvasRef.current) extractDominantColorsFromCanvas(canvasRef.current);
                }}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition whitespace-nowrap"
              >
                莫兰迪静物
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-hover transition whitespace-nowrap"
              >
                <UploadSimple className="w-3.5 h-3.5" />
                上传参考图
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* 左侧交互画布 */}
            <div className="md:col-span-7 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 bg-slate-950">
              <canvas
                ref={canvasRef}
                onMouseMove={(e) => handleCanvasPointer(e, false)}
                onMouseLeave={() => setHoverPixelHex(null)}
                onClick={(e) => handleCanvasPointer(e, true)}
                className="w-full h-44 object-cover cursor-crosshair block"
              />
              {hoverPixelHex && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-md border border-white/20 text-[11px] font-mono text-white flex items-center gap-1.5 shadow">
                  <span
                    className="w-3 h-3 rounded-full border border-white/40"
                    style={{ backgroundColor: hoverPixelHex }}
                  />
                  {hoverPixelHex}
                </div>
              )}
            </div>

            {/* 右侧自动提取的核心色板 */}
            <div className="md:col-span-5 space-y-2">
              <span className="text-[11px] font-bold text-slate-400">提取色相 (点击锁定)</span>
              <div className="grid grid-cols-3 gap-2">
                {extractedPalette.map((hex, i) => {
                  const isCurrent = baseHex.toUpperCase() === hex.toUpperCase();
                  return (
                    <button
                      key={`${hex}-${i}`}
                      onClick={() => setBaseHex(hex)}
                      className={`relative flex flex-col justify-between p-2 h-16 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'ring-2 ring-accent border-transparent scale-[1.02] shadow-sm'
                          : 'border-black/10 dark:border-white/10 hover:scale-[1.02]'
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      <span className="text-[9px] font-bold px-1 rounded bg-black/40 text-white w-fit">
                        #{i + 1}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-white drop-shadow">
                        {hex}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 模块二：核心工具栏（默认白色背景，不受衬底主题切换影响） */}
      <div className="bp-subcard-lg bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
        {/* 三大视图切换器 */}
        <div className="bp-segmented flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <button
            onClick={() => setViewMode('matrix')}
            className={`bp-segmented-item flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
              viewMode === 'matrix'
                ? 'bp-segmented-item-active bg-accent text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="1. 二维矩阵靶心看板"
          >
            <SquaresFour className="w-3.5 h-3.5 shrink-0" />
            <span>矩阵看板</span>
          </button>
          <button
            onClick={() => setViewMode('dual')}
            className={`bp-segmented-item flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
              viewMode === 'dual'
                ? 'bp-segmented-item-active bg-accent text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="2. 双轨解耦滑块卡片"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>双轨</span>
          </button>
          <button
            onClick={() => setViewMode('pantone')}
            className={`bp-segmented-item flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
              viewMode === 'pantone'
                ? 'bp-segmented-item-active bg-accent text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title="3. 潘通式堆叠扇叶"
          >
            <Stack className="w-3.5 h-3.5 shrink-0" />
            <span>潘通扇叶</span>
          </button>
        </div>

        {/* 右侧功能组：色彩空间、灰阶对照、黑白检视、衬底切换 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* OKLCH vs HSL */}
          <div className="bp-segmented flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              onClick={() => setColorSpace('oklch')}
              className={`bp-segmented-item px-2 sm:px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-bold transition whitespace-nowrap ${
                colorSpace === 'oklch'
                  ? 'bp-segmented-item-active bg-accent/12 text-accent dark:text-accent-light border border-accent/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="OKLCH 感知均匀空间：同一行灰阶绝对一致"
            >
              OKLCH 等明度
            </button>
            <button
              onClick={() => setColorSpace('hsl')}
              className={`bp-segmented-item px-2 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-medium transition whitespace-nowrap ${
                colorSpace === 'hsl'
                  ? 'bp-segmented-item-active bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="传统 HSL 空间"
            >
              传统 HSL
            </button>
          </div>

          {/* 灰阶切角对照 */}
          <button
            onClick={() => setShowGrayscaleProof(!showGrayscaleProof)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium border transition whitespace-nowrap ${
              showGrayscaleProof
                ? 'bp-pill-active bg-slate-900 text-white border-slate-900 shadow-xs font-bold dark:bg-white dark:text-slate-900'
                : 'bp-pill bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
            title="在彩色色块角标展示等效灰阶深度"
          >
            <CircleHalf className="w-3.5 h-3.5 shrink-0" />
            <span>灰阶对照</span>
          </button>

          {/* 纯黑白素描检视 */}
          <button
            onClick={() => setFullGrayscaleMode(!fullGrayscaleMode)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-medium border transition whitespace-nowrap ${
              fullGrayscaleMode
                ? 'bp-pill-active bg-amber-500 text-white border-amber-600 font-bold shadow-xs'
                : 'bp-pill bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/70 dark:hover:bg-slate-700'
            }`}
            title="一键去除色彩，检视黑白灰素描明暗阶梯"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>{fullGrayscaleMode ? '彩色模式' : '黑白素描'}</span>
          </button>

          {/* 衬底切换 */}
          <div className="bp-segmented flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 whitespace-nowrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-0.5">衬底</span>
            <button
              onClick={() => setBackdropTheme('dark')}
              title="暗黑底色"
              className={`bp-dot w-4 h-4 rounded-full bg-[#0F1117] border border-slate-400/80 transition-all ${
                backdropTheme === 'dark' ? 'ring-2 ring-accent ring-offset-1 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
              }`}
            />
            <button
              onClick={() => setBackdropTheme('neutral')}
              title="50% 中性灰校色底色 (#808080)"
              className={`bp-dot w-4 h-4 rounded-full bg-[#808080] border border-slate-300/80 transition-all ${
                backdropTheme === 'neutral' ? 'ring-2 ring-accent ring-offset-1 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
              }`}
            />
            <button
              onClick={() => setBackdropTheme('light')}
              title="纯净浅色底色"
              className={`bp-dot w-4 h-4 rounded-full bg-white border border-slate-300 shadow-xs transition-all ${
                backdropTheme === 'light' ? 'ring-2 ring-accent ring-offset-1 dark:ring-offset-slate-900' : 'opacity-80 hover:opacity-100'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 模块三：主工作台布局（左侧色卡主画布 + 右侧双色零接缝与调色建议） */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pr-1.5 pb-1.5">
        {/* 左侧 8 列：色卡主画布 */}
        <div className={`bp-subcard-lg lg:col-span-8 rounded-2xl border p-3 sm:p-5 transition-colors duration-200 ${backdropClasses[backdropTheme]}`}>
          {/* 画布顶部坐标说明栏 */}
          <div className={`flex items-center justify-between text-xs mb-3 pb-2 border-b ${backdropTheme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`font-bold font-mono px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-xs ${backdropTheme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-black/25 text-white'}`}>
                色相 H: {Math.round(baseColorInfo.hsl.h)}°
              </span>
              <span className="opacity-75 text-[10px] sm:text-[11px]">
                {colorSpace === 'oklch' ? 'OKLCH 灰阶严格等高' : '传统数学 HSL'}
              </span>
            </div>
            <span className="font-mono text-[10px] sm:text-[11px] opacity-75">
              锚点: L {baseColorInfo.refL}% · S {baseColorInfo.refS}%
            </span>
          </div>

          {/* 1. 二维矩阵靶心看板 */}
          {viewMode === 'matrix' && (
            <div className="space-y-1.5 sm:space-y-2">
              {/* X 轴饱和度标题 */}
              <div className="grid grid-cols-8 gap-1 sm:gap-1.5 text-center items-center pb-0.5">
                <div className="text-[8px] sm:text-[10px] font-mono opacity-60 text-left pl-0.5 sm:pl-1 leading-tight">
                  <span className="hidden sm:inline">明度 \ 纯度</span>
                  <span className="sm:hidden">L \ S</span>
                </div>
                {SATURATION_STEPS.map((sStep, cIdx) => (
                  <div
                    key={sStep}
                    className={`text-[8.5px] sm:text-[10px] font-mono py-0.5 rounded ${
                      cIdx === 0
                        ? (backdropTheme === 'light' ? 'bg-slate-100 text-slate-700 font-bold' : 'bg-black/20 font-bold opacity-90')
                        : cIdx === baseColorInfo.anchorCol
                        ? 'font-bold underline underline-offset-2'
                        : 'opacity-70'
                    }`}
                  >
                    {cIdx === 0 ? '纯灰' : `S${sStep}%`}
                  </div>
                ))}
              </div>

              {/* 7×7 矩阵行 */}
              {matrixGrid.map((row, rIdx) => (
                <div key={LIGHTNESS_STEPS[rIdx]} className="grid grid-cols-8 gap-1 sm:gap-1.5 items-center">
                  <div className={`text-[9.5px] sm:text-xs font-mono pr-0.5 sm:pr-1 flex flex-col ${rIdx === baseColorInfo.anchorRow ? 'font-bold' : 'opacity-70'}`}>
                    <span>L{LIGHTNESS_STEPS[rIdx]}%</span>
                  </div>

                  {row.map((cell, cIdx) => {
                    const isSelected = selectedCell.rIdx === rIdx && selectedCell.cIdx === cIdx;
                    const isHovered = hoveredCell?.rIdx === rIdx && hoveredCell?.cIdx === cIdx;
                    const displayBg = fullGrayscaleMode ? cell.grayHex : cell.hex;
                    const isLightText = cell.perceivedL <= 60;

                    return (
                      <button
                        key={`${rIdx}-${cIdx}`}
                        onClick={() => setSelectedCell({ rIdx, cIdx })}
                        onMouseEnter={() => setHoveredCell({ rIdx, cIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`bp-matrix-cell group relative aspect-square sm:aspect-auto sm:h-14 rounded-lg sm:rounded-xl transition-all duration-150 flex flex-col justify-between p-0.5 sm:p-1.5 text-left overflow-hidden focus:outline-none ${
                          cell.isAnchor
                            ? `bp-matrix-cell-active ring-2 sm:ring-3 ${backdropTheme === 'light' ? 'ring-slate-900' : 'ring-white'} shadow-md scale-[1.03] z-10`
                            : isSelected
                            ? 'bp-matrix-cell-active ring-2 ring-accent scale-[1.02] z-10 shadow-sm'
                            : 'hover:scale-[1.04] hover:z-20'
                        } ${cIdx === 0 ? `border border-dashed ${backdropTheme === 'light' ? 'border-slate-400/50' : 'border-white/20'}` : ''}`}
                        style={{ backgroundColor: displayBg }}
                      >
                        <div className="flex items-center justify-between w-full z-10 px-0 sm:px-0.5 pointer-events-none gap-0.5">
                          {cell.isAnchor ? (
                            <span className={`bp-badge text-[6px] sm:text-[7px] leading-none font-black px-0.5 sm:px-1 py-0.5 rounded uppercase whitespace-nowrap shrink-0 ${isLightText ? 'bg-white text-slate-900 shadow-xs' : 'bg-slate-950 text-white shadow-xs'}`}>
                              BASE
                            </span>
                          ) : isSelected ? (
                            <span className={`bp-badge text-[6px] sm:text-[7px] leading-none font-black px-0.5 sm:px-1 py-0.5 rounded whitespace-nowrap shrink-0 ${isLightText ? 'bg-white/40 text-white shadow-xs' : 'bg-black/30 text-white shadow-xs'}`}>
                              PIN
                            </span>
                          ) : <span />}

                          {(isHovered || isSelected) && !cell.isAnchor && (
                            <span className={`bp-badge text-[5.5px] sm:text-[7.5px] leading-none font-mono font-bold whitespace-nowrap shrink-0 px-0.5 sm:px-1 py-0.5 rounded ${isLightText ? 'bg-black/30 text-white' : 'bg-white/60 text-slate-900 shadow-2xs'}`}>
                              {cell.deltaL > 0 ? `+${cell.deltaL}` : cell.deltaL}L
                            </span>
                          )}
                        </div>

                        <div className="z-10 flex items-end justify-center sm:justify-between w-full">
                          <span className={`font-mono text-[6px] sm:text-[9px] font-bold tracking-tighter sm:tracking-normal leading-none truncate w-full text-center sm:text-left ${cell.isAnchor || isSelected || isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            {displayBg}
                          </span>
                        </div>

                        {showGrayscaleProof && !fullGrayscaleMode && cIdx > 0 && (
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2.5 sm:h-3 border-t border-white/20 flex items-center justify-end px-0.5 sm:px-1"
                            style={{ backgroundColor: cell.grayHex }}
                            title={`等效灰阶: ${cell.grayHex} (L=${cell.perceivedL}%)`}
                          >
                            <span className={`text-[6px] sm:text-[7px] leading-none font-mono ${cell.perceivedL <= 60 ? 'text-white' : 'text-black'}`}>
                              L{cell.perceivedL}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* 2. 双轨解耦滑块卡片 */}
          {viewMode === 'dual' && (
            <div className="space-y-4 sm:space-y-5 py-1">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sun className="w-3.5 h-3.5" />
                    <span>轨道 A · 明度阶梯 (锁定 S={SATURATION_STEPS[dualActiveCol]}%)</span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {matrixGrid.map((row, rIdx) => {
                    const cell = row[dualActiveCol];
                    const isActive = rIdx === dualActiveRow;
                    const isLightText = cell.perceivedL <= 60;
                    const bg = fullGrayscaleMode ? cell.grayHex : cell.hex;

                    return (
                      <button
                        key={rIdx}
                        onClick={() => {
                          setDualActiveRow(rIdx);
                          setSelectedCell({ rIdx, cIdx: dualActiveCol });
                        }}
                        className={`bp-matrix-cell h-16 sm:h-22 rounded-lg sm:rounded-xl p-1 sm:p-2 flex flex-col justify-between text-left transition-all overflow-hidden ${
                          isActive
                            ? `bp-matrix-cell-active ring-2 ${backdropTheme === 'light' ? 'ring-slate-900' : 'ring-white'} scale-[1.03] shadow-md z-10`
                            : 'opacity-90 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: bg }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 w-full min-w-0">
                          <span className={`text-[9px] sm:text-xs font-mono font-bold leading-none ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            L{cell.lStep}%
                          </span>
                          {rIdx === baseColorInfo.anchorRow && (
                            <span className="text-[6px] sm:text-[8px] font-bold px-0.5 sm:px-1 py-0.5 rounded bg-black/40 text-white w-fit leading-none whitespace-nowrap">
                              原明度
                            </span>
                          )}
                        </div>
                        <div className="w-full min-w-0">
                          <div className={`font-mono text-[6px] sm:text-[10px] font-bold tracking-tighter sm:tracking-normal leading-tight truncate w-full ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            {bg}
                          </div>
                          <div className={`text-[6px] sm:text-[9px] opacity-75 leading-none truncate w-full mt-0.5 ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            <span className="hidden sm:inline">灰阶 </span>
                            <span className="sm:hidden">灰</span>
                            {cell.perceivedL}%
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Drop className="w-3.5 h-3.5" />
                    <span>轨道 B · 纯度阶梯 (锁定 L={LIGHTNESS_STEPS[dualActiveRow]}%)</span>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {matrixGrid[dualActiveRow].map((cell, cIdx) => {
                    const isActive = cIdx === dualActiveCol;
                    const isLightText = cell.perceivedL <= 60;
                    const bg = fullGrayscaleMode ? cell.grayHex : cell.hex;

                    return (
                      <button
                        key={cIdx}
                        onClick={() => {
                          setDualActiveCol(cIdx);
                          setSelectedCell({ rIdx: dualActiveRow, cIdx });
                        }}
                        className={`bp-matrix-cell h-16 sm:h-22 rounded-lg sm:rounded-xl p-1 sm:p-2 flex flex-col justify-between text-left transition-all overflow-hidden ${
                          isActive
                            ? `bp-matrix-cell-active ring-2 ${backdropTheme === 'light' ? 'ring-slate-900' : 'ring-white'} scale-[1.03] shadow-md z-10`
                            : 'opacity-90 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: bg }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 w-full min-w-0">
                          <span className={`text-[9px] sm:text-xs font-mono font-bold leading-none ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            S{cell.sStep}%
                          </span>
                          {cIdx === baseColorInfo.anchorCol && (
                            <span className="text-[6px] sm:text-[8px] font-bold px-0.5 sm:px-1 py-0.5 rounded bg-black/40 text-white w-fit leading-none whitespace-nowrap">
                              原纯度
                            </span>
                          )}
                        </div>
                        <div className="w-full min-w-0">
                          <div className={`font-mono text-[6px] sm:text-[10px] font-bold tracking-tighter sm:tracking-normal leading-tight truncate w-full ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            {bg}
                          </div>
                          <div className={`text-[6px] sm:text-[9px] opacity-75 leading-none truncate w-full mt-0.5 ${isLightText ? 'text-white' : 'text-slate-900'}`}>
                            {cIdx === 0 ? '消色灰' : `#${cIdx}`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 标尺轨道 C */}
              <div className={`pt-2 border-t ${backdropTheme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                <div className="text-[11px] opacity-75 mb-1.5 flex items-center justify-between">
                  <span>绝对黑白灰阶标尺</span>
                  <span className="font-mono">L 90% → 18%</span>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {matrixGrid.map((row, rIdx) => {
                    const grayCell = row[0];
                    return (
                      <div
                        key={rIdx}
                        className={`h-7 rounded-lg flex items-center justify-center font-mono text-[8px] sm:text-[10px] font-bold tracking-tighter sm:tracking-normal ${
                          rIdx === dualActiveRow ? 'ring-2 ring-accent' : 'opacity-80'
                        }`}
                        style={{
                          backgroundColor: grayCell.grayHex,
                          color: grayCell.perceivedL <= 58 ? '#FFF' : '#0F172A'
                        }}
                      >
                        <span className="hidden sm:inline mr-0.5">灰</span>L{grayCell.lStep}%
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. 潘通式堆叠扇叶 */}
          {viewMode === 'pantone' && (
            <div className="space-y-2.5 py-1">
              {matrixGrid.map((row, rIdx) => {
                const isExpanded = expandedFanRow === rIdx;
                const repCell = row[baseColorInfo.anchorCol];
                const isAnchorLayer = rIdx === baseColorInfo.anchorRow;

                return (
                  <div
                    key={rIdx}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isExpanded
                        ? backdropTheme === 'light'
                          ? 'bg-slate-50 border-slate-200 p-3 shadow-sm'
                          : 'bg-black/25 border-white/20 p-3 shadow-md'
                        : backdropTheme === 'light'
                        ? 'bg-white border-slate-200/80 p-2 cursor-pointer hover:bg-slate-50'
                        : 'bg-black/10 border-white/10 p-2 cursor-pointer'
                    }`}
                    onClick={() => !isExpanded && setExpandedFanRow(rIdx)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md border border-white/20 shadow-xs" style={{ backgroundColor: repCell.hex }} />
                        <span className="text-xs font-bold font-mono">明度 L-{LIGHTNESS_STEPS[rIdx]}%</span>
                        {isAnchorLayer && <span className="text-[9px] font-bold px-1.5 rounded-full bg-accent text-white whitespace-nowrap">基准层</span>}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isExpanded && (
                          <div className="flex -space-x-1.5 mr-1">
                            {row.map((c, idx) => (
                              <span key={idx} className="w-4 h-4 rounded-full border border-white/20 shadow-xs" style={{ backgroundColor: c.hex }} />
                            ))}
                          </div>
                        )}
                        <CaretRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={`grid grid-cols-4 sm:grid-cols-7 gap-2 mt-3 pt-2.5 border-t ${backdropTheme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
                        {row.map((cell, cIdx) => {
                          const isSelected = selectedCell.rIdx === rIdx && selectedCell.cIdx === cIdx;
                          const displayBg = fullGrayscaleMode ? cell.grayHex : cell.hex;

                          return (
                            <button
                              key={cIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCell({ rIdx, cIdx });
                              }}
                              className={`bg-white text-slate-900 rounded-lg p-1.5 shadow-sm transition-all text-left flex flex-col ${
                                cell.isAnchor ? 'ring-2 ring-accent' : isSelected ? 'ring-2 ring-slate-900' : ''
                              }`}
                            >
                              <div className="w-full aspect-square sm:aspect-auto sm:h-14 rounded mb-1.5 relative p-1 flex items-start justify-between" style={{ backgroundColor: displayBg }}>
                                {cell.isAnchor ? (
                                  <span className="text-[7px] sm:text-[8px] leading-none font-bold px-1 py-0.5 rounded bg-white text-slate-900 shadow-2xs">BASE</span>
                                ) : isSelected ? (
                                  <span className="text-[7px] sm:text-[8px] leading-none font-bold px-1 py-0.5 rounded bg-black/40 text-white shadow-2xs">PIN</span>
                                ) : null}
                              </div>
                              <div className="font-mono text-[9px] sm:text-[10px] font-bold text-slate-900 truncate">{displayBg}</div>
                              <div className="text-[8px] sm:text-[9px] text-slate-500 flex justify-between">
                                <span>S{cell.sStep}%</span>
                                <span>L{cell.lStep}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧 4 列：零接缝对比槽 + 实体颜料换算 + 灵感色板 */}
        <div className="lg:col-span-4 space-y-4">
          {/* 卡片 1：零接缝对比槽 */}
          <div className="bp-subcard-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <CircleHalf className="w-4 h-4 text-accent" />
                <span>零接缝双色对比槽</span>
              </h2>
              <span className="text-[10px] text-slate-400">消除间隙视错觉</span>
            </div>

            <div className="bp-swatch relative grid grid-cols-2 h-24 rounded-xl overflow-hidden border border-slate-200/60 dark:border-white/10 shadow-inner">
              {/* Blueprint center dashed divider */}
              <div className="bp-center-dashed-divider pointer-events-none absolute inset-y-0 left-1/2 z-10" />
              <div
                className="p-2.5 flex flex-col justify-between"
                style={{
                  backgroundColor: fullGrayscaleMode ? matrixGrid[baseColorInfo.anchorRow][0].grayHex : baseColorInfo.hex,
                  color: baseColorInfo.refL <= 60 ? '#FFF' : '#0F172A'
                }}
              >
                <span className="bp-badge text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/25 text-white w-fit">基准色</span>
                <div>
                  <div className="font-mono text-xs font-bold">{baseColorInfo.hex}</div>
                  <div className="text-[10px] font-mono opacity-80">L{baseColorInfo.refL}% · S{baseColorInfo.refS}%</div>
                </div>
              </div>

              <div
                className="p-2.5 flex flex-col justify-between transition-colors"
                style={{
                  backgroundColor: fullGrayscaleMode ? activeInspectNode.grayHex : activeInspectNode.hex,
                  color: activeInspectNode.perceivedL <= 60 ? '#FFF' : '#0F172A'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="bp-badge text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/25 text-white">变体色</span>
                  <span className="text-[10px] font-mono font-bold">
                    {activeInspectNode.deltaL >= 0 ? `+${activeInspectNode.deltaL}%` : `${activeInspectNode.deltaL}%`}L
                  </span>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold">{activeInspectNode.hex}</div>
                  <div className="text-[10px] font-mono opacity-80">L{activeInspectNode.lStep}% · S{activeInspectNode.sStep}%</div>
                </div>
              </div>
            </div>

            {/* 操作按钮组 */}
            {pendingTonalSample && onConfirmTonalReplace && (
              <button
                type="button"
                onClick={() => onConfirmTonalReplace(pendingTonalSample.id, activeInspectNode.hex)}
                className="bp-btn mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:opacity-95 text-xs font-black text-white shadow-md transition cursor-pointer"
              >
                <ArrowsClockwise className="w-4 h-4" />
                <span>替换取色点颜色 ({activeInspectNode.hex}) 并返回重选油漆</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <button
                onClick={() => handleCopy(activeInspectNode.hex)}
                className="bp-btn flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 transition"
              >
                {copiedText === activeInspectNode.hex ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 text-[11px]">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px]">复制 HEX</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  onAddColor?.(activeInspectNode.hex);
                  toggleSaveSwatch(activeInspectNode.hex);
                }}
                className="bp-btn flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-accent/10 dark:bg-accent/20 hover:bg-accent/15 dark:hover:bg-accent/30 border border-accent/25 dark:border-accent/40 text-xs font-bold text-accent dark:text-accent-light transition whitespace-nowrap"
                title="将该变体色加入左侧色板并收藏"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="text-[11px]">加入色板</span>
              </button>
            </div>
          </div>

          {/* 卡片 2：现成品牌漆微调补正方案 (新手默认置顶) / 实体颜料配比换算 (专业) */}
          <div className="bp-subcard-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Drop className="w-4 h-4 text-accent" />
                <span>
                  {recipeTab === 'brand-tint' ? '🎯 现成品牌漆微调补正方案' : '实体颜料配比换算'}
                </span>
              </h2>
              <span className="bp-badge text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                目标 {activeInspectNode.hex}
              </span>
            </div>

            {/* 模式切换器：[🍼 品牌漆滴数微调 | 🧪 色母从零混色] */}
            <div className="bp-segmented grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
              <button
                type="button"
                onClick={() => setRecipeTab('brand-tint')}
                className={`bp-segmented-item py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  recipeTab === 'brand-tint'
                    ? 'bp-segmented-item-active bg-accent text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🍼 品牌漆滴数微调 {workflowMode === 'beginner' ? '(推荐)' : ''}
              </button>
              <button
                type="button"
                onClick={() => setRecipeTab('pigment')}
                className={`bp-segmented-item py-1.5 px-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  recipeTab === 'pigment'
                    ? 'bp-segmented-item-active bg-accent text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🧪 色母从零混色
              </button>
            </div>

            {recipeTab === 'brand-tint' && brandTintRecipe ? (
              <div className="space-y-2.5">
                {/* 候选主品牌漆切换胶囊 */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between">
                    <span>选择手头或想买的主基底漆：</span>
                    <span className="font-mono">Top {topBrandCandidates.length} 近邻</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topBrandCandidates.map((cand, idx) => {
                      const active = idx === selectedBasePaintIdx;
                      return (
                        <button
                          key={cand.paint.id}
                          type="button"
                          onClick={() => setSelectedBasePaintIdx(idx)}
                          className={`bp-pill flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                            active
                              ? 'bp-pill-active border-accent bg-accent/12 dark:bg-accent/25 text-accent dark:text-white ring-1 ring-accent/40'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-accent/50'
                          }`}
                        >
                          <span
                            className="bp-dot w-3 h-3 rounded-xs border border-black/15 shrink-0"
                            style={{ backgroundColor: cand.paint.hex }}
                          />
                          <span className="truncate max-w-[110px]">
                            {cand.brandZh} {cand.paint.code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {brandTintRecipe.isDirectMatch ? (
                  /* 情况 1：色差极小 (ΔE <= 2.2) — 开瓶直喷 */
                  <div className="bp-subcard rounded-xl border border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-950/50 p-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="bp-swatch w-11 h-11 rounded-lg border border-black/15 shrink-0 bg-white overflow-hidden flex items-center justify-center"
                        style={{ backgroundColor: brandTintRecipe.basePaint.hex }}
                      >
                        <PaintBottleImg
                          brand={brandTintRecipe.basePaint.brand}
                          code={brandTintRecipe.basePaint.code}
                          className="w-full h-full object-contain p-0.5 bg-white/90"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-emerald-800 dark:text-emerald-200 truncate">
                          🧴 {brandTintRecipe.basePaint.brandZh} {brandTintRecipe.basePaint.code} {brandTintRecipe.basePaint.name}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-emerald-700/85 dark:text-emerald-300/85 mt-0.5">
                          原瓶色 {brandTintRecipe.basePaint.hex} · ΔE {brandTintRecipe.deltaE}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-extrabold text-emerald-900 dark:text-emerald-100 leading-snug">
                      {brandTintRecipe.spokenTip}
                    </div>
                  </div>
                ) : (
                  /* 情况 2：需要提亮 / 压暗 / 降纯微调 (ΔE > 2.2) */
                  <>
                    {/* 混合比例进度条 */}
                    <div className="bp-swatch h-3 w-full rounded-full overflow-hidden flex border border-black/10 dark:border-white/10">
                      <div
                        style={{
                          width: `${brandTintRecipe.basePct}%`,
                          backgroundColor: brandTintRecipe.basePaint.hex,
                        }}
                        title={`主漆基底 ${brandTintRecipe.basePct}%`}
                        className="h-full transition-all duration-200"
                      />
                      {brandTintRecipe.modifier && (
                        <div
                          style={{
                            width: `${brandTintRecipe.modifier.pct}%`,
                            backgroundColor: brandTintRecipe.modifier.hex,
                          }}
                          title={`微调补正 ${brandTintRecipe.modifier.pct}%`}
                          className="h-full transition-all duration-200"
                        />
                      )}
                    </div>

                    {/* 主基底油漆槽 + 微调添加剂槽 */}
                    <div className="space-y-1.5">
                      <div className="bp-subcard flex items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-950/60 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="bp-swatch w-7 h-7 rounded-md border border-black/15 shrink-0 bg-white overflow-hidden flex items-center justify-center"
                            style={{ backgroundColor: brandTintRecipe.basePaint.hex }}
                          >
                            <PaintBottleImg
                              brand={brandTintRecipe.basePaint.brand}
                              code={brandTintRecipe.basePaint.code}
                              className="w-full h-full object-contain p-0.5 bg-white/90"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                              🧴 主漆基底：【{brandTintRecipe.basePaint.brandZh} {brandTintRecipe.basePaint.code} {brandTintRecipe.basePaint.name}】
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              原瓶色 {brandTintRecipe.basePaint.hex}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-slate-900 dark:text-white">
                            {brandTintRecipe.basePct}%
                          </div>
                          <div className="text-[10px] font-mono font-bold text-accent">
                            约 {brandTintRecipe.baseDrops} 滴
                          </div>
                        </div>
                      </div>

                      {brandTintRecipe.modifier && (
                        <div className="bp-subcard flex items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-950/60 px-2.5 py-2 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="bp-dot w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 shrink-0 shadow-2xs"
                              style={{ backgroundColor: brandTintRecipe.modifier.hex }}
                            />
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-800 dark:text-slate-100 truncate">
                                ➕ 微调补正：加入【{brandTintRecipe.modifier.name}】
                              </div>
                              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                作用：{brandTintRecipe.modifier.roleLabel}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-black text-slate-900 dark:text-white">
                              {brandTintRecipe.modifier.pct}%
                            </div>
                            <div className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                              约 {brandTintRecipe.modifier.drops} 滴
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 混合预览零接缝对比条 (原瓶直喷色 vs 滴入微调后的目标色) */}
                    <div className="bp-swatch relative grid grid-cols-2 h-11 rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700">
                      <div
                        className="px-2.5 py-1 flex items-center justify-between text-[10px] font-bold"
                        style={{
                          backgroundColor: brandTintRecipe.basePaint.hex,
                          color:
                            getPerceivedLuminance(
                              hexToRgb(brandTintRecipe.basePaint.hex).r,
                              hexToRgb(brandTintRecipe.basePaint.hex).g,
                              hexToRgb(brandTintRecipe.basePaint.hex).b
                            ) <= 60
                              ? '#FFF'
                              : '#0F172A',
                        }}
                      >
                        <span>🧴 原瓶直喷色</span>
                        <span className="font-mono">{brandTintRecipe.basePaint.hex}</span>
                      </div>
                      <div
                        className="px-2.5 py-1 flex items-center justify-between text-[10px] font-bold"
                        style={{
                          backgroundColor: brandTintRecipe.targetHex,
                          color: activeInspectNode.perceivedL <= 60 ? '#FFF' : '#0F172A',
                        }}
                      >
                        <span>✨ 微调后目标色</span>
                        <span className="font-mono">{brandTintRecipe.effectTag}</span>
                      </div>
                    </div>

                    {/* 傻瓜式滴数补正口诀 */}
                    <div className="bp-dashed-box p-2.5 rounded-xl bg-accent/8 dark:bg-accent/15 border border-accent/20 dark:border-accent/30 text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-snug">
                      {brandTintRecipe.spokenTip}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* 专业模式：色母从零混色配方 */
              <>
                {/* 比例条 */}
                <div className="bp-swatch h-3 w-full rounded-full overflow-hidden flex border border-black/10 dark:border-white/10">
                  {pigmentRecipe.pigments.map((p, idx) => (
                    <div
                      key={idx}
                      style={{ width: `${p.pct}%`, backgroundColor: p.color }}
                      title={`${p.name}: ${p.pct}%`}
                      className="h-full transition-all duration-200"
                    />
                  ))}
                </div>

                {/* 明细清单 */}
                <div className="space-y-1.5 pt-0.5">
                  {pigmentRecipe.pigments.map((p, idx) => (
                    <div
                      key={idx}
                      className="bp-subcard flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="bp-dot w-3 h-3 rounded-full border border-black/10 dark:border-white/20 shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{p.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{p.pct}%</span>
                    </div>
                  ))}
                </div>

                <div className="bp-dashed-box p-2.5 rounded-xl bg-accent/8 dark:bg-accent/15 border border-accent/20 dark:border-accent/30 text-[11px] text-slate-700 dark:text-slate-200 leading-snug flex gap-2">
                  <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span>{pigmentRecipe.actionTip}</span>
                </div>
              </>
            )}
          </div>

          {/* 卡片 3：灵感色卡收藏 */}
          <div className="bp-subcard-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold text-slate-400">已收藏变体 ({savedSwatches.length})</span>
              <button
                onClick={() => handleCopy(savedSwatches.join(', '))}
                className="text-[11px] text-accent dark:text-accent-light hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                <Copy className="w-3 h-3" />
                <span>复制全部</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {savedSwatches.map((hex) => (
                <div
                  key={hex}
                  className="bp-pill flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800"
                >
                  <button
                    onClick={() => setBaseHex(hex)}
                    title="设为基准色"
                    className="bp-dot w-3.5 h-3.5 rounded border border-black/10 dark:border-white/20"
                    style={{ backgroundColor: hex }}
                  />
                  <button onClick={() => handleCopy(hex)} className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                    {hex}
                  </button>
                  <button onClick={() => toggleSaveSwatch(hex)} className="text-slate-400 hover:text-rose-500">
                    <Trash className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 供 Tab 3 涂装工程详情页「指派油漆详情」复用的模块 A：明度与纯度信息卡片
// ==========================================
export const LightnessAndChromaModule: React.FC<{
  hex: string;
  lang: Language;
  onSelectStepHex?: (stepHex: string) => void;
}> = ({ hex, onSelectStepHex }) => {
  const cleanHex = (hex || '#3B6EE4').toUpperCase();
  const rgb = hexToRgb(cleanHex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const probe = oklchToRgbGamutMapped(oklch.l, 100, oklch.h);
  const normSat = clamp(Math.round((oklch.c / Math.max(0.01, probe.maxChroma)) * 100), 0, 100);
  const perceivedL = Math.round(oklch.l);

  const lSteps = [90, 78, 66, 54, 42, 30, 18];
  const sSteps = [0, 16, 32, 50, 66, 82, 98];

  const lightnessStrip = lSteps.map((l) => {
    const mapped = oklchToRgbGamutMapped(l, normSat, oklch.h);
    return {
      l,
      hex: rgbToHex(mapped.r, mapped.g, mapped.b),
      isClosest: Math.abs(l - perceivedL) <= 6,
    };
  });

  const chromaStrip = sSteps.map((s) => {
    const mapped = oklchToRgbGamutMapped(perceivedL, s, oklch.h);
    return {
      s,
      hex: rgbToHex(mapped.r, mapped.g, mapped.b),
      isClosest: Math.abs(s - normSat) <= 8,
    };
  });

  return (
    <div className="bp-subcard-lg rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="bp-badge flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400">
            <SquaresFour className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white">
              明度与纯度信息卡片 (OKLCH 感知空间)
            </h4>
            <p className="text-[10px] text-slate-400">
              色相 H {Math.round(hsl.h)}° · 等效灰阶明度 L {perceivedL}% · 相对纯度 S {normSat}%
            </p>
          </div>
        </div>
        <span className="bp-badge font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
          {cleanHex}
        </span>
      </div>

      {/* 7-Step Lightness Ladder */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Sun className="h-3.5 w-3.5 text-amber-500" />
            <span>等纯度 7 阶明度梯度 (高光 → 基准 → 阴影)</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">锁定 S={normSat}%</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 pr-1 pb-1">
          {lightnessStrip.map((item) => {
            const lightText = item.l <= 54;
            return (
              <button
                key={item.l}
                type="button"
                onClick={() => onSelectStepHex?.(item.hex)}
                style={{ backgroundColor: item.hex }}
                className={`bp-matrix-cell h-14 rounded-xl p-1.5 flex flex-col justify-between text-left transition ${
                  item.isClosest
                    ? 'bp-matrix-cell-active ring-2 ring-indigo-500 scale-[1.03] shadow-sm z-10'
                    : 'hover:scale-[1.02]'
                }`}
                title={`L${item.l}%: ${item.hex}`}
              >
                <span
                  className={`text-[9px] font-mono font-bold ${
                    lightText ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  L{item.l}
                </span>
                <span
                  className={`text-[8.5px] font-mono font-bold truncate ${
                    lightText ? 'text-white/90' : 'text-slate-900/90'
                  }`}
                >
                  {item.hex}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 7-Step Chroma Ladder */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <Drop className="h-3.5 w-3.5 text-sky-500" />
            <span>等明度 7 阶纯度梯度 (消色灰 → 鲜艳满纯)</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">锁定 L={perceivedL}%</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 pr-1 pb-1">
          {chromaStrip.map((item) => {
            const lightText = perceivedL <= 54;
            return (
              <button
                key={item.s}
                type="button"
                onClick={() => onSelectStepHex?.(item.hex)}
                style={{ backgroundColor: item.hex }}
                className={`bp-matrix-cell h-14 rounded-xl p-1.5 flex flex-col justify-between text-left transition ${
                  item.isClosest
                    ? 'bp-matrix-cell-active ring-2 ring-sky-500 scale-[1.03] shadow-sm z-10'
                    : 'hover:scale-[1.02]'
                }`}
                title={`S${item.s}%: ${item.hex}`}
              >
                <span
                  className={`text-[9px] font-mono font-bold ${
                    lightText ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {item.s === 0 ? '纯灰' : `S${item.s}`}
                </span>
                <span
                  className={`text-[8.5px] font-mono font-bold truncate ${
                    lightText ? 'text-white/90' : 'text-slate-900/90'
                  }`}
                >
                  {item.hex}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChromaStudioPanel;
