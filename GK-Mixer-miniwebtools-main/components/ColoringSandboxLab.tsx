import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Palette as PaletteIcon } from "@phosphor-icons/react";
import { CatalogPaint, FloatingSwatchNode, Language, PaintProject, PartCanvas, Theme } from "../types";
import { FEATURED_BRANDS, loadPaintCatalog, localizedBrand, nearestCatalogPaintWithDeltaE } from "../utils/paintCatalog";
import { inferStepsFromNodes } from "../utils/projectSharing";
import {
  UIStyle,
  THEME_SYNC_EVENT,
  loadUIStyle,
} from "../utils/accentTheme";
import {
  FillBuffers,
  GrayCache,
  buildGrayCache,
  buildHybridBarrierMask,
  buildLuminanceMap,
  buildXdogIntensity,
  cannyHysteresis,
  computeCannyNms,
  computeRegionBaseLuminance,
  computeXdogBlurs,
  XdogBlurCache,
  xdogLineLayer,
  createFillBuffers,
  deriveImpcatTriad,
  extractSoftLineArt,
  floodFillRegion,
  hexToRgbTuple,
  packRGBA,
  paintRegionIntrinsicShading,
} from "../utils/coloringEngine";

// ============================================================================
// GKMixer 4-Dimensional Color Engine Constants & HSL <-> HEX Helpers
// ============================================================================
const NEUTRAL_GRAYSCALE_10: { hex: string; label: string; lLabel: string }[] = [
  { hex: "#18181B", label: "渊黑", lLabel: "L10%" },
  { hex: "#27272A", label: "轮胎黑", lLabel: "L16%" },
  { hex: "#3F3F46", label: "骨架深灰", lLabel: "L26%" },
  { hex: "#52525B", label: "机械铁灰", lLabel: "L34%" },
  { hex: "#71717A", label: "水补土灰", lLabel: "L46%" },
  { hex: "#8E8E99", label: "标准中灰", lLabel: "L58%" },
  { hex: "#A1A1AA", label: "冷调浅灰", lLabel: "L65%" },
  { hex: "#D4D4D8", label: "浅装甲灰", lLabel: "L83%" },
  { hex: "#E4E4E7", label: "高达灰白", lLabel: "L90%" },
  { hex: "#F8FAFC", label: "消光纯白", lLabel: "L98%" },
];

const MECHA_HUE_ANCHORS: { label: string; hue: number; previewHex: string }[] = [
  { label: "赤红 0°", hue: 0, previewHex: "#E11D48" },
  { label: "工程橙 30°", hue: 30, previewHex: "#EA580C" },
  { label: "天线黄 50°", hue: 50, previewHex: "#EAB308" },
  { label: "扎古绿 120°", hue: 120, previewHex: "#16A34A" },
  { label: "吉姆青 175°", hue: 175, previewHex: "#0D9488" },
  { label: "高达蓝 220°", hue: 220, previewHex: "#2563EB" },
  { label: "海牛紫 260°", hue: 260, previewHex: "#7968D8" },
  { label: "妖艳粉 320°", hue: 320, previewHex: "#DB2777" },
];

const MATRIX_LIGHTNESS_ROWS: { l: number; label: string; shortLabel: string }[] = [
  { l: 85, label: "85% 高光浅色", shortLabel: "L85 高光" },
  { l: 70, label: "70% 明亮色", shortLabel: "L70 明亮" },
  { l: 55, label: "55% 标准主色", shortLabel: "L55 主色" },
  { l: 40, label: "40% 暗部阴影色", shortLabel: "L40 阴影" },
  { l: 25, label: "25% 深邃重色", shortLabel: "L25 重色" },
];

const MATRIX_SATURATION_COLS: { s: number; label: string; shortLabel: string }[] = [
  { s: 20, label: "20% 低饱灰调", shortLabel: "S20 灰调" },
  { s: 40, label: "40% 军模微灰", shortLabel: "S40 军模" },
  { s: 65, label: "65% 柔和标准", shortLabel: "S65 标准" },
  { s: 85, label: "85% 高饱鲜明", shortLabel: "S85 鲜明" },
  { s: 100, label: "100% 纯正高彩", shortLabel: "S100 高彩" },
];

type HarmonyMode = "analogous" | "complementary" | "split" | "triadic";

function hslToHex(hDeg: number, sPct: number, lPct: number): string {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const s = Math.max(0, Math.min(100, sPct)) / 100;
  const l = Math.max(0, Math.min(100, lPct)) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (s === 0) {
    r = l;
    g = l;
    b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) =>
    Math.round(Math.max(0, Math.min(255, x * 255)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r255, g255, b255] = hexToRgbTuple(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
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
  return {
    h: Math.round(h * 360) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// ============================================================================
// Viewport focus (uploaded images only → always fit the full image)
// ============================================================================
export type CropPresetKey = "full";

const CROP_PRESETS: { key: CropPresetKey; label: string; box: [number, number, number, number] }[] = [
  { key: "full", label: "整页", box: [0.0, 0.0, 1.0, 1.0] },
];

// Working-resolution policy: small sources are upscaled (high-quality) for smoother
// anti-aliased extraction; everything is capped for 60fps interaction.
const WORK_MAX_DIM = 2048;
const UPSCALE_BELOW_DIM = 1400;

// ============================================================================
// Types
// ============================================================================
interface ColoredRegion {
  id: number;
  baseHex: string;
  shadeHex: string;
  highlightHex: string;
  /** Median interior luminance L_base ∈ [0.15, 0.92] for 3D Intrinsic Shading Transfer */
  baseLum: number;
  paintName?: string;
  paintBrand?: string;
  paintCode?: string;
  /** Immutable after creation (snapshots share references) */
  pixels: Uint32Array;
}

interface HistorySnapshot {
  regions: Map<number, ColoredRegion>;
  nextRegionId: number;
  /** Copy-on-write reference: never mutated after a snapshot captures it */
  userLineEdits: Int8Array;
  actionLabel: string;
}

interface ViewState {
  scale: number;
  panX: number;
  panY: number;
}

type ActiveTool = "fill" | "select" | "pen" | "eraser" | "lineEraser" | "pan";
/** xdog = SD-ControlNet-style Lineart (XDoG); threshold = soft-threshold line-art for clean scans */
type ExtractionMode = "xdog" | "threshold";
/**
 * flat = 2D pure flat fill (CHROMA)
 * intrinsic = 3D relative luminance shading transfer (CG / Colored Mecha)
 * impcat = 4-layer Shade/Base/Highlight synthesis on grayscale base (impCAT)
 */
type RenderShadingMode = "flat" | "intrinsic" | "impcat";
export type ScenePresetKey = "lineart_card" | "cg_recolor" | "photo_miniature";
type GestureMode = "none" | "fillStroke" | "pan" | "draw" | "pinch";

interface ColoringSandboxLabProps {
  onCloseLab?: () => void;
  lang?: Language;
  theme?: Theme;
  setTheme?: (t: Theme) => void;
  incomingImage?: { url: string; label?: string; token: number } | null;
  onSendColorToMixer?: (hex: string) => void;
  onCreatePaintProject?: (project: PaintProject) => void;
  externalCatalogPaints?: CatalogPaint[];
}

export const ColoringSandboxLab: React.FC<ColoringSandboxLabProps> = ({
  lang = "zh",
  incomingImage,
  onSendColorToMixer,
  onCreatePaintProject,
  externalCatalogPaints,
}) => {
  const brandLang = (lang === "en" || lang === "ja" ? lang : "zh") as "en" | "zh" | "ja";

  const [uiStyle, setUiStyle] = useState<UIStyle>(() => loadUIStyle());
  const isBlueprint = uiStyle === "blueprint";

  useEffect(() => {
    const sync = () => {
      setUiStyle(loadUIStyle());
    };
    window.addEventListener(THEME_SYNC_EVENT, sync);
    return () => window.removeEventListener(THEME_SYNC_EVENT, sync);
  }, []);

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------
  const viewportRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const fillCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectCanvasRef = useRef<HTMLCanvasElement>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [, setScenePreset] = useState<ScenePresetKey>("lineart_card");
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("xdog");
  const [renderMode, setRenderMode] = useState<RenderShadingMode>("flat");
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [imageToken, setImageToken] = useState(0);
  const [statusMessage, setStatusMessage] = useState("请先上传一张图片（线稿 / 官图 / 实拍照片）");
  const [usedRegionsVersion, setUsedRegionsVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedRegionIds, setSelectedRegionIds] = useState<number[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>("fill");
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState<"palette" | "params" | "used" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDesktopPaletteCollapsed, setIsDesktopPaletteCollapsed] = useState(false);
  const [hideCanvasHint, setHideCanvasHint] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("AI 试色方案");
  const [newPartName, setNewPartName] = useState("主外甲试色总成");

  // Algorithm parameters — Visual Lineart Layer (XDoG / Threshold)
  const [lineThreshold, setLineThreshold] = useState(165);
  const [lineSoftness, setLineSoftness] = useState(35);
  const [filterRedStamp, setFilterRedStamp] = useState(true);
  // XDoG Lineart parameters (σ is debounced: blur pyramid ≈100ms; p/ε/φ are a ~50ms pointwise pass)
  const [xdogSigma, setXdogSigma] = useState(1.0);
  const [xdogSigmaApplied, setXdogSigmaApplied] = useState(1.0);
  const [xdogP, setXdogP] = useState(22);
  const [xdogEpsilon, setXdogEpsilon] = useState(0.75);
  const [xdogPhi, setXdogPhi] = useState(2.5);
  const [xdogInkFill, setXdogInkFill] = useState(true);
  const [showXdogAdvanced, setShowXdogAdvanced] = useState(false);

  useEffect(() => {
    if (xdogSigma === xdogSigmaApplied) return;
    const t = window.setTimeout(() => setXdogSigmaApplied(xdogSigma), 140);
    return () => window.clearTimeout(t);
  }, [xdogSigma, xdogSigmaApplied]);

  // Hybrid 3-Barrier Engine parameters
  // Barrier A: XDoG + Canny Union + Morphological Closing
  const [useCannyBarrier, setUseCannyBarrier] = useState(false);
  const [cannyLow, setCannyLow] = useState(26);
  const [cannyHigh, setCannyHigh] = useState(68);
  const [gapCloseRadius, setGapCloseRadius] = useState(1);
  // Barrier B: Source Chroma / Redmean Color Distance Tolerance (0 = off, 26 = CG default)
  const [fillTolerance, setFillTolerance] = useState(0);
  // Barrier C: 1px/2px Neighbor Local Gradient Step Barrier (0 = off, 15 = CG/Photo default)
  const [localStepThreshold, setLocalStepThreshold] = useState(0);
  // Edge absorb: extra color-guided rings that eat fattened wall pixels so thin parts fill to their edges
  const [edgeAbsorb, setEdgeAbsorb] = useState(0);

  const [lineOpacity, setLineOpacity] = useState(92);
  const [brushRadius, setBrushRadius] = useState(3);
  const [paperBgStyle, setPaperBgStyle] = useState<"source" | "white">("source");
  const [showAlgorithmPanel, setShowAlgorithmPanel] = useState(true);

  /** Applies one of the 3 One-Click Scene Presets */
  const applyScenePreset = useCallback((preset: ScenePresetKey, quiet = false) => {
    setScenePreset(preset);
    if (preset === "lineart_card") {
      setExtractionMode("xdog");
      setXdogSigma(1.0);
      setXdogSigmaApplied(1.0);
      setXdogP(22);
      setXdogEpsilon(0.75);
      setXdogPhi(2.5);
      setXdogInkFill(true);
      setFilterRedStamp(true);
      setUseCannyBarrier(false);
      setGapCloseRadius(1);
      setFillTolerance(0);
      setLocalStepThreshold(0);
      setEdgeAbsorb(0);
      setRenderMode("flat");
      setLineOpacity(92);
      if (!quiet) {
        setStatusMessage("已启用「📄 黑白线稿/试色卡」预设：XDoG 线框阻断 + 2D 纯色平涂 + 1.5px 抗锯齿下潜");
      }
    } else if (preset === "cg_recolor") {
      setExtractionMode("xdog");
      setXdogSigma(0.9);
      setXdogSigmaApplied(0.9);
      setXdogP(20);
      setXdogEpsilon(0.78);
      setXdogPhi(2.5);
      setXdogInkFill(false);
      setFilterRedStamp(false);
      setUseCannyBarrier(true);
      setCannyLow(26);
      setCannyHigh(68);
      setGapCloseRadius(1);
      setFillTolerance(26);
      setLocalStepThreshold(15);
      setEdgeAbsorb(3);
      setRenderMode("intrinsic");
      setLineOpacity(35);
      if (!quiet) {
        setStatusMessage(
          "已启用「🤖 彩色官图/成品改色」预设：三合一复合阻断 (色差26 + 局部梯度15) + 3D 相对光影保留 + 35% 视觉线框"
        );
      }
    } else if (preset === "photo_miniature") {
      setExtractionMode("xdog");
      setXdogSigma(1.1);
      setXdogSigmaApplied(1.1);
      setXdogP(24);
      setXdogEpsilon(0.75);
      setXdogPhi(2.5);
      setXdogInkFill(false);
      setFilterRedStamp(false);
      setUseCannyBarrier(true);
      setCannyLow(24);
      setCannyHigh(62);
      setGapCloseRadius(2);
      setFillTolerance(30);
      setLocalStepThreshold(15);
      setEdgeAbsorb(4);
      setRenderMode("impcat");
      setLineOpacity(65);
      if (!quiet) {
        setStatusMessage("已启用「🗿 素组灰模/实拍照片」预设：XDoG+Canny 2px 闭运算焊死断口 + 局部梯度阻断 + impCAT 光影");
      }
    }
  }, []);

  // Active paint & impCAT triad
  const [activeHex, setActiveHex] = useState("#7968D8");
  const [activePaintMeta, setActivePaintMeta] = useState<{ brand?: string; code?: string; name?: string }>({
    brand: "Custom",
    code: "HEX",
    name: "海牛紫 L55·S65",
  });
  const [selectedHue, setSelectedHue] = useState<number>(260);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ l: number; s: number }>({ l: 55, s: 65 });
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>("analogous");
  const [copiedHex, setCopiedHex] = useState(false);
  const [isFocusAnimating, setIsFocusAnimating] = useState(false);
  const [customShadeHex, setCustomShadeHex] = useState<string | null>(null);
  const [customHighlightHex, setCustomHighlightHex] = useState<string | null>(null);

  const activeTriad = useMemo(() => {
    const auto = deriveImpcatTriad(activeHex);
    return {
      baseHex: auto.baseHex,
      shadeHex: customShadeHex || auto.shadeHex,
      highlightHex: customHighlightHex || auto.highlightHex,
    };
  }, [activeHex, customShadeHex, customHighlightHex]);

  // Paint database
  const [catalogPaints, setCatalogPaints] = useState<CatalogPaint[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogBrandFilter, setCatalogBrandFilter] = useState("ALL");

  const featuredBrandsSet = useMemo(() => new Set(FEATURED_BRANDS), []);

  const findClosestCatalogPaint = useCallback(
    (hex: string): { paint: CatalogPaint; deltaE: number; brandZh: string } | null => {
      if (!catalogPaints.length) return null;
      const featured = nearestCatalogPaintWithDeltaE(catalogPaints, hex, featuredBrandsSet, true);
      const all = nearestCatalogPaintWithDeltaE(catalogPaints, hex, undefined, true);
      const chosen =
        featured && (!all || featured.deltaE <= all.deltaE + 0.8 || featured.deltaE <= 2.5)
          ? featured
          : all || featured;
      if (!chosen) return null;
      return {
        paint: chosen.paint,
        deltaE: chosen.deltaE,
        brandZh: localizedBrand(chosen.paint.brand, brandLang),
      };
    },
    [catalogPaints, featuredBrandsSet, brandLang]
  );

  const activeNearestMatch = useMemo(
    () => findClosestCatalogPaint(activeHex),
    [findClosestCatalogPaint, activeHex]
  );

  const matrixGridSwatches = useMemo(
    () =>
      MATRIX_LIGHTNESS_ROWS.map((row) => ({
        ...row,
        cells: MATRIX_SATURATION_COLS.map((col) => ({
          l: row.l,
          s: col.s,
          rowLabel: row.shortLabel,
          colLabel: col.shortLabel,
          hex: hslToHex(selectedHue, col.s, row.l),
        })),
      })),
    [selectedHue]
  );

  const harmonySwatches = useMemo(() => {
    const hsl = hexToHsl(activeHex);
    const baseH = hsl.s < 6 ? selectedHue : hsl.h;
    const baseS = hsl.s < 12 ? 68 : hsl.s;
    const baseL = Math.max(28, Math.min(76, hsl.l));
    const clampPct = (v: number, lo = 15, hi = 90) => Math.max(lo, Math.min(hi, Math.round(v)));

    if (harmonyMode === "analogous") {
      return [
        { role: "高光浅阶", tag: "L+18", hex: hslToHex(baseH, clampPct(baseS - 12, 18, 95), clampPct(baseL + 18, 22, 88)) },
        { role: "邻近冷阶", tag: "-25°", hex: hslToHex((baseH - 25 + 360) % 360, baseS, baseL) },
        { role: "当前主色", tag: "0°", hex: activeHex.toUpperCase() },
        { role: "邻近暖阶", tag: "+25°", hex: hslToHex((baseH + 25) % 360, baseS, baseL) },
        { role: "暗部深阶", tag: "L-18", hex: hslToHex(baseH, clampPct(baseS + 8, 20, 96), clampPct(baseL - 18, 18, 82)) },
      ];
    }
    if (harmonyMode === "complementary") {
      const compH = (baseH + 180) % 360;
      return [
        { role: "主甲亮色", tag: "0°亮", hex: hslToHex(baseH, clampPct(baseS - 10, 20, 95), clampPct(baseL + 15, 25, 86)) },
        { role: "当前主色", tag: "0°主", hex: activeHex.toUpperCase() },
        { role: "主甲暗部", tag: "0°暗", hex: hslToHex(baseH, clampPct(baseS + 6, 20, 95), clampPct(baseL - 15, 18, 80)) },
        { role: "互补撞色", tag: "+180°", hex: hslToHex(compH, Math.max(72, baseS), 56) },
        { role: "撞色高光", tag: "+180°亮", hex: hslToHex(compH, Math.max(60, baseS - 10), 74) },
      ];
    }
    if (harmonyMode === "split") {
      const split1 = (baseH + 150) % 360;
      const split2 = (baseH + 210) % 360;
      return [
        { role: "当前主色", tag: "0°主", hex: activeHex.toUpperCase() },
        { role: "主色深层", tag: "0°暗", hex: hslToHex(baseH, baseS, clampPct(baseL - 16, 18, 78)) },
        { role: "分裂副色", tag: "+150°", hex: hslToHex(split1, Math.max(62, baseS - 6), 55) },
        { role: "警示点缀", tag: "+210°", hex: hslToHex(split2, Math.max(76, baseS), 58) },
        { role: "中和装甲灰", tag: "低饱", hex: hslToHex(baseH, 16, 72) },
      ];
    }
    // triadic
    const tri1 = (baseH + 120) % 360;
    const tri2 = (baseH + 240) % 360;
    return [
      { role: "第一主色", tag: "0°", hex: activeHex.toUpperCase() },
      { role: "第二主色", tag: "+120°", hex: hslToHex(tri1, Math.max(66, baseS), 54) },
      { role: "第三主色", tag: "+240°", hex: hslToHex(tri2, Math.max(66, baseS), 54) },
      { role: "三角浅阶", tag: "+120°亮", hex: hslToHex(tri1, 46, 76) },
      { role: "压阵骨架灰", tag: "骨架", hex: hslToHex(baseH, 14, 32) },
    ];
  }, [activeHex, harmonyMode, selectedHue]);

  useEffect(() => {
    if (externalCatalogPaints && externalCatalogPaints.length > 0) {
      setCatalogPaints(externalCatalogPaints);
      return;
    }
    loadPaintCatalog()
      .then((list) => Array.isArray(list) && setCatalogPaints(list))
      .catch((err) => console.error("Failed to load paint catalog in sandbox:", err));
  }, [externalCatalogPaints]);

  const filteredCatalogPaints = useMemo(() => {
    const tokens = catalogSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out: CatalogPaint[] = [];
    for (const p of catalogPaints) {
      if (catalogBrandFilter !== "ALL" && p.brand !== catalogBrandFilter) continue;
      if (tokens.length > 0) {
        const hay = `${p.brand} ${localizedBrand(p.brand, "zh")} ${p.code} ${p.name} ${p.hex}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) continue;
      }
      out.push(p);
      if (out.length >= 60) break;
    }
    return out;
  }, [catalogPaints, catalogSearch, catalogBrandFilter]);

  // ---------------------------------------------------------------------------
  // Pixel buffers (refs — never trigger React renders)
  // ---------------------------------------------------------------------------
  const dimsRef = useRef({ w: 0, h: 0, workFactor: 1 });
  const srcRgbaRef = useRef<Uint8ClampedArray | null>(null);
  const grayCacheRef = useRef<GrayCache | null>(null);
  const lumRef = useRef<Float32Array | null>(null);
  const xdogIntensityRef = useRef<{ token: number; filter: boolean; I: Float32Array } | null>(null);
  const xdogBlurRef = useRef<{ token: number; filter: boolean; cache: XdogBlurCache } | null>(null);
  const cannyNmsRef = useRef<{ token: number; nms: Float32Array } | null>(null);
  const baseLineAlphaRef = useRef<Uint8Array | null>(null);
  const baseLineBinaryRef = useRef<Uint8Array | null>(null);
  const lineAlphaRef = useRef<Uint8Array | null>(null);
  const boundaryRef = useRef<Uint8Array | null>(null);
  const userLineEditsRef = useRef<Int8Array | null>(null);
  const regionMapRef = useRef<Int32Array | null>(null);
  const regionsRef = useRef<Map<number, ColoredRegion>>(new Map());
  const nextRegionIdRef = useRef(1);
  const fillBuffersRef = useRef<FillBuffers | null>(null);

  const lineImageRef = useRef<{ img: ImageData; u32: Uint32Array } | null>(null);
  const fillImageRef = useRef<{ img: ImageData; u32: Uint32Array } | null>(null);
  const selectImageRef = useRef<{ img: ImageData; u32: Uint32Array } | null>(null);

  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);

  // ---------------------------------------------------------------------------
  // Viewport (transform applied directly to DOM — zero React re-render on pan/zoom)
  // ---------------------------------------------------------------------------
  const viewRef = useRef<ViewState>({ scale: 1, panX: 0, panY: 0 });
  const transitionTimerRef = useRef<number | null>(null);
  const activeCropRef = useRef<CropPresetKey>("full");
  const spaceRef = useRef(false);

  const getViewportSize = () => {
    const vp = viewportRef.current;
    return { vw: vp?.clientWidth || 800, vh: vp?.clientHeight || 600 };
  };

  const getFitScale = useCallback(() => {
    const { w, h } = dimsRef.current;
    const { vw, vh } = getViewportSize();
    if (w <= 0 || h <= 0) return 1;
    return Math.min(vw / w, vh / h) * 0.9;
  }, []);

  const getScaleLimits = useCallback(() => {
    const { w, h, workFactor } = dimsRef.current;
    const { vw, vh } = getViewportSize();
    if (w <= 0 || h <= 0) return { min: 0.1, max: 8 };
    const fitFull = Math.min(vw / w, vh / h) * 0.92;
    // 0.25x ~ 5x relative to the ORIGINAL source pixels (workFactor = work / source)
    return {
      min: Math.min(fitFull * 0.6, 0.25 / workFactor),
      max: Math.max(fitFull * 6, 5 / workFactor),
    };
  }, []);

  /** Safe symmetric bounding-box clamping: prevents min > max inversion and NaN lockups at any scale. */
  function clampViewport(
    panX: number,
    panY: number,
    scale: number,
    imgW: number,
    imgH: number,
    vw: number,
    vh: number
  ) {
    if (!imgW || !imgH || !vw || !vh || isNaN(panX) || isNaN(panY)) {
      return { x: 0, y: 0 };
    }
    const iw = imgW * scale;
    const ih = imgH * scale;
    // Keep at least 30% visible safety margin and auto-correct min > max when iw <= vw:
    const boundX1 = vw * 0.7 - iw;
    const boundX2 = vw * 0.3;
    const minX = Math.min(boundX1, boundX2);
    const maxX = Math.max(boundX1, boundX2);

    const boundY1 = vh * 0.7 - ih;
    const boundY2 = vh * 0.3;
    const minY = Math.min(boundY1, boundY2);
    const maxY = Math.max(boundY1, boundY2);

    return {
      x: Math.min(Math.max(panX, minX), maxX),
      y: Math.min(Math.max(panY, minY), maxY),
    };
  }

  const clampView = useCallback((v: ViewState): ViewState => {
    const { w, h } = dimsRef.current;
    const { vw, vh } = getViewportSize();
    const { min, max } = getScaleLimits();
    const rawScale = Number.isFinite(v.scale) ? v.scale : 1;
    const scale = Math.min(Math.max(rawScale, min), max);
    const clamped = clampViewport(v.panX, v.panY, scale, w, h, vw, vh);
    return { scale, panX: clamped.x, panY: clamped.y };
  }, [getScaleLimits]);

  const applyView = useCallback(
    (next: ViewState, animate = false) => {
      const v = clampView(next);
      viewRef.current = v;
      const el = stackRef.current;
      if (el) {
        if (transitionTimerRef.current !== null) {
          window.clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = null;
        }
        el.style.transition = animate ? "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";
        el.style.transform = `translate3d(${v.panX}px, ${v.panY}px, 0) scale(${v.scale})`;
        if (animate) {
          transitionTimerRef.current = window.setTimeout(() => {
            if (stackRef.current) stackRef.current.style.transition = "none";
            transitionTimerRef.current = null;
          }, 300);
        }
      }
      if (zoomLabelRef.current) {
        zoomLabelRef.current.textContent = `${Math.round(v.scale * dimsRef.current.workFactor * 100)}%`;
      }
    },
    [clampView]
  );

  /** Focal-point zoom: the image pixel under (clientX, clientY) never moves. */
  const zoomAtClient = useCallback(
    (clientX: number, clientY: number, targetScale: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const { scale, panX, panY } = viewRef.current;
      const { min, max } = getScaleLimits();
      const nextScale = Math.min(Math.max(targetScale, min), max);
      const ratio = nextScale / scale;
      applyView({
        scale: nextScale,
        panX: px - (px - panX) * ratio,
        panY: py - (py - panY) * ratio,
      });
    },
    [applyView, getScaleLimits]
  );

  const zoomAtCenter = (factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    zoomAtClient(rect.left + rect.width / 2, rect.top + rect.height / 2, viewRef.current.scale * factor);
  };

  const focusRegion = useCallback(
    (cropKey: CropPresetKey, animate = true) => {
      const { w, h } = dimsRef.current;
      if (w <= 0 || h <= 0) return;
      const preset = CROP_PRESETS.find((p) => p.key === cropKey) || CROP_PRESETS[0];
      const [bx, by, bw, bh] = preset.box;
      const { vw, vh } = getViewportSize();
      const { min, max } = getScaleLimits();
      const scale = Math.min(Math.max(Math.min((vw * 0.9) / (w * bw), (vh * 0.9) / (h * bh)), min), max);
      const cx = w * (bx + bw / 2);
      const cy = h * (by + bh / 2);
      applyView({ scale, panX: vw / 2 - cx * scale, panY: vh / 2 - cy * scale }, animate);
    },
    [applyView, getScaleLimits]
  );

  const clientToImage = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const vp = viewportRef.current;
    const { w, h } = dimsRef.current;
    if (!vp || w <= 0) return null;
    const rect = vp.getBoundingClientRect();
    const { scale, panX, panY } = viewRef.current;
    const x = Math.floor((clientX - rect.left - panX) / scale);
    const y = Math.floor((clientY - rect.top - panY) / scale);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    return { x, y };
  };

  // Keep image inside the viewport when the container resizes
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => applyView(viewRef.current));
    ro.observe(vp);
    return () => ro.disconnect();
  }, [applyView]);

  // ---------------------------------------------------------------------------
  // Layer renderers (Uint32Array pixel views)
  // ---------------------------------------------------------------------------
  const renderBaseLayer = useCallback(() => {
    const canvas = baseCanvasRef.current;
    const src = srcRgbaRef.current;
    const lum = lumRef.current;
    const { w, h } = dimsRef.current;
    if (!canvas || !src || !lum || w <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const u32 = new Uint32Array(img.data.buffer);
    const n = w * h;
    if (renderMode === "impcat") {
      for (let i = 0; i < n; i++) {
        const v = (lum[i] * 255) | 0;
        u32[i] = packRGBA(v, v, v, 255);
      }
    } else if (paperBgStyle === "white") {
      u32.fill(packRGBA(255, 255, 255, 255));
    } else {
      img.data.set(src);
    }
    ctx.putImageData(img, 0, 0);
  }, [renderMode, paperBgStyle]);

  const paintRegionInto = useCallback(
    (region: ColoredRegion, u32: Uint32Array, mode: RenderShadingMode) => {
      const lum = lumRef.current;
      const px = region.pixels;
      const [br, bg, bb] = hexToRgbTuple(region.baseHex);
      if (mode === "flat" || !lum) {
        const c = packRGBA(br, bg, bb, 255);
        for (let i = 0; i < px.length; i++) u32[px[i]] = c;
        return;
      }
      if (mode === "intrinsic") {
        paintRegionIntrinsicShading(
          px,
          region.baseHex,
          region.baseLum || 0.55,
          lum,
          lineAlphaRef.current,
          u32
        );
        return;
      }
      const [sr, sg, sb] = hexToRgbTuple(region.shadeHex);
      const [hr, hg, hb] = hexToRgbTuple(region.highlightHex);
      // impCAT: L<0.5 → lerp(shade, base, 2L) ; L≥0.5 → lerp(base, highlight, 2(L−0.5))
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        const L = lum[p];
        let r: number;
        let g: number;
        let b: number;
        if (L < 0.5) {
          const t = L * 2;
          r = sr + (br - sr) * t;
          g = sg + (bg - sg) * t;
          b = sb + (bb - sb) * t;
        } else {
          const t = (L - 0.5) * 2;
          r = br + (hr - br) * t;
          g = bg + (hg - bg) * t;
          b = bb + (hb - bb) * t;
        }
        u32[p] = packRGBA(r | 0, g | 0, b | 0, 255);
      }
    },
    []
  );

  const renderFillFull = useCallback(() => {
    const canvas = fillCanvasRef.current;
    const buf = fillImageRef.current;
    if (!canvas || !buf) return;
    buf.u32.fill(0);
    for (const reg of regionsRef.current.values()) paintRegionInto(reg, buf.u32, renderMode);
    canvas.getContext("2d")?.putImageData(buf.img, 0, 0);
  }, [paintRegionInto, renderMode]);

  /** Incremental paint of one region with a dirty-rect upload. */
  const renderFillRegion = useCallback(
    (region: ColoredRegion) => {
      const canvas = fillCanvasRef.current;
      const buf = fillImageRef.current;
      const { w } = dimsRef.current;
      if (!canvas || !buf || region.pixels.length === 0) return;
      paintRegionInto(region, buf.u32, renderMode);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -1;
      let maxY = -1;
      const px = region.pixels;
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        const y = (p / w) | 0;
        const x = p - y * w;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      canvas
        .getContext("2d")
        ?.putImageData(buf.img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    },
    [paintRegionInto, renderMode]
  );

  const renderSelectionOverlay = useCallback(() => {
    const canvas = selectCanvasRef.current;
    const buf = selectImageRef.current;
    const regMap = regionMapRef.current;
    const { w, h } = dimsRef.current;
    if (!canvas || !buf || !regMap) return;
    buf.u32.fill(0);
    const edge = packRGBA(0, 230, 255, 250);
    const tint = packRGBA(0, 215, 255, 70);
    for (const id of selectedRegionIds) {
      const reg = regionsRef.current.get(id);
      if (!reg) continue;
      const px = reg.pixels;
      for (let i = 0; i < px.length; i++) {
        const p = px[i];
        if (regMap[p] !== id) continue;
        const y = (p / w) | 0;
        const x = p - y * w;
        const border =
          x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
          regMap[p - 1] !== id || regMap[p + 1] !== id || regMap[p - w] !== id || regMap[p + w] !== id;
        buf.u32[p] = border ? edge : tint;
      }
    }
    canvas.getContext("2d")?.putImageData(buf.img, 0, 0);
  }, [selectedRegionIds]);

  // ---------------------------------------------------------------------------
  // Decoupled Visual Lineart Layer (VisualLineCanvas) & Hybrid Barrier Engine
  // ---------------------------------------------------------------------------
  const computeBaseLines = useCallback(() => {
    const cache = grayCacheRef.current;
    const { w, h } = dimsRef.current;
    if (!cache || w <= 0) return;
    if (extractionMode === "threshold") {
      const layer = extractSoftLineArt(cache, lineThreshold, lineSoftness, filterRedStamp);
      baseLineAlphaRef.current = layer.alpha;
      baseLineBinaryRef.current = layer.binary;
    } else {
      // 1) paper-normalized intensity (per image / filter toggle)
      let ic = xdogIntensityRef.current;
      if (!ic || ic.token !== imageToken || ic.filter !== filterRedStamp) {
        ic = { token: imageToken, filter: filterRedStamp, I: buildXdogIntensity(cache, filterRedStamp) };
        xdogIntensityRef.current = ic;
        xdogBlurRef.current = null;
      }
      // 2) blur pyramid (per σ)
      let bc = xdogBlurRef.current;
      if (!bc || bc.token !== imageToken || bc.filter !== filterRedStamp || bc.cache.sigma !== xdogSigmaApplied) {
        bc = {
          token: imageToken,
          filter: filterRedStamp,
          cache: computeXdogBlurs(ic.I, w, h, xdogSigmaApplied, 1.6),
        };
        xdogBlurRef.current = bc;
      }
      // 3) pointwise XDoG activation + dark-groove ink + AA soften (per p/ε/φ)
      const layer = xdogLineLayer(bc.cache, w, h, {
        p: xdogP,
        epsilon: xdogEpsilon,
        phi: xdogPhi,
        inkFill: xdogInkFill,
      });
      baseLineAlphaRef.current = layer.alpha;
      baseLineBinaryRef.current = layer.binary;
    }
  }, [
    extractionMode,
    lineThreshold,
    lineSoftness,
    filterRedStamp,
    xdogSigmaApplied,
    xdogP,
    xdogEpsilon,
    xdogPhi,
    xdogInkFill,
    imageToken,
  ]);

  const composeLines = useCallback(() => {
    const baseAlpha = baseLineAlphaRef.current;
    const baseBin = baseLineBinaryRef.current;
    const edits = userLineEditsRef.current;
    const lineBuf = lineImageRef.current;
    const canvas = lineCanvasRef.current;
    const cache = grayCacheRef.current;
    const { w, h } = dimsRef.current;
    if (!baseAlpha || !baseBin || !edits || !lineBuf || !canvas || !cache) return;
    const n = w * h;

    // 1. Top Visual Layer (`VisualLineCanvas`): pure XDoG / Soft-Threshold anti-aliased lines + user pen/eraser
    const alpha = new Uint8Array(n);
    const u32 = lineBuf.u32;
    for (let i = 0; i < n; i++) {
      const e = edits[i];
      let a: number;
      if (e > 0) {
        a = Math.max(baseAlpha[i], e * 2);
      } else if (e < 0) {
        a = 0;
      } else {
        a = baseAlpha[i];
      }
      alpha[i] = a;
      u32[i] = a ? packRGBA(25, 25, 30, a) : 0;
    }
    lineAlphaRef.current = alpha;
    canvas.getContext("2d")?.putImageData(lineBuf.img, 0, 0);

    // 2. Underlying Hybrid Barrier A (`edgeBarrierMask`): XDoG binary ∪ Canny skeleton + morphological closing
    let cannyEdges: Uint8Array | null = null;
    if (useCannyBarrier) {
      let cn = cannyNmsRef.current;
      if (!cn || cn.token !== imageToken) {
        cn = { token: imageToken, nms: computeCannyNms(cache.gray, w, h, 1) };
        cannyNmsRef.current = cn;
      }
      cannyEdges = cannyHysteresis(cn.nms, w, h, cannyLow, cannyHigh);
    }
    boundaryRef.current = buildHybridBarrierMask(baseBin, cannyEdges, edits, w, h, gapCloseRadius);
  }, [useCannyBarrier, cannyLow, cannyHigh, gapCloseRadius, imageToken]);

  // rAF-throttled rebuild on parameter change (sliders stay at 60fps)
  const rebuildRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (imageToken === 0) return;
    if (rebuildRafRef.current !== null) cancelAnimationFrame(rebuildRafRef.current);
    rebuildRafRef.current = requestAnimationFrame(() => {
      rebuildRafRef.current = null;
      const t0 = performance.now();
      computeBaseLines();
      composeLines();
      const dt = performance.now() - t0;
      setStatusMessage(`${extractionMode === "xdog" ? "Lineart (XDoG)" : "阈值线稿"} 线框已更新 · ${dt.toFixed(1)}ms`);
    });
    return () => {
      if (rebuildRafRef.current !== null) cancelAnimationFrame(rebuildRafRef.current);
    };
  }, [computeBaseLines, composeLines, imageToken, extractionMode]);

  useEffect(() => {
    if (imageToken === 0) return;
    renderBaseLayer();
    renderFillFull();
  }, [renderBaseLayer, renderFillFull, imageToken]);

  useEffect(() => {
    if (imageToken === 0) return;
    renderSelectionOverlay();
  }, [renderSelectionOverlay, imageToken]);

  // ---------------------------------------------------------------------------
  // Image loading
  // ---------------------------------------------------------------------------
  const loadImageSource = useCallback(
    (
      srcUrl: string,
      opts?: {
        preset?: ScenePresetKey;
        extraction?: ExtractionMode;
        render?: RenderShadingMode;
        crop?: CropPresetKey;
        label?: string;
        inkFill?: boolean;
        autoDetectPreset?: boolean;
      }
    ) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const nw = img.naturalWidth || 1024;
        const nh = img.naturalHeight || 768;
        const maxDim = Math.max(nw, nh);
        const factor =
          maxDim < UPSCALE_BELOW_DIM ? Math.min(2, WORK_MAX_DIM / maxDim) : Math.min(1, WORK_MAX_DIM / maxDim);
        const w = Math.round(nw * factor);
        const h = Math.round(nh * factor);
        const n = w * h;

        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const offCtx = off.getContext("2d", { willReadFrequently: true })!;
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = "high";
        offCtx.drawImage(img, 0, 0, w, h);
        const rgba = offCtx.getImageData(0, 0, w, h).data;

        dimsRef.current = { w, h, workFactor: w / nw };
        srcRgbaRef.current = rgba;
        const cache = buildGrayCache(rgba, n);
        grayCacheRef.current = cache;
        lumRef.current = buildLuminanceMap(cache.gray);
        xdogIntensityRef.current = null;
        xdogBlurRef.current = null;
        cannyNmsRef.current = null;
        userLineEditsRef.current = new Int8Array(n);
        regionMapRef.current = new Int32Array(n);
        regionsRef.current = new Map();
        nextRegionIdRef.current = 1;
        fillBuffersRef.current = createFillBuffers(n);
        undoStackRef.current = [];
        redoStackRef.current = [];

        const setup = (c: HTMLCanvasElement | null) => {
          if (!c) return null;
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) return null;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          const im = ctx.createImageData(w, h);
          return { img: im, u32: new Uint32Array(im.data.buffer) };
        };
        setup(baseCanvasRef.current);
        fillImageRef.current = setup(fillCanvasRef.current);
        selectImageRef.current = setup(selectCanvasRef.current);
        lineImageRef.current = setup(lineCanvasRef.current);

        if (stackRef.current) {
          stackRef.current.style.width = `${w}px`;
          stackRef.current.style.height = `${h}px`;
        }

        if (opts?.preset) {
          applyScenePreset(opts.preset, true);
        } else if (opts?.autoDetectPreset) {
          // Sample chroma & luminance variance to auto-pick between lineart_card / cg_recolor / photo_miniature
          let chromaSum = 0;
          let midToneCount = 0;
          const step = Math.max(1, (n / 4000) | 0);
          let samples = 0;
          for (let i = 0; i < n; i += step) {
            const p = i << 2;
            const r = rgba[p];
            const g = rgba[p + 1];
            const b = rgba[p + 2];
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            chromaSum += maxC - minC;
            const gr = cache.gray[i];
            if (gr > 45 && gr < 210) midToneCount++;
            samples++;
          }
          const avgChroma = chromaSum / Math.max(1, samples);
          const midRatio = midToneCount / Math.max(1, samples);
          if (avgChroma > 18) {
            applyScenePreset("cg_recolor", true);
          } else if (midRatio > 0.35) {
            applyScenePreset("photo_miniature", true);
          } else {
            applyScenePreset("lineart_card", true);
          }
        }
        if (opts?.extraction) setExtractionMode(opts.extraction);
        if (opts?.inkFill !== undefined) setXdogInkFill(opts.inkFill);
        if (opts?.render) setRenderMode(opts.render);
        const crop = opts?.crop || "full";
        activeCropRef.current = crop;
        setSelectedRegionIds([]);
        setImgSize({ w, h });
        setUsedRegionsVersion((v) => v + 1);
        setHistoryVersion((v) => v + 1);
        setImageToken((t) => t + 1);
        if (opts?.label) setStatusMessage(opts.label);

        requestAnimationFrame(() => focusRegion(crop, false));
      };
      img.onerror = () => setStatusMessage("图像加载失败，请换一张图片重试");
      img.src = srcUrl;
    },
    [applyScenePreset, focusRegion]
  );

  const lastIncomingTokenRef = useRef<number>(0);
  useEffect(() => {
    if (!incomingImage || !incomingImage.url) return;
    if (incomingImage.token === lastIncomingTokenRef.current) return;
    lastIncomingTokenRef.current = incomingImage.token;
    if (incomingImage.label) {
      setNewProjectTitle(`${incomingImage.label} · 试色方案`);
      setNewPartName(incomingImage.label);
    }
    setIsFocusAnimating(true);
    const animTimer = window.setTimeout(() => setIsFocusAnimating(false), 460);
    loadImageSource(incomingImage.url, {
      crop: "full",
      autoDetectPreset: true,
      label: `✨ 已载入模型图像${incomingImage.label ? `「${incomingImage.label}」` : ""}，请在右侧明度色板选色试涂`,
    });
    return () => window.clearTimeout(animTimer);
  }, [incomingImage, loadImageSource]);

  // ---------------------------------------------------------------------------
  // History (20 steps, memory-light: shared immutable region pixels + COW edits)
  // ---------------------------------------------------------------------------
  const pushUndoSnapshot = useCallback((actionLabel: string) => {
    if (!userLineEditsRef.current) return;
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      {
        regions: new Map(regionsRef.current),
        nextRegionId: nextRegionIdRef.current,
        userLineEdits: userLineEditsRef.current,
        actionLabel,
      },
    ];
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  const rebuildRegionMap = () => {
    const regMap = regionMapRef.current;
    if (!regMap) return;
    regMap.fill(0);
    for (const reg of regionsRef.current.values()) {
      const px = reg.pixels;
      for (let i = 0; i < px.length; i++) regMap[px[i]] = reg.id;
    }
  };

  const restoreSnapshot = (snap: HistorySnapshot) => {
    const editsChanged = snap.userLineEdits !== userLineEditsRef.current;
    regionsRef.current = new Map(snap.regions);
    nextRegionIdRef.current = snap.nextRegionId;
    userLineEditsRef.current = snap.userLineEdits;
    rebuildRegionMap();
    if (editsChanged) composeLines();
    setSelectedRegionIds((prev) => prev.filter((id) => regionsRef.current.has(id)));
    renderFillFull();
    renderSelectionOverlay();
    setUsedRegionsVersion((v) => v + 1);
    setHistoryVersion((v) => v + 1);
  };

  const currentSnapshot = (label: string): HistorySnapshot | null =>
    userLineEditsRef.current
      ? {
          regions: new Map(regionsRef.current),
          nextRegionId: nextRegionIdRef.current,
          userLineEdits: userLineEditsRef.current,
          actionLabel: label,
        }
      : null;

  const handleUndo = () => {
    const last = undoStackRef.current[undoStackRef.current.length - 1];
    const cur = last && currentSnapshot(last.actionLabel);
    if (!last || !cur) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-19), cur];
    restoreSnapshot(last);
    setStatusMessage(`已撤销：${last.actionLabel}`);
  };

  const handleRedo = () => {
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    const cur = next && currentSnapshot(next.actionLabel);
    if (!next || !cur) return;
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current.slice(-19), cur];
    restoreSnapshot(next);
    setStatusMessage(`已重做：${next.actionLabel}`);
  };

  const undoRef = useRef(handleUndo);
  const redoRef = useRef(handleRedo);
  undoRef.current = handleUndo;
  redoRef.current = handleRedo;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showConvertModal) {
          setShowConvertModal(false);
          return;
        }
        if (isFullscreen) {
          e.preventDefault();
          setIsFullscreen(false);
          return;
        }
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        spaceRef.current = true;
        setIsSpacePressed(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoRef.current();
        else undoRef.current();
      } else if (e.key === "0" && !e.metaKey && !e.ctrlKey) {
        focusRegion(activeCropRef.current, true);
      } else if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsFullscreen((v) => !v);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [focusRegion, isFullscreen, showConvertModal]);

  // Lock page scroll while in fullscreen studio mode & re-fit canvas smoothly on layout change
  useEffect(() => {
    if (isFullscreen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => focusRegion(activeCropRef.current, true), 45);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.clearTimeout(t);
      };
    } else {
      const t = window.setTimeout(() => focusRegion(activeCropRef.current, true), 45);
      return () => window.clearTimeout(t);
    }
  }, [isFullscreen, isDesktopPaletteCollapsed, focusRegion]);

  // ---------------------------------------------------------------------------
  // Paint application (recolor selected regions)
  // ---------------------------------------------------------------------------
  const applyPaintToSelectedRegions = (
    hex: string,
    meta?: { brand?: string; code?: string; name?: string },
    overrideShade?: string | null,
    overrideHighlight?: string | null
  ) => {
    const triad = deriveImpcatTriad(hex);
    const shadeHex = overrideShade || triad.shadeHex;
    const highlightHex = overrideHighlight || triad.highlightHex;
    setActiveHex(triad.baseHex);
    if (meta) setActivePaintMeta(meta);
    if (overrideShade === undefined) setCustomShadeHex(null);
    if (overrideHighlight === undefined) setCustomHighlightHex(null);

    if (selectedRegionIds.length === 0) return;
    pushUndoSnapshot("批量替换选中分区油漆");
    for (const id of selectedRegionIds) {
      const reg = regionsRef.current.get(id);
      if (!reg) continue;
      regionsRef.current.set(id, {
        ...reg,
        baseHex: triad.baseHex,
        shadeHex,
        highlightHex,
        paintBrand: meta?.brand ?? reg.paintBrand,
        paintCode: meta?.code ?? reg.paintCode,
        paintName: meta?.name ?? reg.paintName,
      });
    }
    renderFillFull();
    setUsedRegionsVersion((v) => v + 1);
    setStatusMessage(`已为 ${selectedRegionIds.length} 个选中分区应用 ${meta?.name || triad.baseHex}`);
  };

  // ---------------------------------------------------------------------------
  // Tool actions & Drag-to-Fill (Continuous Swipe Fill / Select / Erase)
  // ---------------------------------------------------------------------------
  const runFlood = (x: number, y: number): Uint32Array | null => {
    const { w, h } = dimsRef.current;
    const boundary = boundaryRef.current;
    const alpha = lineAlphaRef.current;
    const cache = grayCacheRef.current;
    const buf = fillBuffersRef.current;
    if (!boundary || !alpha || !cache || !buf) return null;
    return floodFillRegion(x, y, w, h, boundary, alpha, cache.gray, fillTolerance, buf, {
      rgba: srcRgbaRef.current,
      colorTolerance: fillTolerance,
      localStepThreshold,
      bleedRings: 2,
      edgeAbsorbRings: edgeAbsorb,
      edgeAbsorbTolerance: Math.max(16, localStepThreshold * 1.6),
    });
  };

  const commitNewRegion = (pixels: Uint32Array): ColoredRegion | null => {
    const regMap = regionMapRef.current;
    const lum = lumRef.current;
    if (!regMap || !lum) return null;
    const touched = new Set<number>();
    for (let i = 0; i < pixels.length; i++) {
      const old = regMap[pixels[i]];
      if (old > 0) touched.add(old);
    }
    const id = nextRegionIdRef.current++;
    for (let i = 0; i < pixels.length; i++) regMap[pixels[i]] = id;
    for (const oldId of touched) {
      const old = regionsRef.current.get(oldId);
      if (!old) continue;
      const keep: number[] = [];
      for (let i = 0; i < old.pixels.length; i++) if (regMap[old.pixels[i]] === oldId) keep.push(old.pixels[i]);
      if (keep.length === 0) regionsRef.current.delete(oldId);
      else
        regionsRef.current.set(oldId, {
          ...old,
          pixels: new Uint32Array(keep),
          baseLum: computeRegionBaseLuminance(new Uint32Array(keep), lum, lineAlphaRef.current),
        });
    }
    const baseLum = computeRegionBaseLuminance(pixels, lum, lineAlphaRef.current);
    const region: ColoredRegion = {
      id,
      baseHex: activeTriad.baseHex,
      shadeHex: activeTriad.shadeHex,
      highlightHex: activeTriad.highlightHex,
      baseLum,
      paintBrand: activePaintMeta.brand,
      paintCode: activePaintMeta.code,
      paintName: activePaintMeta.name,
      pixels,
    };
    regionsRef.current.set(id, region);
    return region;
  };

  /**
   * Merges newly flooded sub-region pixels into an existing region (used during
   * Drag-to-Fill so all swiped sub-blocks become one unified armor region with
   * a shared baseLum and 1 Undo snapshot).
   */
  const mergePixelsIntoRegion = (targetId: number, newPixels: Uint32Array): ColoredRegion | null => {
    const regMap = regionMapRef.current;
    const lum = lumRef.current;
    const existing = regionsRef.current.get(targetId);
    if (!regMap || !lum || !existing) return null;

    const touched = new Set<number>();
    let addedCount = 0;
    for (let i = 0; i < newPixels.length; i++) {
      const p = newPixels[i];
      const old = regMap[p];
      if (old !== targetId) {
        if (old > 0) touched.add(old);
        addedCount++;
      }
    }
    if (addedCount === 0) return existing;

    const merged = new Uint32Array(existing.pixels.length + addedCount);
    merged.set(existing.pixels, 0);
    let offset = existing.pixels.length;
    for (let i = 0; i < newPixels.length; i++) {
      const p = newPixels[i];
      if (regMap[p] !== targetId) {
        regMap[p] = targetId;
        merged[offset++] = p;
      }
    }

    for (const oldId of touched) {
      const old = regionsRef.current.get(oldId);
      if (!old) continue;
      const keep: number[] = [];
      for (let i = 0; i < old.pixels.length; i++) if (regMap[old.pixels[i]] === oldId) keep.push(old.pixels[i]);
      if (keep.length === 0) regionsRef.current.delete(oldId);
      else
        regionsRef.current.set(oldId, {
          ...old,
          pixels: new Uint32Array(keep),
          baseLum: computeRegionBaseLuminance(new Uint32Array(keep), lum, lineAlphaRef.current),
        });
    }

    const updated: ColoredRegion = {
      ...existing,
      pixels: merged,
      baseLum: computeRegionBaseLuminance(merged, lum, lineAlphaRef.current),
    };
    regionsRef.current.set(targetId, updated);
    return updated;
  };

  // Drag-to-Fill stroke state
  const fillStrokeBaseSnapRef = useRef<HistorySnapshot | null>(null);
  const fillStrokeUndoCommittedRef = useRef(false);
  const fillStrokeActiveRegionIdRef = useRef<number | null>(null);
  const fillStrokeSubCountRef = useRef(0);
  const fillStrokeLastImgPtRef = useRef<{ x: number; y: number } | null>(null);
  const fillStrokeStartTimeRef = useRef(0);

  const commitFillStrokeUndoOnce = (label: string) => {
    if (fillStrokeUndoCommittedRef.current || !fillStrokeBaseSnapRef.current) return;
    fillStrokeUndoCommittedRef.current = true;
    const snap = { ...fillStrokeBaseSnapRef.current, actionLabel: label };
    undoStackRef.current = [...undoStackRef.current.slice(-19), snap];
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1);
  };

  const stepFillStrokeAt = (x: number, y: number, isInitialTap: boolean) => {
    const regMap = regionMapRef.current;
    const boundary = boundaryRef.current;
    const { w, h } = dimsRef.current;
    if (!regMap || !boundary || x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;

    if (activeTool === "eraser") {
      const existingId = regMap[idx];
      if (existingId > 0 && regionsRef.current.has(existingId)) {
        commitFillStrokeUndoOnce("擦除色块");
        regionsRef.current.delete(existingId);
        rebuildRegionMap();
        setSelectedRegionIds((prev) => prev.filter((id) => id !== existingId));
        renderFillFull();
        setUsedRegionsVersion((v) => v + 1);
        fillStrokeSubCountRef.current += 1;
        setStatusMessage(
          fillStrokeSubCountRef.current > 1
            ? `已连续擦除 ${fillStrokeSubCountRef.current} 个色块`
            : "已擦除该独立色块"
        );
      }
      return;
    }

    // While dragging across lines, ignore pixels directly on the barrier wall
    if (!isInitialTap && boundary[idx] !== 0) return;

    const existingId = regMap[idx];

    if (activeTool === "select") {
      if (isInitialTap && existingId > 0 && regionsRef.current.has(existingId)) {
        setSelectedRegionIds((prev) =>
          prev.includes(existingId) ? prev.filter((id) => id !== existingId) : [...prev, existingId]
        );
        fillStrokeActiveRegionIdRef.current = existingId;
        return;
      }
      if (!isInitialTap && existingId > 0 && existingId === fillStrokeActiveRegionIdRef.current) {
        return;
      }
      if (!isInitialTap && existingId > 0 && regionsRef.current.has(existingId)) {
        setSelectedRegionIds((prev) => (prev.includes(existingId) ? prev : [...prev, existingId]));
        return;
      }
      const pixels = runFlood(x, y);
      if (!pixels || pixels.length === 0 || pixels.length > w * h * (isInitialTap ? 0.75 : 0.5)) {
        if (isInitialTap) {
          setStatusMessage("未检测到闭合分区或存在缺口，请调高「自动闭合断口」或用补线笔封口");
        }
        return;
      }
      commitFillStrokeUndoOnce("新建并选中分区");
      if (fillStrokeActiveRegionIdRef.current === null) {
        const region = commitNewRegion(pixels);
        if (!region) return;
        fillStrokeActiveRegionIdRef.current = region.id;
        fillStrokeSubCountRef.current = 1;
        renderFillRegion(region);
        setSelectedRegionIds((prev) => (prev.includes(region.id) ? prev : [...prev, region.id]));
        setUsedRegionsVersion((v) => v + 1);
        setStatusMessage(`已选中分区 #${region.id}（按住拖动可连续合并相邻子块）`);
      } else {
        const merged = mergePixelsIntoRegion(fillStrokeActiveRegionIdRef.current, pixels);
        if (!merged) return;
        fillStrokeSubCountRef.current += 1;
        renderFillRegion(merged);
        setUsedRegionsVersion((v) => v + 1);
        setStatusMessage(
          `已连续合并 ${fillStrokeSubCountRef.current} 个子区域至分区 #${merged.id} · ${merged.pixels.length.toLocaleString()} px`
        );
      }
      return;
    }

    if (activeTool === "fill") {
      if (existingId > 0 && existingId === fillStrokeActiveRegionIdRef.current) return;
      if (!isInitialTap && existingId > 0) {
        const prevReg = regionsRef.current.get(existingId);
        if (prevReg && prevReg.baseHex.toUpperCase() === activeTriad.baseHex.toUpperCase()) return;
      }
      const t0 = performance.now();
      const pixels = runFlood(x, y);
      if (!pixels || pixels.length === 0) {
        if (isInitialTap) setStatusMessage("点击位置是黑色线框，请点在闭合区域内部");
        return;
      }
      if (!isInitialTap && pixels.length > w * h * 0.55) {
        // Prevent accidental background flood when swiping across an outer edge
        return;
      }
      commitFillStrokeUndoOnce(`填色 ${activePaintMeta.name || activeTriad.baseHex}`);
      if (fillStrokeActiveRegionIdRef.current === null) {
        const region = commitNewRegion(pixels);
        if (!region) return;
        fillStrokeActiveRegionIdRef.current = region.id;
        fillStrokeSubCountRef.current = 1;
        renderFillRegion(region);
        setUsedRegionsVersion((v) => v + 1);
        const dt = (performance.now() - t0).toFixed(1);
        const leakHint = pixels.length > w * h * 0.6 ? " ⚠️ 面积过大，建议开启色差/梯度阻断" : "";
        setStatusMessage(`已填充色块 #${region.id} · ${pixels.length.toLocaleString()} px · ${dt}ms${leakHint}`);
      } else {
        const merged = mergePixelsIntoRegion(fillStrokeActiveRegionIdRef.current, pixels);
        if (!merged) return;
        fillStrokeSubCountRef.current += 1;
        renderFillRegion(merged);
        setUsedRegionsVersion((v) => v + 1);
        setStatusMessage(
          `拖拽连续填色：已合并 ${fillStrokeSubCountRef.current} 个子块 (#${merged.id}) · ${merged.pixels.length.toLocaleString()} px`
        );
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Manual seal pen / line eraser (anti-aliased disc stamps, dirty-rect upload)
  // ---------------------------------------------------------------------------
  const strokeBaseEditsRef = useRef<Int8Array | null>(null);
  const lastDrawPtRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRectRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const strokeRafRef = useRef<number | null>(null);

  const flushStrokeDirty = () => {
    strokeRafRef.current = null;
    const d = dirtyRectRef.current;
    const lineBuf = lineImageRef.current;
    const canvas = lineCanvasRef.current;
    if (!d || !lineBuf || !canvas) return;
    dirtyRectRef.current = null;
    canvas.getContext("2d")?.putImageData(lineBuf.img, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1);
  };

  const stampSegment = (x0: number, y0: number, x1: number, y1: number, isPen: boolean) => {
    const edits = userLineEditsRef.current;
    const alpha = lineAlphaRef.current;
    const baseAlpha = baseLineAlphaRef.current;
    const lineBuf = lineImageRef.current;
    if (!edits || !alpha || !baseAlpha || !lineBuf) return;
    const { w, h } = dimsRef.current;
    const r = Math.max(1, brushRadius);
    const reach = Math.ceil(r + 1);
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / Math.max(0.5, r * 0.5)));
    const d = dirtyRectRef.current || { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      const ix = Math.round(cx);
      const iy = Math.round(cy);
      for (let dy = -reach; dy <= reach; dy++) {
        const ny = iy + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -reach; dx <= reach; dx++) {
          const nx = ix + dx;
          if (nx < 0 || nx >= w) continue;
          const dd = Math.hypot(nx - cx, ny - cy);
          const i = ny * w + nx;
          if (isPen) {
            const cov = Math.max(0, Math.min(1, r + 0.5 - dd));
            if (cov <= 0) continue;
            const v = Math.round(cov * 127);
            if (edits[i] < v) {
              edits[i] = v;
              const a = Math.max(baseAlpha[i], v * 2);
              alpha[i] = a;
              lineBuf.u32[i] = packRGBA(25, 25, 30, a);
            }
          } else {
            if (dd > r + 0.5) continue;
            edits[i] = -1;
            alpha[i] = 0;
            lineBuf.u32[i] = 0;
          }
          if (nx < d.x0) d.x0 = nx;
          if (nx > d.x1) d.x1 = nx;
          if (ny < d.y0) d.y0 = ny;
          if (ny > d.y1) d.y1 = ny;
        }
      }
    }
    if (d.x1 >= 0) {
      dirtyRectRef.current = d;
      if (strokeRafRef.current === null) strokeRafRef.current = requestAnimationFrame(flushStrokeDirty);
    }
  };

  const beginStroke = (pt: { x: number; y: number }) => {
    if (!userLineEditsRef.current) return;
    pushUndoSnapshot(activeTool === "pen" ? "补线封口笔" : "擦除线框");
    strokeBaseEditsRef.current = userLineEditsRef.current;
    userLineEditsRef.current = userLineEditsRef.current.slice(); // copy-on-write
    lastDrawPtRef.current = pt;
    stampSegment(pt.x, pt.y, pt.x, pt.y, activeTool === "pen");
  };

  const endStroke = (commit: boolean) => {
    lastDrawPtRef.current = null;
    if (!commit && strokeBaseEditsRef.current) {
      // cancelled (e.g. second finger arrived → pinch): revert stroke & drop snapshot
      userLineEditsRef.current = strokeBaseEditsRef.current;
      undoStackRef.current = undoStackRef.current.slice(0, -1);
      setHistoryVersion((v) => v + 1);
    }
    strokeBaseEditsRef.current = null;
    composeLines(); // rebuild collision boundary once per stroke
    if (commit) setStatusMessage(activeTool === "pen" ? "已补线封口并更新防漏色碰撞掩码" : "已擦除线框噪点");
  };

  // ---------------------------------------------------------------------------
  // Decoupled Mouse/Pen Pointer Gestures & Native Multi-Touch (Pinch + 2-Finger Pan)
  // ---------------------------------------------------------------------------
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const isPinchingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastTouchMidRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchDistRef = useRef<number>(1);
  const pinchCooldownUntilRef = useRef<number>(0);

  const gestureRef = useRef<{
    mode: GestureMode;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    pinchDist: number;
    pinchCX: number;
    pinchCY: number;
    pinchScale: number;
  }>({ mode: "none", startX: 0, startY: 0, startPanX: 0, startPanY: 0, pinchDist: 1, pinchCX: 0, pinchCY: 0, pinchScale: 1 });

  const resetAllGestureState = useCallback((withCooldown = false) => {
    isPinchingRef.current = false;
    isPanningRef.current = false;
    lastTouchMidRef.current = null;
    gestureRef.current.mode = "none";
    pointersRef.current.clear();
    if (withCooldown) {
      pinchCooldownUntilRef.current = performance.now() + 150;
    }
  }, []);

  const startPanFrom = (x: number, y: number) => {
    const g = gestureRef.current;
    g.mode = "pan";
    isPanningRef.current = true;
    g.startX = x;
    g.startY = y;
    g.startPanX = viewRef.current.panX;
    g.startPanY = viewRef.current.panY;
  };

  // Mouse & Stylus Pen handlers (Touch is handled by dedicated native Touch handlers below to prevent ghost pointer lockups)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if (mobileDrawer !== null) {
      setMobileDrawer(null);
    }
    if (dimsRef.current.w <= 0) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;

    if (e.button === 1 || spaceRef.current || activeTool === "pan") {
      startPanFrom(e.clientX, e.clientY);
      return;
    }
    const pt = clientToImage(e.clientX, e.clientY);
    if (!pt) {
      startPanFrom(e.clientX, e.clientY);
      return;
    }
    if (activeTool === "pen" || activeTool === "lineEraser") {
      g.mode = "draw";
      beginStroke(pt);
      return;
    }
    // fill / select / eraser → start Drag-to-Fill stroke!
    g.mode = "fillStroke";
    g.startX = e.clientX;
    g.startY = e.clientY;
    fillStrokeBaseSnapRef.current = currentSnapshot("连续涂抹填色");
    fillStrokeUndoCommittedRef.current = false;
    fillStrokeActiveRegionIdRef.current = null;
    fillStrokeSubCountRef.current = 0;
    fillStrokeLastImgPtRef.current = pt;
    fillStrokeStartTimeRef.current = performance.now();
    stepFillStrokeAt(pt.x, pt.y, true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;

    if (g.mode === "pan") {
      applyView({
        scale: viewRef.current.scale,
        panX: g.startPanX + (e.clientX - g.startX),
        panY: g.startPanY + (e.clientY - g.startY),
      });
      return;
    }
    if (g.mode === "fillStroke") {
      const pt = clientToImage(e.clientX, e.clientY);
      if (!pt) return;
      const prev = fillStrokeLastImgPtRef.current || pt;
      const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      if (dist < 2) return;
      const steps = Math.max(1, Math.ceil(dist / 5));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const sx = Math.round(prev.x + (pt.x - prev.x) * t);
        const sy = Math.round(prev.y + (pt.y - prev.y) * t);
        stepFillStrokeAt(sx, sy, false);
      }
      fillStrokeLastImgPtRef.current = pt;
      return;
    }
    if (g.mode === "draw") {
      const pt = clientToImage(e.clientX, e.clientY);
      if (!pt) return;
      const prev = lastDrawPtRef.current || pt;
      stampSegment(prev.x, prev.y, pt.x, pt.y, activeTool === "pen");
      lastDrawPtRef.current = pt;
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    pointersRef.current.delete(e.pointerId);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const g = gestureRef.current;
    if (g.mode === "fillStroke") {
      fillStrokeBaseSnapRef.current = null;
      fillStrokeActiveRegionIdRef.current = null;
      fillStrokeLastImgPtRef.current = null;
    }
    if (g.mode === "draw") endStroke(e.type === "pointerup");
    resetAllGestureState(false);
  };

  // Dedicated Native Touch Handlers (simultaneous 2-finger pinch + 2-finger pan, zero ghost pointers)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (mobileDrawer !== null) {
      setMobileDrawer(null);
    }
    if (dimsRef.current.w <= 0) return;

    const g = gestureRef.current;

    // 2 Fingers: simultaneous Pinch Zoom + Two-Finger Pan
    if (e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      if (g.mode === "draw") endStroke(false);
      if (g.mode === "fillStroke") {
        // Revert accidental single-finger tap fill if second finger landed within 180ms
        if (
          performance.now() - fillStrokeStartTimeRef.current < 180 &&
          fillStrokeUndoCommittedRef.current &&
          fillStrokeBaseSnapRef.current
        ) {
          undoStackRef.current = undoStackRef.current.slice(0, -1);
          restoreSnapshot(fillStrokeBaseSnapRef.current);
        }
        fillStrokeBaseSnapRef.current = null;
        fillStrokeActiveRegionIdRef.current = null;
        fillStrokeLastImgPtRef.current = null;
      }

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      lastTouchDistRef.current = Math.max(1, Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY));
      lastTouchMidRef.current = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2,
      };
      isPinchingRef.current = true;
      isPanningRef.current = false;
      g.mode = "pinch";
      return;
    }

    if (e.touches.length > 2) return;

    // 1 Finger:
    if (e.touches.length === 1) {
      isPinchingRef.current = false;
      lastTouchMidRef.current = null;
      // 150ms cooldown after 2-finger gesture release prevents accidental single-finger fill
      if (performance.now() < pinchCooldownUntilRef.current) {
        return;
      }

      const t0 = e.touches[0];
      if (spaceRef.current || activeTool === "pan") {
        if (e.cancelable) e.preventDefault();
        startPanFrom(t0.clientX, t0.clientY);
        return;
      }

      const pt = clientToImage(t0.clientX, t0.clientY);
      if (!pt) {
        if (e.cancelable) e.preventDefault();
        startPanFrom(t0.clientX, t0.clientY);
        return;
      }

      if (e.cancelable) e.preventDefault();
      if (activeTool === "pen" || activeTool === "lineEraser") {
        g.mode = "draw";
        beginStroke(pt);
        return;
      }

      // fill / select / eraser
      g.mode = "fillStroke";
      g.startX = t0.clientX;
      g.startY = t0.clientY;
      fillStrokeBaseSnapRef.current = currentSnapshot("连续涂抹填色");
      fillStrokeUndoCommittedRef.current = false;
      fillStrokeActiveRegionIdRef.current = null;
      fillStrokeSubCountRef.current = 0;
      fillStrokeLastImgPtRef.current = pt;
      fillStrokeStartTimeRef.current = performance.now();
      stepFillStrokeAt(pt.x, pt.y, true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dimsRef.current.w <= 0) return;

    // 2 Fingers: simultaneous Pinch Zoom + Two-Finger Center Translation (dx, dy)
    if (e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentDist = Math.max(1, Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY));
      const currentMidX = (t0.clientX + t1.clientX) / 2;
      const currentMidY = (t0.clientY + t1.clientY) / 2;

      if (!isPinchingRef.current || !lastTouchMidRef.current) {
        isPinchingRef.current = true;
        gestureRef.current.mode = "pinch";
        lastTouchDistRef.current = currentDist;
        lastTouchMidRef.current = { x: currentMidX, y: currentMidY };
        return;
      }

      const distRatio = currentDist / Math.max(1, lastTouchDistRef.current);
      const dx = currentMidX - lastTouchMidRef.current.x;
      const dy = currentMidY - lastTouchMidRef.current.y;

      const { min, max } = getScaleLimits();
      const prevScale = viewRef.current.scale;
      const nextScale = Math.min(Math.max(prevScale * distRatio, min), max);
      const actualRatio = nextScale / prevScale;

      const pivotX = currentMidX - rect.left;
      const pivotY = currentMidY - rect.top;
      const nextPanX = pivotX - (pivotX - viewRef.current.panX) * actualRatio + dx;
      const nextPanY = pivotY - (pivotY - viewRef.current.panY) * actualRatio + dy;

      applyView({ scale: nextScale, panX: nextPanX, panY: nextPanY });
      lastTouchDistRef.current = currentDist;
      lastTouchMidRef.current = { x: currentMidX, y: currentMidY };
      return;
    }

    // 1 Finger:
    if (e.touches.length === 1) {
      if (isPinchingRef.current || performance.now() < pinchCooldownUntilRef.current) {
        resetAllGestureState(true);
        return;
      }
      const t0 = e.touches[0];
      const g = gestureRef.current;

      if (g.mode === "pan" || isPanningRef.current) {
        if (e.cancelable) e.preventDefault();
        applyView({
          scale: viewRef.current.scale,
          panX: g.startPanX + (t0.clientX - g.startX),
          panY: g.startPanY + (t0.clientY - g.startY),
        });
        return;
      }
      if (g.mode === "fillStroke") {
        if (e.cancelable) e.preventDefault();
        const pt = clientToImage(t0.clientX, t0.clientY);
        if (!pt) return;
        const prev = fillStrokeLastImgPtRef.current || pt;
        const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        if (dist < 2) return;
        const steps = Math.max(1, Math.ceil(dist / 5));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const sx = Math.round(prev.x + (pt.x - prev.x) * t);
          const sy = Math.round(prev.y + (pt.y - prev.y) * t);
          stepFillStrokeAt(sx, sy, false);
        }
        fillStrokeLastImgPtRef.current = pt;
        return;
      }
      if (g.mode === "draw") {
        if (e.cancelable) e.preventDefault();
        const pt = clientToImage(t0.clientX, t0.clientY);
        if (!pt) return;
        const prev = lastDrawPtRef.current || pt;
        stampSegment(prev.x, prev.y, pt.x, pt.y, activeTool === "pen");
        lastDrawPtRef.current = pt;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    // Immediately release pinch state and start 150ms cooldown when dropping below 2 fingers
    if (e.touches.length < 2 && (isPinchingRef.current || g.mode === "pinch")) {
      resetAllGestureState(true);
      if (e.touches.length === 1) return;
    }

    if (e.touches.length === 0) {
      if (g.mode === "fillStroke") {
        fillStrokeBaseSnapRef.current = null;
        fillStrokeActiveRegionIdRef.current = null;
        fillStrokeLastImgPtRef.current = null;
      }
      if (g.mode === "draw") {
        endStroke(e.type === "touchend");
      }
      resetAllGestureState(false);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clientToImage(e.clientX, e.clientY) || activeTool === "pan") {
      focusRegion(activeCropRef.current, true);
    }
  };

  // Scoped Wheel & Safari Trackpad Gesture listeners on viewportRef ONLY
  const gestureScaleBaseRef = useRef<number | null>(null);
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      // If no image is loaded, never block native page scrolling
      if (dimsRef.current.w <= 0) return;

      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vp.clientHeight : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;

      // Case A: Trackpad two-finger pinch zoom (ctrlKey / metaKey) or physical notched mouse wheel (deltaMode !== 0)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (gestureScaleBaseRef.current !== null) return;
        const factor = Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.01);
        zoomAtClient(e.clientX, e.clientY, viewRef.current.scale * factor);
        return;
      }
      if (e.deltaMode !== 0) {
        e.preventDefault();
        zoomAtClient(e.clientX, e.clientY, viewRef.current.scale * (dy < 0 ? 1.15 : 1 / 1.15));
        return;
      }

      // Case B: Mac trackpad two-finger swipe pan (!ctrlKey && (|deltaX| > 0 || |deltaY| > 0))
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        const fitScale = getFitScale();
        const isZoomed = viewRef.current.scale > fitScale * 1.05;
        const isDesktop = window.innerWidth >= 1024;
        // On mobile/portrait when unzoomed, let the wheel event naturally scroll the outer page
        if (!isZoomed && !isDesktop) {
          return;
        }
        e.preventDefault();
        const v = viewRef.current;
        applyView({ scale: v.scale, panX: v.panX - dx, panY: v.panY - dy });
      }
    };

    const onGestureStart = (e: Event) => {
      if (dimsRef.current.w <= 0) return;
      e.preventDefault();
      gestureScaleBaseRef.current = viewRef.current.scale;
    };
    const onGestureChange = (e: Event) => {
      if (dimsRef.current.w <= 0) return;
      e.preventDefault();
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      if (gestureScaleBaseRef.current === null) return;
      zoomAtClient(ge.clientX, ge.clientY, gestureScaleBaseRef.current * ge.scale);
    };
    const onGestureEnd = (e: Event) => {
      if (dimsRef.current.w <= 0) return;
      e.preventDefault();
      gestureScaleBaseRef.current = null;
    };
    const onWindowBlur = () => {
      gestureScaleBaseRef.current = null;
      resetAllGestureState(false);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("gesturestart", onGestureStart, { passive: false } as AddEventListenerOptions);
    vp.addEventListener("gesturechange", onGestureChange, { passive: false } as AddEventListenerOptions);
    vp.addEventListener("gestureend", onGestureEnd, { passive: false } as AddEventListenerOptions);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("gesturestart", onGestureStart);
      vp.removeEventListener("gesturechange", onGestureChange);
      vp.removeEventListener("gestureend", onGestureEnd);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [applyView, zoomAtClient, getFitScale, resetAllGestureState]);

  // ---------------------------------------------------------------------------
  // Derived UI data
  // ---------------------------------------------------------------------------
  const usedPaintsSummary = useMemo(() => {
    void usedRegionsVersion;
    const map = new Map<
      string,
      {
        hex: string;
        brand?: string;
        code?: string;
        name?: string;
        regionCount: number;
        closestPaint: { paint: CatalogPaint; deltaE: number; brandZh: string } | null;
      }
    >();
    for (const reg of regionsRef.current.values()) {
      const key = reg.baseHex.toUpperCase();
      const prev = map.get(key);
      if (prev) prev.regionCount += 1;
      else
        map.set(key, {
          hex: key,
          brand: reg.paintBrand,
          code: reg.paintCode,
          name: reg.paintName,
          regionCount: 1,
          closestPaint: findClosestCatalogPaint(key),
        });
    }
    return Array.from(map.values());
  }, [usedRegionsVersion, findClosestCatalogPaint]);

  void historyVersion;
  const undoCount = undoStackRef.current.length;
  const redoCount = redoStackRef.current.length;

  const handleResetAllFills = () => {
    if (!regionMapRef.current) return;
    pushUndoSnapshot("一键清空重绘");
    regionsRef.current = new Map();
    regionMapRef.current.fill(0);
    setSelectedRegionIds([]);
    renderFillFull();
    setUsedRegionsVersion((v) => v + 1);
    setStatusMessage("已清空所有填色色块");
  };

  const buildCompositePngDataUrl = (): string | null => {
    const base = baseCanvasRef.current;
    const fill = fillCanvasRef.current;
    const line = lineCanvasRef.current;
    if (!base || !fill || !line || base.width <= 0 || base.height <= 0) return null;
    const out = document.createElement("canvas");
    out.width = base.width;
    out.height = base.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(fill, 0, 0);
    ctx.save();
    ctx.globalAlpha = lineOpacity / 100;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(line, 0, 0);
    ctx.restore();
    return out.toDataURL("image/png");
  };

  const handleExportCompositePng = () => {
    const dataUrl = buildCompositePngDataUrl();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `GKMixer-STUDIO-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    setStatusMessage("已导出高清合成 PNG 试色图");
  };

  const handleConfirmConvertToProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePaintProject) return;
    const compositeUrl = buildCompositePngDataUrl();
    const { w, h } = dimsRef.current;
    if (!compositeUrl || w <= 0 || h <= 0) {
      setStatusMessage("请先上传图片并填涂颜色后再转为涂装库工程");
      return;
    }

    // Group regions by baseHex, find primary region for each used paint, and compute interior medoid centroid
    const groupedByHex = new Map<string, ColoredRegion[]>();
    for (const reg of regionsRef.current.values()) {
      const key = reg.baseHex.toUpperCase();
      const arr = groupedByHex.get(key) || [];
      arr.push(reg);
      groupedByHex.set(key, arr);
    }

    const rawNodes: {
      anchorX: number;
      anchorY: number;
      hex: string;
      shadeHex: string;
      highlightHex: string;
      brand: string;
      code: string;
      name: string;
    }[] = [];

    groupedByHex.forEach((regs, hexKey) => {
      // Pick the largest region of this paint for a clean anchor pin
      let primary = regs[0];
      for (const r of regs) {
        if (r.pixels.length > primary.pixels.length) primary = r;
      }
      const px = primary.pixels;
      let sumX = 0;
      let sumY = 0;
      const step = Math.max(1, (px.length / 2000) | 0);
      let count = 0;
      for (let i = 0; i < px.length; i += step) {
        const p = px[i];
        const y = (p / w) | 0;
        const x = p - y * w;
        sumX += x;
        sumY += y;
        count++;
      }
      const avgX = count > 0 ? sumX / count : w / 2;
      const avgY = count > 0 ? sumY / count : h / 2;

      // Snap to the closest interior pixel inside the region so the pin is guaranteed inside the colored part
      let bestX = avgX;
      let bestY = avgY;
      let bestDistSq = Infinity;
      for (let i = 0; i < px.length; i += step) {
        const p = px[i];
        const y = (p / w) | 0;
        const x = p - y * w;
        const dSq = (x - avgX) * (x - avgX) + (y - avgY) * (y - avgY);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestX = x;
          bestY = y;
        }
      }

      const anchorX = Math.min(0.94, Math.max(0.06, (bestX + 0.5) / w));
      const anchorY = Math.min(0.94, Math.max(0.06, (bestY + 0.5) / h));

      rawNodes.push({
        anchorX,
        anchorY,
        hex: hexKey,
        shadeHex: primary.shadeHex,
        highlightHex: primary.highlightHex,
        brand: primary.paintBrand || "Custom",
        code: primary.paintCode || "HEX",
        name: primary.paintName || hexKey,
      });
    });

    // Sort by anchorY and split into Left / Right columns for clean floating swatch card layout
    const leftSide = rawNodes.filter((n) => n.anchorX < 0.5).sort((a, b) => a.anchorY - b.anchorY);
    const rightSide = rawNodes.filter((n) => n.anchorX >= 0.5).sort((a, b) => a.anchorY - b.anchorY);

    const buildSideNodes = (
      items: typeof rawNodes,
      offsetX: number,
      sidePrefix: string
    ): FloatingSwatchNode[] =>
      items.map((item, idx) => {
        const count = items.length;
        const offsetY =
          count === 1
            ? Math.min(0.84, Math.max(0.16, item.anchorY))
            : 0.16 + (idx / Math.max(1, count - 1)) * 0.68;
        return {
          id: `node-studio-${Date.now()}-${sidePrefix}-${idx}`,
          anchorX: item.anchorX,
          anchorY: item.anchorY,
          offsetX,
          offsetY,
          paintBrand: item.brand,
          paintCode: item.code,
          paintName: item.name,
          hex: item.hex,
          tonalGradient: [
            { id: `tg-hl-${idx}`, hex: item.highlightHex, label: "高光", role: "highlight" },
            { id: `tg-bs-${idx}`, hex: item.hex, label: "主色", role: "base" },
            { id: `tg-sh-${idx}`, hex: item.shadeHex, label: "阴影", role: "shadow" },
          ],
        };
      });

    const nodes: FloatingSwatchNode[] = [
      ...buildSideNodes(leftSide, 0.14, "L"),
      ...buildSideNodes(rightSide, 0.86, "R"),
    ];
    const steps = inferStepsFromNodes(nodes);
    const now = Date.now();
    const part: PartCanvas = {
      id: `part-${now}`,
      partName: newPartName.trim() || "试色总成",
      sourceImageDataUrl: compositeUrl,
      nodes,
      steps,
      createdAt: now,
    };
    const project: PaintProject = {
      id: `proj-studio-${now}`,
      title: newProjectTitle.trim() || "AI 试色方案",
      coverImageDataUrl: compositeUrl,
      createdAt: now,
      updatedAt: now,
      parts: [part],
    };

    setShowConvertModal(false);
    setMobileDrawer(null);
    onCreatePaintProject(project);
    setStatusMessage(`已创建涂装库工程「${project.title}」并自动生成 ${nodes.length} 个悬浮色卡与 ${steps.length} 步标准工序`);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        loadImageSource(reader.result, {
          crop: "full",
          autoDetectPreset: true,
          label: `已加载图像：${file.name}（已自动匹配防漏色与光影参数）`,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const cardSurfaceClass = isBlueprint
    ? "gk-panel-card gk-card rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-[3px_3px_0px_#0F172A] dark:shadow-[3px_3px_0px_#020617]"
    : "gk-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md shadow-lg shadow-slate-900/5";

  const dividerBottomClass = isBlueprint
    ? "gk-dashed-divider-b border-b border-dashed border-slate-400 dark:border-slate-600"
    : "border-b border-slate-200/80 dark:border-slate-800/80";

  const dividerTopClass = isBlueprint
    ? "gk-dashed-divider-t border-t border-dashed border-slate-400 dark:border-slate-600"
    : "border-t border-slate-200/80 dark:border-slate-800/80";

  const primaryActionBtnClass = isBlueprint
    ? "gk-mech-primary gk-btn-primary rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A] dark:shadow-[2px_2px_0px_#020617]"
    : "gk-btn-primary rounded-xl bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white shadow-sm";

  const secondaryActionBtnClass = isBlueprint
    ? "gk-mech-btn gk-btn-secondary rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
    : "gk-btn-secondary rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-xs";

  const handleCopyHex = () => {
    try {
      navigator.clipboard?.writeText(activeHex.toUpperCase());
      setCopiedHex(true);
      setStatusMessage(`已复制当前色值 ${activeHex.toUpperCase()}`);
      window.setTimeout(() => setCopiedHex(false), 1600);
    } catch {
      /* ignore */
    }
  };

  // Reusable Palette Section (GKMixer 4-Dimensional Color Engine)
  const renderPaletteSection = () => (
    <div className="space-y-3" translate="no">
      {/* MODULE 1: Current Spray Color Indicator Bar + Live Nearest Paint Match + Paint Catalog Search */}
      <div className="space-y-2">
        <div className="flex items-stretch gap-2.5">
          {/* Left: Non-tilted Precision Mechanical Color Swatch */}
          <label
            title="点击打开系统取色器"
            className={`relative h-14 w-14 shrink-0 cursor-pointer flex items-center justify-center bg-white dark:bg-slate-800 transition ${
              isBlueprint
                ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 shadow-[2px_2px_0px_#0F172A]"
                : "rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
            }`}
          >
            <span
              className={`h-10 w-10 border border-black/15 dark:border-white/15 shadow-inner transition-colors ${
                isBlueprint ? "rounded-[4px]" : "rounded-lg"
              }`}
              style={{ backgroundColor: activeHex }}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 rounded px-1 py-0.2 text-[8px] font-black text-white shadow-xs"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              喷涂色
            </span>
            <input
              type="color"
              value={/^#[0-9A-F]{6}$/i.test(activeHex) ? activeHex : "#808080"}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                const hsl = hexToHsl(v);
                if (hsl.s >= 8) setSelectedHue(hsl.h);
                applyPaintToSelectedRegions(v, { brand: "Custom", code: "HEX", name: "自定义调色" });
              }}
              className="sr-only"
            />
          </label>

          {/* Center-Right: Editable #HEX + Copy + Real-Time Closest Database Paint Pill */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={activeHex}
                  onChange={(e) => {
                    let val = e.target.value.toUpperCase();
                    if (!val.startsWith("#")) val = `#${val}`;
                    setActiveHex(val);
                    if (/^#[0-9A-F]{6}$/.test(val)) {
                      const hsl = hexToHsl(val);
                      if (hsl.s >= 8) setSelectedHue(hsl.h);
                      applyPaintToSelectedRegions(val, { brand: "Custom", code: "HEX", name: "手动色值" });
                    }
                  }}
                  maxLength={7}
                  aria-label="当前喷涂色值"
                  className={`w-full px-2.5 py-1 font-mono text-xs font-black outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                    isBlueprint
                      ? "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600"
                      : "rounded-lg border border-slate-300 dark:border-slate-700 focus:border-[var(--accent-color)]"
                  }`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 truncate max-w-[92px]">
                  {activePaintMeta.name || "自定义"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyHex}
                title="一键复制当前色值"
                className={`px-2 py-1 text-[10px] font-extrabold shrink-0 cursor-pointer transition ${secondaryActionBtnClass}`}
              >
                {copiedHex ? "✓ 已复制" : "复制"}
              </button>
            </div>

            {/* Real-time CIEDE2000 Closest Commercial Paint Pill + Catalog Search Trigger */}
            <div className="flex items-center gap-1.5">
              {activeNearestMatch ? (
                <button
                  type="button"
                  onClick={() => {
                    const p = activeNearestMatch.paint;
                    applyPaintToSelectedRegions(p.hex, {
                      brand: activeNearestMatch.brandZh,
                      code: p.code,
                      name: p.name,
                    });
                    setStatusMessage(
                      `已替换为实体模型漆：${activeNearestMatch.brandZh} ${p.code} ${p.name} (${p.hex})`
                    );
                  }}
                  title={`点击直接替换为该实体商业漆色号 (${activeNearestMatch.paint.hex})`}
                  className={`flex-1 min-w-0 flex items-center justify-between gap-1.5 px-2 py-1 text-[10px] font-extrabold transition cursor-pointer ${
                    isBlueprint
                      ? "rounded-[4px] border border-slate-900 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/90 hover:border-[var(--accent-color)]"
                      : "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 hover:border-[var(--accent-color)]"
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    <span
                      className="h-3 w-3 rounded-xs border border-black/20 shrink-0"
                      style={{ backgroundColor: activeNearestMatch.paint.hex }}
                    />
                    <span className="truncate text-slate-800 dark:text-slate-100">
                      ≈ {activeNearestMatch.brandZh} {activeNearestMatch.paint.code} {activeNearestMatch.paint.name}
                    </span>
                  </span>
                  <span
                    className="font-mono text-[9px] font-black shrink-0 px-1 rounded"
                    style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-color)" }}
                  >
                    ΔE {activeNearestMatch.deltaE.toFixed(1)}
                  </span>
                </button>
              ) : (
                <span className="flex-1 text-[10px] font-bold text-slate-400 truncate">正在匹配实体漆库...</span>
              )}

              <button
                type="button"
                onClick={() => setShowCatalogModal((v) => !v)}
                className={`shrink-0 px-2 py-1 text-[10px] font-extrabold transition cursor-pointer ${
                  showCatalogModal ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                🔍 搜漆库 ({catalogPaints.length || 10999}款)
              </button>
            </div>
          </div>
        </div>

        {showCatalogModal && (
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-2.5 space-y-2">
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="搜索品牌、色号或名称：盖亚 015 / 星影 / 郡士..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold outline-none focus:border-[var(--accent-color)]"
            />
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setCatalogBrandFilter("ALL")}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 cursor-pointer ${
                  catalogBrandFilter === "ALL"
                    ? "bg-[var(--accent-color)] text-white"
                    : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                }`}
              >
                全部
              </button>
              {FEATURED_BRANDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setCatalogBrandFilter(b)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 cursor-pointer ${
                    catalogBrandFilter === b
                      ? "bg-[var(--accent-color)] text-white"
                      : "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {localizedBrand(b, brandLang)}
                </button>
              ))}
            </div>
            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
              {filteredCatalogPaints.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const hsl = hexToHsl(p.hex);
                    if (hsl.s >= 8) setSelectedHue(hsl.h);
                    applyPaintToSelectedRegions(p.hex, {
                      brand: localizedBrand(p.brand, brandLang),
                      code: p.code,
                      name: p.name,
                    });
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[var(--accent-color)] px-2 py-1.5 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-5 w-5 rounded border border-black/20 shrink-0" style={{ backgroundColor: p.hex }} />
                    <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      {localizedBrand(p.brand, brandLang)} {p.code} {p.name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">{p.hex}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {renderMode === "intrinsic" && (
          <div
            className="rounded-xl border px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed"
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-color)",
            }}
          >
            💎 <span className="font-black" style={{ color: "var(--accent-color)" }}>3D 相对光影保留已开启：</span>
            自动计算零件中位亮度 L_base，将新油漆按相对明暗比迁移，完整保留原图曲面阴影与高光。
          </div>
        )}

        {renderMode === "impcat" && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
              <span>四层光影自动推导 (暗部 / 主色 / 高光)</span>
              {(customShadeHex || customHighlightHex) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomShadeHex(null);
                    setCustomHighlightHex(null);
                  }}
                  className="underline cursor-pointer"
                  style={{ color: "var(--accent-color)" }}
                >
                  重置自动
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <label className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 cursor-pointer">
                <span className="block h-4 w-full rounded border border-black/15" style={{ backgroundColor: activeTriad.shadeHex }} />
                <span className="mt-1 block text-[10px] font-extrabold text-slate-700 dark:text-slate-200">暗部色</span>
                <span className="block font-mono text-[9px] text-slate-400">{activeTriad.shadeHex}</span>
                <input
                  type="color"
                  value={activeTriad.shadeHex}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setCustomShadeHex(v);
                    applyPaintToSelectedRegions(activeHex, activePaintMeta, v, customHighlightHex);
                  }}
                  className="sr-only"
                />
              </label>
              <div
                className="rounded-lg border-2 bg-white dark:bg-slate-800 p-1.5"
                style={{ borderColor: "var(--accent-color)" }}
              >
                <span className="block h-4 w-full rounded border border-black/15" style={{ backgroundColor: activeTriad.baseHex }} />
                <span className="mt-1 block text-[10px] font-extrabold">标准主色</span>
                <span className="block font-mono text-[9px] text-slate-500">{activeTriad.baseHex}</span>
              </div>
              <label className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 cursor-pointer">
                <span className="block h-4 w-full rounded border border-black/15" style={{ backgroundColor: activeTriad.highlightHex }} />
                <span className="mt-1 block text-[10px] font-extrabold text-slate-700 dark:text-slate-200">高光色</span>
                <span className="block font-mono text-[9px] text-slate-400">{activeTriad.highlightHex}</span>
                <input
                  type="color"
                  value={activeTriad.highlightHex}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setCustomHighlightHex(v);
                    applyPaintToSelectedRegions(activeHex, activePaintMeta, customShadeHex, v);
                  }}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* MODULE 2: Persistent 10-Step Neutral Grayscale Bar (10 阶素组与光影标准灰阶条) */}
      <div className={`space-y-1.5 pt-2.5 ${dividerTopClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
            <span className="tech-prefix">[GRAY_10]</span>
            10 阶素组与机械骨架标准灰阶
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-400">L10% ➔ L98%</span>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {NEUTRAL_GRAYSCALE_10.map((g) => {
            const isSelected = activeHex.toUpperCase() === g.hex.toUpperCase();
            return (
              <button
                key={g.hex}
                type="button"
                onClick={() =>
                  applyPaintToSelectedRegions(g.hex, {
                    brand: "GK灰阶",
                    code: g.lLabel,
                    name: `${g.label} (${g.lLabel})`,
                  })
                }
                title={`${g.label} · ${g.lLabel} (${g.hex})`}
                className={`group flex flex-col items-center cursor-pointer transition ${
                  isSelected ? "scale-105" : "hover:scale-105"
                }`}
              >
                <span
                  className={`h-6 w-full border transition ${
                    isBlueprint ? "rounded-[3px]" : "rounded-md"
                  } ${
                    isSelected
                      ? "ring-2 ring-[var(--accent-color)] border-white dark:border-slate-900 shadow-sm"
                      : "border-black/20 dark:border-white/15"
                  }`}
                  style={{ backgroundColor: g.hex }}
                />
                <span className="mt-0.5 text-[8px] font-mono font-bold text-slate-500 dark:text-slate-400 leading-none">
                  {g.lLabel.replace("%", "")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODULE 3: 360° Hue Spectrum Slider + 8 Mecha Anchors + 5×5 Value × Chroma Matrix */}
      <div className={`space-y-2 pt-2.5 ${dividerTopClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
            <span className="tech-prefix">[HVC_5x5]</span>
            360° 色相环 + 明度×纯度 5×5 阶梯矩阵
          </span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-black"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent-color)" }}
          >
            H {selectedHue}°
          </span>
        </div>

        {/* Smooth 0°~360° Full Spectrum Hue Slider */}
        <div className="space-y-1.5">
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={selectedHue}
            onChange={(e) => {
              const nextH = Number(e.target.value);
              setSelectedHue(nextH);
              const nextHex = hslToHex(nextH, selectedMatrixCell.s, selectedMatrixCell.l);
              applyPaintToSelectedRegions(nextHex, {
                brand: "GK矩阵",
                code: `H${nextH}°`,
                name: `色相 ${nextH}° · L${selectedMatrixCell.l} S${selectedMatrixCell.s}`,
              });
            }}
            aria-label="360度色相滑轨"
            className="w-full h-3 rounded-full appearance-none cursor-pointer border border-black/15 dark:border-white/15"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
              accentColor: "var(--accent-color)",
            }}
          />

          {/* 8 High-Frequency Mecha Hue Anchors */}
          <div className="grid grid-cols-4 gap-1">
            {MECHA_HUE_ANCHORS.map((anchor) => {
              const isHueActive = Math.abs(selectedHue - anchor.hue) <= 6 || Math.abs(selectedHue - anchor.hue) >= 354;
              return (
                <button
                  key={anchor.label}
                  type="button"
                  onClick={() => {
                    setSelectedHue(anchor.hue);
                    const nextHex = hslToHex(anchor.hue, selectedMatrixCell.s, selectedMatrixCell.l);
                    applyPaintToSelectedRegions(nextHex, {
                      brand: "GK色系",
                      code: `${anchor.hue}°`,
                      name: `${anchor.label.split(" ")[0]} L${selectedMatrixCell.l}·S${selectedMatrixCell.s}`,
                    });
                  }}
                  className={`flex items-center gap-1 px-1.5 py-1 text-[10px] font-extrabold transition cursor-pointer ${
                    isBlueprint ? "rounded-[4px] border" : "rounded-lg border"
                  } ${
                    isHueActive
                      ? "border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 dark:text-white shadow-2xs"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: anchor.previewHex }}
                  />
                  <span className="truncate">{anchor.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5×5 Value (Lightness) × Chroma (Saturation) Stepped Matrix */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-2 space-y-1">
          {/* Column Headers (Saturation S) */}
          <div className="grid grid-cols-6 gap-1 items-center text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 text-center">
            <span className="text-left pl-0.5">明度\纯度</span>
            {MATRIX_SATURATION_COLS.map((col) => (
              <span key={col.s} title={col.label} className="truncate">
                {col.shortLabel.split(" ")[0]}
              </span>
            ))}
          </div>

          {/* 5 Rows (Lightness L from 85% down to 25%) */}
          {matrixGridSwatches.map((row) => (
            <div key={row.l} className="grid grid-cols-6 gap-1 items-center">
              <span
                title={row.label}
                className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate pr-0.5"
              >
                {row.shortLabel}
              </span>
              {row.cells.map((cell) => {
                const isCurrent = activeHex.toUpperCase() === cell.hex.toUpperCase();
                return (
                  <button
                    key={`${cell.l}-${cell.s}`}
                    type="button"
                    onClick={() => {
                      setSelectedMatrixCell({ l: cell.l, s: cell.s });
                      applyPaintToSelectedRegions(cell.hex, {
                        brand: "GK矩阵",
                        code: `H${selectedHue}°`,
                        name: `${row.label.split(" ")[1]} · ${cell.colLabel.split(" ")[1]}`,
                      });
                    }}
                    title={`H${selectedHue}° · 明度 L${cell.l}% · 纯度 S${cell.s}% (${cell.hex})`}
                    className={`h-6 w-full border transition cursor-pointer ${
                      isBlueprint ? "rounded-[3px]" : "rounded-md"
                    } ${
                      isCurrent
                        ? "ring-2 ring-[var(--accent-color)] border-white dark:border-slate-900 scale-105 z-10 shadow-sm"
                        : "border-black/15 dark:border-white/10 hover:scale-105"
                    }`}
                    style={{ backgroundColor: cell.hex }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* MODULE 4: Smart Color Harmony Generator (色相环和谐配色推荐栏) */}
      <div className={`space-y-2 pt-2.5 ${dividerTopClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
            <span className="tech-prefix">[HARMONY]</span>
            色相环和谐分色推荐
          </span>
          <span className="text-[10px] font-bold text-slate-400">点选即涂</span>
        </div>

        {/* 4 Harmony Mode Tabs */}
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              { id: "analogous", label: "⚖️ 邻近层次" },
              { id: "complementary", label: "⚡ 互补撞色" },
              { id: "split", label: "📐 分裂互补" },
              { id: "triadic", label: "🔺 三角主色" },
            ] as { id: HarmonyMode; label: string }[]
          ).map((tab) => {
            const active = harmonyMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHarmonyMode(tab.id)}
                className={`py-1 px-1 text-[10px] font-extrabold transition cursor-pointer truncate ${
                  isBlueprint ? "rounded-[4px] border" : "rounded-lg border"
                } ${
                  active
                    ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 5 Clickable Coordinated Color Capsules */}
        <div className="grid grid-cols-5 gap-1.5">
          {harmonySwatches.map((sw, idx) => {
            const isCurrent = activeHex.toUpperCase() === sw.hex.toUpperCase();
            return (
              <button
                key={`${sw.role}-${idx}`}
                type="button"
                onClick={() =>
                  applyPaintToSelectedRegions(sw.hex, {
                    brand: "和谐推荐",
                    code: sw.tag,
                    name: sw.role,
                  })
                }
                title={`${sw.role} (${sw.tag}) · ${sw.hex}`}
                className={`group flex flex-col items-center p-1 border transition cursor-pointer ${
                  isBlueprint ? "rounded-[4px]" : "rounded-lg"
                } ${
                  isCurrent
                    ? "border-[var(--accent-color)] bg-[var(--accent-soft)]"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-[var(--accent-color)]"
                }`}
              >
                <span
                  className={`h-6 w-full border border-black/15 dark:border-white/15 transition group-hover:scale-105 ${
                    isBlueprint ? "rounded-[3px]" : "rounded"
                  }`}
                  style={{ backgroundColor: sw.hex }}
                />
                <span className="mt-1 text-[9px] font-extrabold text-slate-700 dark:text-slate-200 truncate w-full text-center">
                  {sw.role}
                </span>
                <span className="font-mono text-[8px] text-slate-400 truncate w-full text-center">{sw.hex}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Reusable Algorithm Controls Section
  const renderAlgorithmSection = (alwaysOpen = false) => (
    <div className="space-y-2">
      {!alwaysOpen && (
        <button
          type="button"
          onClick={() => setShowAlgorithmPanel((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-100 cursor-pointer"
        >
          <span>
            <span className="tech-prefix">[ENGINE]</span>
            ⚙️ 视觉线稿与三合一防漏色引擎
          </span>
          <span className="text-[10px] text-slate-500">{showAlgorithmPanel ? "收起 ▲" : "展开 ▼"}</span>
        </button>
      )}

      {(alwaysOpen || showAlgorithmPanel) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 space-y-2.5 text-xs">
          {/* Quick Scene Presets */}
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              一键场景参数预设
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => applyScenePreset("lineart_card")}
                className={`px-2 py-1 text-[10px] font-extrabold cursor-pointer ${secondaryActionBtnClass}`}
              >
                📄 黑白线稿
              </button>
              <button
                type="button"
                onClick={() => applyScenePreset("cg_recolor")}
                className={`px-2 py-1 text-[10px] font-extrabold cursor-pointer ${secondaryActionBtnClass}`}
              >
                🤖 官图改色
              </button>
              <button
                type="button"
                onClick={() => applyScenePreset("photo_miniature")}
                className={`px-2 py-1 text-[10px] font-extrabold cursor-pointer ${secondaryActionBtnClass}`}
              >
                🗿 灰模实拍
              </button>
            </div>
          </div>

          <div className={`pt-2 flex items-center justify-between text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider ${dividerTopClass}`}>
            <span>1. 顶层视觉线稿 (Visual Layer)</span>
            <span>正片叠底</span>
          </div>
          <SliderRow
            label="👁️ 顶层线条不透明度 (CG可调至30%)"
            value={lineOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={setLineOpacity}
          />

          {extractionMode === "threshold" ? (
            <>
              <SliderRow label="线稿阈值 (Threshold)" value={lineThreshold} min={100} max={230} onChange={setLineThreshold} />
              <SliderRow
                label="抗锯齿柔化带宽 (Softness)"
                value={lineSoftness}
                min={5}
                max={70}
                onChange={setLineSoftness}
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <SliderRow
                  label="📏 线条粗细 σ"
                  value={xdogSigma}
                  min={0.6}
                  max={2.5}
                  step={0.1}
                  onChange={setXdogSigma}
                  compact
                />
                <SliderRow
                  label="🔍 刻线灵敏度 p"
                  value={xdogP}
                  min={5}
                  max={45}
                  onChange={setXdogP}
                  compact
                />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={xdogInkFill}
                  onChange={(e) => setXdogInkFill(e.target.checked)}
                  style={{ accentColor: "var(--accent-color)" }}
                />
                <span>实心墨线增强（黑白设定稿开启，CG/照片关闭）</span>
              </label>
              <button
                type="button"
                onClick={() => setShowXdogAdvanced((v) => !v)}
                className="text-[10px] font-bold text-slate-500 underline cursor-pointer"
              >
                {showXdogAdvanced ? "收起高级参数 ▲" : "高级参数 (ε / φ / 底纹) ▼"}
              </button>
              {showXdogAdvanced && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <SliderRow
                      label="阴影抑制 ε"
                      value={xdogEpsilon}
                      min={0.4}
                      max={0.98}
                      step={0.01}
                      onChange={setXdogEpsilon}
                      compact
                    />
                    <SliderRow
                      label="边缘锐度 φ"
                      value={xdogPhi}
                      min={0.5}
                      max={8}
                      step={0.1}
                      onChange={setXdogPhi}
                      compact
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterRedStamp}
                        onChange={(e) => setFilterRedStamp(e.target.checked)}
                        style={{ accentColor: "var(--accent-color)" }}
                      />
                      <span>滤除黄底纹 / 红印章</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaperBgStyle((s) => (s === "source" ? "white" : "source"))}
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold cursor-pointer"
                    >
                      底色：{paperBgStyle === "source" ? "原图" : "纯白"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className={`pt-2 space-y-2 ${dividerTopClass}`}>
            <div className="flex items-center justify-between text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span>2. 底层三合一阻断引擎 (Hybrid Barrier)</span>
            </div>

            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={useCannyBarrier}
                onChange={(e) => setUseCannyBarrier(e.target.checked)}
                style={{ accentColor: "var(--accent-color)" }}
              />
              <span>防线 A：叠加 Canny 边缘闭合骨架（挡高光漏口）</span>
            </label>

            <SliderRow
              label="🔗 形态学闭运算封口 (Gap Close)"
              value={gapCloseRadius}
              min={0}
              max={3}
              suffix="px"
              onChange={setGapCloseRadius}
            />
            <SliderRow
              label="🎨 防线 B：原图色差/色度阻断 (0=关闭)"
              value={fillTolerance}
              min={0}
              max={60}
              onChange={setFillTolerance}
            />
            <SliderRow
              label="📐 防线 C：相邻像素折角梯度阻断 (0=关闭)"
              value={localStepThreshold}
              min={0}
              max={40}
              onChange={setLocalStepThreshold}
            />
            <SliderRow
              label="🧲 细小零件边缘吸附 (天线/杆件填不满时调高)"
              value={edgeAbsorb}
              min={0}
              max={8}
              suffix="px"
              onChange={setEdgeAbsorb}
            />
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              填不满/留白：调高「色差」「梯度」数值（更宽松，设 0 则关闭该防线），或调高「边缘吸附」；
              漏色：反向调小，或调高「封口」。被高光切断的长杆可按住直接划过整根连续填色。
            </p>
          </div>

          {(activeTool === "pen" || activeTool === "lineEraser") && (
            <SliderRow label="封口笔 / 线框橡皮粗细" value={brushRadius} min={1} max={10} suffix="px" onChange={setBrushRadius} />
          )}
        </div>
      )}
    </div>
  );

  // Reusable Used Palette + Reverse Closed-Loop Section (📋 本图已用色卡)
  const renderUsedPaintsSection = () => (
    <div className="space-y-2.5" translate="no">
      <div className="flex items-center justify-between">
        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          <span className="tech-prefix">[RECIPE]</span>
          📋 本图已用色卡
        </span>
        <div className="flex items-center gap-1.5">
          {usedPaintsSummary.length > 0 && (
            <button
              type="button"
              onClick={handleResetAllFills}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline cursor-pointer"
            >
              清空重绘
            </button>
          )}
          <span className="text-[11px] font-bold text-slate-400">{usedPaintsSummary.length} 色</span>
        </div>
      </div>
      {usedPaintsSummary.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">
          在画布上点按或划过装甲区域填色后，这里会自动汇总本图已使用的全部色卡并匹配最接近的数据库实体模型漆，支持一键送往混色台或转为涂装库工程。
        </p>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {usedPaintsSummary.map((item) => {
            const closest = item.closestPaint;
            const closestText = closest
              ? `≈ ${closest.brandZh} ${closest.paint.code} ${closest.paint.name}`
              : item.name || "自定义色";
            return (
              <div
                key={item.hex}
                className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-[var(--accent-color)] px-2 py-1.5 transition"
              >
                <button
                  type="button"
                  onClick={() => {
                    const hsl = hexToHsl(item.hex);
                    if (hsl.s >= 8) setSelectedHue(hsl.h);
                    applyPaintToSelectedRegions(item.hex, {
                      brand: item.brand || closest?.brandZh,
                      code: item.code || closest?.paint.code,
                      name: item.name || closest?.paint.name,
                    });
                  }}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  title="点击复用该颜色或替换当前选中分区"
                >
                  <span
                    className="h-5 w-5 rounded border border-black/20 shrink-0 shadow-2xs"
                    style={{ backgroundColor: item.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      <span className="font-mono">{item.hex}</span>
                      <span className="mx-1 text-slate-400">·</span>
                      <span>{closestText}</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                      {item.regionCount} 处装甲分区
                      {closest ? ` · ΔE ${closest.deltaE.toFixed(1)}` : ""}
                    </div>
                  </div>
                </button>

                {onSendColorToMixer && (
                  <button
                    type="button"
                    onClick={() => onSendColorToMixer(item.hex)}
                    className={`shrink-0 px-2 py-1 text-[10px] font-extrabold transition cursor-pointer ${secondaryActionBtnClass}`}
                    title="将该颜色发往主工作台「混色台 / 调色分解」反推实体漆调色配方"
                  >
                    🧪 调配此色
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dual Primary Actions in Used Palette Card */}
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button
          type="button"
          disabled={imageToken === 0}
          onClick={handleExportCompositePng}
          className={`flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-extrabold transition ${
            imageToken > 0
              ? `${secondaryActionBtnClass} cursor-pointer`
              : "rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
          }`}
        >
          <span>📥 保存高清 PNG</span>
        </button>

        {onCreatePaintProject ? (
          <button
            type="button"
            disabled={imageToken === 0}
            onClick={() => setShowConvertModal(true)}
            className={`flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-black transition ${
              imageToken > 0
                ? `${primaryActionBtnClass} cursor-pointer`
                : "rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
            }`}
          >
            <span>✨ 转为涂装库工程</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResetAllFills}
            className={`py-2 text-xs font-extrabold transition cursor-pointer ${secondaryActionBtnClass}`}
          >
            一键清空重绘
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        isFullscreen
          ? `fixed inset-0 z-[100] w-full h-full overflow-hidden p-2.5 sm:p-3.5 flex flex-col select-none notranslate ${
              isBlueprint
                ? "bg-[#F8FAFC] dark:bg-[#0B0F19]"
                : "bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-xl"
            }`
          : "w-full select-none notranslate"
      }
      style={
        isFullscreen
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              height: "100%",
              zIndex: 100,
              ...(isBlueprint
                ? {
                    backgroundImage:
                      "linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }
                : {}),
            }
          : undefined
      }
      translate="no"
    >
      {/* Main 12-Column Responsive Split Workspace */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch w-full max-w-full min-w-0 ${
          isFullscreen ? "flex-1 min-h-0 h-full" : ""
        }`}
      >
        {/* LEFT WORKSPACE: Interactive Sticky Canvas (Desktop 8-col, or 12-col when palette collapsed) */}
        <div
          className={`${
            isDesktopPaletteCollapsed ? "lg:col-span-12" : "lg:col-span-8"
          } ${
            isFullscreen
              ? "h-full min-h-0"
              : "lg:h-[calc(100vh-204px)] lg:min-h-[540px]"
          } min-w-0 flex flex-col overflow-hidden ${cardSurfaceClass}`}
        >
          {/* Row 1: Upload / Line Mode / Compare / Undo-Redo / Collapse Palette / Fullscreen */}
          <div className={`shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 ${dividerBottomClass}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="tech-prefix text-slate-500 dark:text-slate-400">[STUDIO_CANVAS]</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`${primaryActionBtnClass} px-3 py-1.5 text-xs font-extrabold transition cursor-pointer`}
              >
                📤 {imageToken > 0 ? "更换图片" : "上传图片"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadFile} className="hidden" />

              <div className="gk-tab-bar flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setExtractionMode("xdog")}
                  title="顶层视觉线稿采用 SD ControlNet Lineart 同源 XDoG：抹平曲面光影，只保留刻线与轮廓"
                  className={`gk-tab-pill rounded-lg px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                    extractionMode === "xdog"
                      ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  🎨 XDoG 线稿
                </button>
                <button
                  type="button"
                  onClick={() => setExtractionMode("threshold")}
                  title="对干净扫描线稿直接按灰度软阈值提取（保留原线条粗细）"
                  className={`gk-tab-pill rounded-lg px-2.5 py-1 text-xs font-extrabold transition cursor-pointer ${
                    extractionMode === "threshold"
                      ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  阈值线稿
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* Hold / Toggle Compare Original */}
              <button
                type="button"
                disabled={imageToken === 0}
                onPointerDown={() => setIsComparingOriginal(true)}
                onPointerUp={() => setIsComparingOriginal(false)}
                onPointerLeave={() => setIsComparingOriginal(false)}
                onClick={() => setIsComparingOriginal((v) => !v)}
                className={`px-2.5 py-1.5 text-xs font-extrabold transition ${
                  imageToken === 0
                    ? "rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : isComparingOriginal
                    ? `${primaryActionBtnClass} cursor-pointer`
                    : `${secondaryActionBtnClass} cursor-pointer`
                }`}
                title="按住或点击对比未上色原图"
              >
                👁️ 对比原图
              </button>
              <button
                type="button"
                disabled={undoCount === 0}
                onClick={handleUndo}
                className={`px-2.5 py-1.5 text-xs font-extrabold transition ${
                  undoCount > 0
                    ? `${secondaryActionBtnClass} cursor-pointer`
                    : "rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
              >
                ↶ 撤销 ({undoCount})
              </button>
              <button
                type="button"
                disabled={redoCount === 0}
                onClick={handleRedo}
                className={`px-2.5 py-1.5 text-xs font-extrabold transition ${
                  redoCount > 0
                    ? `${secondaryActionBtnClass} cursor-pointer`
                    : "rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
              >
                ↷ 重做 ({redoCount})
              </button>

              {/* Desktop Collapse / Expand Right Palette Toggle */}
              <button
                type="button"
                onClick={() => setIsDesktopPaletteCollapsed((v) => !v)}
                className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  isDesktopPaletteCollapsed ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
                title={isDesktopPaletteCollapsed ? "展开右侧四维调色引擎面板" : "收起右侧调色面板，画布 100% 满宽显示"}
              >
                <span>{isDesktopPaletteCollapsed ? "⇤ 展开色板" : "⇥ 收起色板"}</span>
              </button>

              {/* Fullscreen Immersion Studio Toggle */}
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  isFullscreen
                    ? primaryActionBtnClass
                    : isBlueprint
                    ? "gk-mech-btn rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-[var(--accent-soft)] text-[var(--accent-color)] dark:text-white shadow-[2px_2px_0px_#0F172A]"
                    : "rounded-xl border border-[var(--accent-color)]/40 bg-[var(--accent-soft)] text-[var(--accent-color)] dark:text-white hover:bg-[var(--accent-color)] hover:text-white shadow-xs"
                }`}
                title={isFullscreen ? "退出全屏沉浸模式 (快捷键 Esc / F)" : "进入全屏沉浸操作模式，彻底消除顶栏与边缘遮挡 (快捷键 F)"}
              >
                <span>{isFullscreen ? "🗗 退出全屏 (Esc)" : "⛶ 全屏操作"}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Shading Mode Switcher */}
          <div
            className={`shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1 bg-slate-50/80 dark:bg-slate-900/60 ${dividerBottomClass}`}
          >
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="tech-prefix">[SHADING]</span>
              <span>{isFullscreen ? "AI 智能分件全屏沉浸视口 (按 Esc 退出全屏)" : "AI 智能分件试色视口"}</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">光影合成：</span>
              <div className="gk-tab-bar flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setRenderMode("flat")}
                  className={`gk-tab-pill rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                    renderMode === "flat"
                      ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  🎨 2D 纯色平涂
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode("intrinsic")}
                  title="动态计算区域中位亮度 L_base，按 ratio = L_i / L_base 迁移原图 3D 曲面阴影与棱角高光"
                  className={`gk-tab-pill rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                    renderMode === "intrinsic"
                      ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  💎 3D 相对光影保留
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode("impcat")}
                  className={`gk-tab-pill rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                    renderMode === "impcat"
                      ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  ✨ 四层光影推导
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Locked Interactive Viewport with Engineering Darkroom Grid + Blueprint 4-Corner Crosshairs */}
          <div
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
            className={`gk-canvas-backdrop engineering-viewport-grid relative w-full ${
              isFullscreen
                ? "flex-1 min-h-0"
                : "h-[50vh] min-h-[320px] max-h-[500px] lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1"
            } overflow-hidden select-none ${
              isFocusAnimating ? "gk-studio-focus-anim" : ""
            } ${
              isSpacePressed || activeTool === "pan"
                ? "cursor-grab active:cursor-grabbing"
                : activeTool === "pen" || activeTool === "lineEraser"
                ? "cursor-crosshair"
                : "cursor-pointer"
            }`}
            style={{
              touchAction: imageToken === 0 ? "pan-y" : "none",
              overscrollBehavior: imageToken === 0 ? "auto" : "contain",
            }}
          >
            {/* 4-Corner Blueprint Industrial Crosshairs (+) */}
            <span className="gk-blueprint-crosshair top-2 left-2">+</span>
            <span className="gk-blueprint-crosshair top-2 right-2">+</span>
            <span className="gk-blueprint-crosshair bottom-2 left-2">+</span>
            <span className="gk-blueprint-crosshair bottom-2 right-2">+</span>

            <div
              ref={stackRef}
              className="absolute left-0 top-0 shadow-2xl"
              style={{
                width: imgSize.w || 1,
                height: imgSize.h || 1,
                transformOrigin: "0 0",
              }}
            >
              <canvas ref={baseCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              <canvas
                ref={fillCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-100"
                style={{ opacity: isComparingOriginal ? 0 : 1 }}
              />
              <canvas
                ref={selectCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ opacity: isComparingOriginal ? 0 : 1 }}
              />
              <canvas
                ref={lineCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-100"
                style={{
                  opacity: isComparingOriginal ? 0 : lineOpacity / 100,
                  mixBlendMode: "multiply",
                }}
              />
            </div>

            {imageToken === 0 && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center p-6"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center gap-2.5 border-2 border-dashed px-8 py-7 text-center transition cursor-pointer ${
                    isBlueprint
                      ? "rounded-[6px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-900 shadow-[3px_3px_0px_#0F172A]"
                      : "rounded-2xl border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-xl hover:border-[var(--accent-color)]"
                  }`}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl text-white shadow-sm"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    📤
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">上传一张图片开始试色</span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 max-w-xs">
                    支持黑白线稿 · 彩色官图 · 实拍照片，或从「调色取色画布 / 涂装库详情」一键发送图片至此
                  </span>
                </button>
              </div>
            )}

            {isComparingOriginal && (
              <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-lg bg-slate-900/85 px-3 py-1 text-xs font-black text-white shadow-lg">
                👁️ 原图对比中
              </div>
            )}

            {selectedRegionIds.length > 0 && (
              <div
                className={`absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 text-xs font-extrabold text-white ${primaryActionBtnClass}`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span>🎯 已选中 {selectedRegionIds.length} 个闭合分区</span>
                <button
                  type="button"
                  onClick={() => setSelectedRegionIds([])}
                  className="rounded bg-black/25 hover:bg-black/40 px-2 py-0.5 text-[10px] text-white cursor-pointer"
                >
                  取消选择
                </button>
              </div>
            )}

            {/* Floating Quick Tool Dock when Desktop Right Palette is Collapsed */}
            {isDesktopPaletteCollapsed && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className={`hidden lg:flex items-center gap-1.5 absolute top-3 right-3 z-20 p-1.5 ${
                  isBlueprint
                    ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-white/95 dark:bg-slate-900/95 shadow-[3px_3px_0px_#0F172A]"
                    : "rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsDesktopPaletteCollapsed(false)}
                  title={`当前喷涂色 ${activeHex}（点击展开调色盘）`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono font-black text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-xs border border-black/20 shrink-0"
                    style={{ backgroundColor: activeHex }}
                  />
                  <span>{activeHex}</span>
                </button>
                <ToolButton
                  active={activeTool === "fill"}
                  onClick={() => setActiveTool("fill")}
                  label="🪣 填色"
                  isBlueprint={isBlueprint}
                />
                <ToolButton
                  active={activeTool === "eraser"}
                  onClick={() => setActiveTool("eraser")}
                  label="🧽 橡皮"
                  isBlueprint={isBlueprint}
                />
                <ToolButton
                  active={activeTool === "pan"}
                  onClick={() => setActiveTool("pan")}
                  label="✋ 平移"
                  isBlueprint={isBlueprint}
                />
                <ToolButton
                  active={activeTool === "select"}
                  onClick={() => setActiveTool("select")}
                  label="🎯 多选"
                  isBlueprint={isBlueprint}
                />
                <ToolButton
                  active={activeTool === "pen"}
                  onClick={() => setActiveTool("pen")}
                  label="✏️ 补线"
                  isBlueprint={isBlueprint}
                />
                <ToolButton
                  active={activeTool === "lineEraser"}
                  onClick={() => setActiveTool("lineEraser")}
                  label="✂️ 擦线"
                  isBlueprint={isBlueprint}
                />
              </div>
            )}

            {/* Dismissible / Restorable Compact Gesture Hint Pill */}
            {!hideCanvasHint ? (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="hidden sm:flex items-center gap-2 absolute bottom-2 right-2.5 z-10 rounded-md bg-slate-900/75 backdrop-blur-xs px-2.5 py-1 text-[10px] font-bold text-white/95 shadow-sm"
              >
                <span>按住左键/单指划过可连续合并填色 · 双指或按住空格平移 · ⌘/Ctrl+滚轮缩放</span>
                <button
                  type="button"
                  onClick={() => setHideCanvasHint(true)}
                  title="隐藏操作提示"
                  className="ml-0.5 rounded px-1 text-[10px] text-white/70 hover:text-white hover:bg-white/15 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setHideCanvasHint(false)}
                title="显示操作提示"
                className="hidden sm:flex items-center justify-center absolute bottom-2 right-2.5 z-10 h-6 w-6 rounded-full bg-slate-900/65 hover:bg-slate-900/85 text-[10px] font-black text-white shadow-sm cursor-pointer"
              >
                ?
              </button>
            )}
          </div>

          {/* Row 4: Zoom bar + Status */}
          <div
            className={`shrink-0 flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 dark:bg-slate-900/80 px-3 py-1.5 ${dividerTopClass}`}
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => zoomAtCenter(1 / 1.25)}
                className={`h-7 w-7 font-black cursor-pointer shrink-0 ${secondaryActionBtnClass}`}
              >
                −
              </button>
              <span
                ref={zoomLabelRef}
                className="min-w-[46px] text-center font-mono text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0"
              >
                100%
              </span>
              <button
                type="button"
                onClick={() => zoomAtCenter(1.25)}
                className={`h-7 w-7 font-black cursor-pointer shrink-0 ${secondaryActionBtnClass}`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => focusRegion(activeCropRef.current, true)}
                className={`h-7 px-2.5 text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0 ${secondaryActionBtnClass}`}
              >
                🎯 复位
              </button>
              <span className="ml-1 text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                {statusMessage}
              </span>
            </div>
            <div className="hidden xl:block text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              闭合 {gapCloseRadius}px · 色差 {fillTolerance} · 梯度 {localStepThreshold} · {imgSize.w}×{imgSize.h}
            </div>
          </div>

          {/* Row 5 (Mobile < 1024px Only): Compact Tool Strip + Bottom Sheet Triggers */}
          <div className={`lg:hidden shrink-0 bg-white dark:bg-slate-900 p-2 space-y-1.5 ${dividerTopClass}`} translate="no">
            {/* Mobile Tools Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <ToolButton
                active={activeTool === "fill"}
                onClick={() => setActiveTool("fill")}
                label="🪣 填色"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "eraser"}
                onClick={() => setActiveTool("eraser")}
                label="🧽 橡皮擦"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "pan"}
                onClick={() => setActiveTool("pan")}
                label="✋ 浏览平移"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "select"}
                onClick={() => setActiveTool("select")}
                label="🎯 选区多选"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "pen"}
                onClick={() => setActiveTool("pen")}
                label="✏️ 补线封口"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "lineEraser"}
                onClick={() => setActiveTool("lineEraser")}
                label="✂️ 擦除黑线"
                primary
                isBlueprint={isBlueprint}
              />
            </div>

            {/* Mobile Bottom Sheet Drawer Triggers */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "palette" ? null : "palette"))}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-extrabold transition cursor-pointer ${
                  mobileDrawer === "palette" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-sm border border-black/20 shrink-0"
                  style={{ backgroundColor: activeHex }}
                />
                <span className="truncate">调色盘</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "params" ? null : "params"))}
                className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-extrabold transition cursor-pointer ${
                  mobileDrawer === "params" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span>⚙️ 线稿/防漏</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "used" ? null : "used"))}
                className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-extrabold transition cursor-pointer ${
                  mobileDrawer === "used" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span>📋 已用色卡({usedPaintsSummary.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT CONTROL PANEL (Desktop >= 1024px: 4-col, Independent Internal Scroll) */}
        <div
          className={`${
            isDesktopPaletteCollapsed ? "hidden" : "hidden lg:flex lg:col-span-4"
          } ${
            isFullscreen
              ? "h-full min-h-0"
              : "lg:h-[calc(100vh-204px)] lg:min-h-[540px]"
          } min-w-0 min-h-0 flex-col overflow-hidden ${cardSurfaceClass}`}
          translate="no"
        >
          <div
            className={`shrink-0 flex items-center justify-between px-3.5 py-2 ${dividerBottomClass}`}
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <PaletteIcon className="w-4 h-4 shrink-0 text-[var(--accent-color)]" weight="bold" />
              <span className="text-xs xl:text-sm font-black text-slate-900 dark:text-white truncate">
                <span className="tech-prefix">[PALETTE]</span>
                GKMixer 四维专业调色引擎
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="text-[10px] font-black tracking-widest uppercase italic hidden xl:inline"
                style={{ color: "var(--accent-color)" }}
              >
                COLOR STUDIO
              </span>
              <button
                type="button"
                onClick={() => setIsDesktopPaletteCollapsed(true)}
                title="收起调色盘，让左侧画布 100% 满宽显示"
                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              >
                ⇥ 收起
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {renderPaletteSection()}
            <div className={`pt-2.5 ${dividerTopClass}`}>{renderUsedPaintsSection()}</div>
            <div className={`pt-2.5 ${dividerTopClass}`}>{renderAlgorithmSection(false)}</div>
          </div>

          {/* Desktop 6-Grid Tools & Export Footer (Compact Zero-Occlusion Dock) */}
          <div className={`shrink-0 bg-white/95 dark:bg-slate-900/95 p-2.5 space-y-1.5 ${dividerTopClass}`} translate="no">
            <div className="grid grid-cols-3 gap-1.5">
              <ToolButton
                active={activeTool === "fill"}
                onClick={() => setActiveTool("fill")}
                label="🪣 填色"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "eraser"}
                onClick={() => setActiveTool("eraser")}
                label="🧽 橡皮擦"
                primary
                isBlueprint={isBlueprint}
              />
              <ToolButton
                active={activeTool === "pan"}
                onClick={() => setActiveTool("pan")}
                label="✋ 浏览平移"
                primary
                isBlueprint={isBlueprint}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <ToolButton
                active={activeTool === "select"}
                onClick={() => setActiveTool("select")}
                label="🎯 选区多选"
                isBlueprint={isBlueprint}
                title="点击或按住滑过多个装甲子块合并为同一选区，再点击调色盘实时换色"
              />
              <ToolButton
                active={activeTool === "pen"}
                onClick={() => setActiveTool("pen")}
                label="✏️ 补线封口"
                isBlueprint={isBlueprint}
                title="手绘黑线焊死未闭合的装甲缝隙"
              />
              <ToolButton
                active={activeTool === "lineEraser"}
                onClick={() => setActiveTool("lineEraser")}
                label="✂️ 擦除黑线"
                isBlueprint={isBlueprint}
                title="擦除多余的噪点黑线"
              />
            </div>
            <div className="grid grid-cols-12 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleExportCompositePng}
                className={`col-span-7 flex items-center justify-between px-3 py-1.5 text-xs font-black transition cursor-pointer ${primaryActionBtnClass}`}
              >
                <span>📥 保存高清 PNG</span>
                <span>↓</span>
              </button>
              <button
                type="button"
                onClick={handleResetAllFills}
                className={`col-span-5 py-1.5 text-xs font-extrabold transition cursor-pointer ${secondaryActionBtnClass}`}
              >
                一键清空重绘
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE NON-BLOCKING BOTTOM SHEET (< 1024px, max-h-[55vh] so >= 45% upper canvas stays visible) */}
      {mobileDrawer !== null && (
        <div
          translate="no"
          className={`lg:hidden fixed inset-x-0 bottom-0 z-[90] max-h-[55vh] flex flex-col border-t shadow-2xl transition-transform ${
            isBlueprint
              ? "border-t-2 border-slate-900 dark:border-slate-600 bg-white dark:bg-[#111827]"
              : "rounded-t-3xl border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl"
          }`}
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {/* Sheet Header */}
          <div className={`shrink-0 flex items-center justify-between px-4 py-2.5 ${dividerBottomClass}`}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileDrawer("palette")}
                className={`px-2.5 py-1 text-xs font-extrabold cursor-pointer ${
                  mobileDrawer === "palette" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                🎨 调色盘
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawer("params")}
                className={`px-2.5 py-1 text-xs font-extrabold cursor-pointer ${
                  mobileDrawer === "params" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                ⚙️ 线稿/防漏
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawer("used")}
                className={`px-2.5 py-1 text-xs font-extrabold cursor-pointer ${
                  mobileDrawer === "used" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                📋 已用色卡({usedPaintsSummary.length})
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawer(null)}
              className={`px-2.5 py-1 text-xs font-black cursor-pointer ${secondaryActionBtnClass}`}
            >
              ✕ 收起
            </button>
          </div>

          {/* Sheet Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
            {mobileDrawer === "palette" && renderPaletteSection()}
            {mobileDrawer === "params" && renderAlgorithmSection(true)}
            {mobileDrawer === "used" && renderUsedPaintsSection()}
          </div>
        </div>
      )}

      {/* Convert to PaintProject Modal */}
      {showConvertModal && (
        <div
          translate="no"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
        >
          <form
            onSubmit={handleConfirmConvertToProject}
            className={`w-full max-w-md p-5 space-y-4 ${cardSurfaceClass}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                ✨ 转为涂装库工程 (含悬浮色卡与工序)
              </h3>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              将自动合成当前试色效果图作为零件图，并计算每个填色分区的像素几何中心点，生成{" "}
              <strong className="text-slate-800 dark:text-slate-100">{usedPaintsSummary.length}</strong> 个可拖拽悬浮色卡与标准涂装工序。
            </p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  涂装工程名称
                </label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="例如：RG 海牛高达 钛合金改色方案"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--accent-color)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  首张零件部位名称
                </label>
                <input
                  type="text"
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  placeholder="例如：主外甲试色总成"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[var(--accent-color)]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className={`px-4 py-2 text-xs font-bold cursor-pointer ${secondaryActionBtnClass}`}
              >
                取消
              </button>
              <button
                type="submit"
                className={`px-4 py-2 text-xs font-black cursor-pointer ${primaryActionBtnClass}`}
              >
                立即生成并前往涂装库 ➔
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Small presentational helpers
// ============================================================================
const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  compact?: boolean;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, suffix = "", compact, onChange }) => {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (
    <div translate="no">
      <div className={`flex justify-between font-bold text-slate-700 dark:text-slate-200 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        <span className="truncate">{label}</span>
        <span className="font-mono shrink-0 ml-1">
          {value.toFixed(decimals)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: "var(--accent-color)" }}
      />
    </div>
  );
};

const ToolButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  primary?: boolean;
  isBlueprint?: boolean;
  title?: string;
}> = ({ active, onClick, label, primary, isBlueprint, title }) => (
  <button
    type="button"
    translate="no"
    onClick={onClick}
    title={title}
    className={`notranslate font-extrabold transition cursor-pointer whitespace-nowrap px-2 ${
      primary ? "py-1.5 text-xs" : "py-1 text-[11px]"
    } ${
      active
        ? isBlueprint
          ? "gk-mech-primary rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
          : "rounded-xl bg-[var(--accent-color)] text-white shadow-sm"
        : isBlueprint
        ? "gk-mech-btn rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
        : primary
        ? "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
        : "rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
    }`}
  >
    {label}
  </button>
);

export default ColoringSandboxLab;
