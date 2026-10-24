import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Palette as PaletteIcon,
  PaintBucket as PaintBucketIcon,
  SelectionPlus as SelectionPlusIcon,
  PencilSimpleLine as PencilSimpleLineIcon,
  Scissors as ScissorsIcon,
  Eraser as EraserIcon,
  HandGrabbing as HandGrabbingIcon,
  Sparkle as SparkleIcon,
  Cube as CubeIcon,
  PaintBrushBroad as PaintBrushBroadIcon,
  Trash as TrashIcon,
  DotsSixVertical as DotsSixVerticalIcon,
  DotsSix as DotsSixIcon,
  CaretLeft as CaretLeftIcon,
  CaretRight as CaretRightIcon,
  CaretUp as CaretUpIcon,
  CaretDown as CaretDownIcon,
} from "@phosphor-icons/react";
import { CatalogPaint, FloatingSwatchNode, Language, PaintProject, PartCanvas, Theme } from "../types";
import { FEATURED_BRANDS, loadPaintCatalog, localizedBrand, nearestCatalogPaintWithDeltaE } from "../utils/paintCatalog";
import { paintBottleUrls } from "../utils/paintBottle";
import PaintBottleHover from "./PaintBottleHover";
import { deltaE2000, labFromHex } from "../utils/ciede2000";
import { inferStepsFromNodes } from "../utils/projectSharing";
import { computeBrandTintRecipe, BrandTintRecipe } from "../utils/brandTintRecipe";
import {
  UIStyle,
  WorkflowMode,
  THEME_SYNC_EVENT,
  loadUIStyle,
  loadWorkflowMode,
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

type ColoringWorkMode = "brand" | "custom";
type ColorFamilyFilter =
  | "all"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "neutral"
  | "metal";

const COLOR_FAMILY_FILTERS: { id: ColorFamilyFilter; label: string; dotStyle: string }[] = [
  { id: "all", label: "全部", dotStyle: " conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)" },
  { id: "red", label: "红", dotStyle: "#EF4444" },
  { id: "orange", label: "橙", dotStyle: "#F97316" },
  { id: "yellow", label: "黄", dotStyle: "#EAB308" },
  { id: "green", label: "绿", dotStyle: "#22C55E" },
  { id: "cyan", label: "青", dotStyle: "#06B6D4" },
  { id: "blue", label: "蓝", dotStyle: "#3B82F6" },
  { id: "purple", label: "紫", dotStyle: "#8B5CF6" },
  { id: "neutral", label: "黑白灰", dotStyle: "linear-gradient(135deg, #F8FAFC 0%, #64748B 50%, #0F172A 100%)" },
  { id: "metal", label: "金银", dotStyle: "linear-gradient(135deg, #FBBF24 0%, #FDE68A 45%, #94A3B8 100%)" },
];

export interface StagedSwatchItem {
  hex: string;
  brand: string;
  code: string;
  name: string;
  pinned?: boolean;
}

export interface SandboxSyncedSwatch {
  id: string;
  hex: string;
  shadeHex: string;
  highlightHex: string;
  brand: string;
  code: string;
  name: string;
  isConfirmed: boolean;
  regionCount: number;
  anchorX: number;
  anchorY: number;
  offsetX: number;
  offsetY: number;
  assignedPaint?: CatalogPaint;
  basePaintHex?: string;
  tintBadgeText?: string;
  recipeSummary?: string;
}

export interface SandboxSyncPayload {
  compositeDataUrl: string | null;
  /** Colors in 备选缓存盘 AND painted on the model */
  syncedSwatches: SandboxSyncedSwatch[];
  /** All colors in 备选缓存盘 */
  stagedSwatches: StagedSwatchItem[];
  activeHex: string;
  hasLoadedImage: boolean;
}

const STAGED_TRAY_STORAGE_KEY = "gk_coloring_staged_tray_v1";
const MAX_STAGED_SWATCHES = 30;

const DEFAULT_STAGED_SWATCHES: StagedSwatchItem[] = [
  { hex: "#2563EB", brand: "盖亚", code: "004", name: "纯正蓝", pinned: true },
  { hex: "#E11D48", brand: "盖亚", code: "003", name: "亮光红", pinned: true },
  { hex: "#F59E0B", brand: "匠域", code: "JW005", name: "橙黄", pinned: true },
  { hex: "#4B5563", brand: "喵匠", code: "HM102", name: "机械骨架灰", pinned: true },
  { hex: "#F8FAFC", brand: "郡士", code: "GX1", name: "冷白", pinned: true },
  { hex: "#7968D8", brand: "夜之工坊", code: "NDL033", name: "海牛紫蓝", pinned: true },
];

const NON_COMMERCIAL_BRANDS = new Set(["Custom", "GK灰阶", "GK矩阵", "GK色系", "和谐推荐", ""]);
function isConfirmedBrandPaint(brand?: string, code?: string): boolean {
  if (!brand || NON_COMMERCIAL_BRANDS.has(brand.trim())) return false;
  if (!code || code === "HEX" || code.startsWith("H") && code.endsWith("°") || code.startsWith("L")) return false;
  return true;
}

function finishShortLabel(finish?: string): string {
  switch (finish) {
    case "metallic":
      return "金属";
    case "pearl":
      return "珍珠";
    case "matte":
      return "消光";
    case "gloss":
      return "亮光";
    case "semi_gloss":
      return "半光";
    case "clear":
      return "透明";
    case "fluorescent":
      return "荧光";
    case "primer":
      return "底漆";
    default:
      return "实色";
  }
}

function getPaintCandidateImageUrls(
  paint: CatalogPaint | { brand: string; code: string; [k: string]: unknown }
): string[] {
  const rec = paint as Record<string, unknown>;
  const explicitUrls: string[] = [];
  for (const key of ["image", "imageUrl", "bottleImage", "thumbnail", "swatchUrl"]) {
    const val = rec[key];
    if (typeof val === "string" && val.trim().length > 0) {
      explicitUrls.push(val.trim());
    }
  }
  const catalogUrls = paintBottleUrls(paint.brand, paint.code);
  return [...explicitUrls, ...catalogUrls];
}

const MiniBottlePreviewBadge: React.FC<{
  brand: string;
  code: string;
  name?: string;
  hex: string;
  isBlueprint: boolean;
}> = ({ brand, code, name, hex, isBlueprint }) => {
  const urls = useMemo(() => paintBottleUrls(brand, code), [brand, code]);
  const [urlIndex, setUrlIndex] = useState(0);
  useEffect(() => setUrlIndex(0), [brand, code]);
  const activeUrl = urls[urlIndex];
  if (!activeUrl) return null;

  return (
    <PaintBottleHover
      brand={brand}
      code={code}
      name={name}
      hex={hex}
      className={`w-9 h-9 shrink-0 bg-white flex items-center justify-center overflow-hidden ${
        isBlueprint
          ? "rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 shadow-[1.5px_1.5px_0px_#0F172A]"
          : "rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs"
      }`}
    >
      <img
        src={activeUrl}
        alt={name || `${brand} ${code}`}
        loading="lazy"
        crossOrigin="anonymous"
        className="w-full h-full object-contain p-0.5"
        onError={() => setUrlIndex((i) => i + 1)}
      />
    </PaintBottleHover>
  );
};

const BrandPaintCardHeader: React.FC<{
  paint: CatalogPaint;
  brandZh: string;
  isBlueprint: boolean;
  onStageClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ paint, brandZh, isBlueprint, onStageClick }) => {
  const urls = useMemo(() => getPaintCandidateImageUrls(paint), [paint]);
  const [urlIndex, setUrlIndex] = useState(0);
  useEffect(() => setUrlIndex(0), [paint.brand, paint.code]);
  const activeUrl = urls[urlIndex];
  const hasBottleImage = Boolean(activeUrl);
  const isMetallicOrPearl = paint.finish === "metallic" || paint.finish === "pearl";
  const finishBadge = finishShortLabel(paint.finish);

  return (
    <div
      className={`h-10 min-h-[40px] w-full flex items-stretch overflow-hidden mb-1.5 ${
        isBlueprint
          ? "rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-400"
          : "rounded-lg border border-slate-200/80 dark:border-slate-700/80"
      }`}
    >
      {/* Left Slot: Product Bottle / Swatch Thumbnail (Auto-hides on missing or error so right HEX bar fills 100%) */}
      {hasBottleImage && (
        <PaintBottleHover
          brand={brandZh}
          code={paint.code}
          name={paint.name}
          hex={paint.hex}
          className="w-10 h-10 shrink-0 bg-white border-r border-slate-900/20 flex items-center justify-center relative"
        >
          <img
            src={activeUrl}
            alt={paint.name}
            loading="lazy"
            crossOrigin="anonymous"
            className="w-full h-full object-contain p-0.5 transition-transform duration-150 group-hover:scale-105"
            onError={() => setUrlIndex((i) => i + 1)}
          />
        </PaintBottleHover>
      )}

      {/* Right Slot: Main HEX Color Window (+ Metallic/Pearl Sheen + Fallback Finish Badge + [+备] Button) */}
      <div
        className="flex-1 h-full relative"
        style={{ backgroundColor: paint.hex }}
      >
        {isMetallicOrPearl && (
          <span
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)",
            }}
          />
        )}

        {/* Fallback Finish Micro-Badge in Top-Left when no bottle image */}
        {!hasBottleImage && (
          <span
            className={`pointer-events-none absolute top-1 left-1 px-1 py-0.5 text-[8px] font-black leading-none ${
              isBlueprint
                ? "rounded-[2px] border border-slate-900/80 bg-white/90 text-slate-900 font-mono"
                : "rounded bg-black/45 text-white backdrop-blur-xs"
            }`}
          >
            {finishBadge}
          </span>
        )}

        {/* Top-Right Compact [+备] Stage Button */}
        <button
          type="button"
          onClick={onStageClick}
          title="📌 暂存至上方备选调色盘"
          className={`absolute top-1 right-1 z-10 px-1 py-0.5 text-[8px] font-black cursor-pointer leading-none transition ${
            isBlueprint
              ? "rounded-[3px] border-[1.5px] border-slate-900 bg-white/95 dark:bg-slate-800/95 hover:bg-[var(--accent-color)] hover:text-white text-slate-900 dark:text-slate-100 shadow-[1px_1px_0px_#0F172A] font-mono"
              : "rounded bg-white/90 dark:bg-slate-800/90 hover:bg-[var(--accent-color)] hover:text-white text-slate-700 dark:text-slate-100 shadow-2xs backdrop-blur-xs"
          }`}
        >
          +备
        </button>
      </div>
    </div>
  );
};

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

function matchesColorFamily(paint: CatalogPaint, family: ColorFamilyFilter): boolean {
  if (family === "all") return true;
  const isMetal =
    paint.finish === "metallic" ||
    /[金银铁钢铜钛铝铬枪黑金属]|metal|gold|silver|iron|steel|titanium|copper|brass/i.test(
      `${paint.name} ${paint.set || ""}`
    );
  if (family === "metal") return isMetal;
  const hsl = hexToHsl(paint.hex);
  const isNeutral = hsl.s <= 14 || hsl.l <= 13 || hsl.l >= 91;
  if (family === "neutral") return isNeutral && !isMetal;
  if (isNeutral) return false;
  switch (family) {
    case "red":
      return hsl.h >= 338 || hsl.h < 16;
    case "orange":
      return hsl.h >= 16 && hsl.h < 42;
    case "yellow":
      return hsl.h >= 42 && hsl.h < 72;
    case "green":
      return hsl.h >= 72 && hsl.h < 162;
    case "cyan":
      return hsl.h >= 162 && hsl.h < 200;
    case "blue":
      return hsl.h >= 200 && hsl.h < 255;
    case "purple":
      return hsl.h >= 255 && hsl.h < 338;
    default:
      return true;
  }
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
 * four-layer = ✨ 四层光影推导 (Base / Shade / Highlight / Specular 4-step synthesis, default)
 * intrinsic  = 💎 3D 相对光影保留 (L_i / L_base relative luminance transfer)
 * flat       = 🎨 2D 纯色平涂 (Pure flat color fill)
 */
type RenderShadingMode = "four-layer" | "intrinsic" | "flat";
type DockPosition = "left" | "right" | "top" | "bottom";
export interface ToolDockPosition {
  side: DockPosition; // 决定工具坞展开时是垂直列(left/right)还是水平行(top/bottom)
  xRatio: number; // 距离画布左边缘的归一化比例 (0.0 ~ 1.0)，默认初始值 0.02 (靠左)
  yRatio: number; // 距离画布上边缘的归一化比例 (0.0 ~ 1.0)，默认初始值 0.50 (垂直居中)
  isInitialCentered?: boolean;
}
const DOCK_POS_STORAGE_KEY = "gk_coloring_dock_pos_v2";
const DOCK_COLLAPSED_STORAGE_KEY = "gk_coloring_dock_collapsed_v1";
const RIGHT_PANEL_WIDTH_STORAGE_KEY = "gk_coloring_right_panel_width_v1";
const MIN_RIGHT_PANEL_WIDTH = 380;
const MAX_RIGHT_PANEL_WIDTH = 560;
const MIN_LEFT_CANVAS_WIDTH = 520;
const DEFAULT_RIGHT_PANEL_WIDTH = 420;
export type ScenePresetKey = "lineart_card" | "cg_recolor" | "photo_miniature";
type GestureMode = "none" | "fillStroke" | "pan" | "draw" | "pinch";

function findNearestMatrixCell(l: number, s: number): { l: number; s: number } {
  let bestL = MATRIX_LIGHTNESS_ROWS[0].l;
  let minLDiff = Infinity;
  for (const r of MATRIX_LIGHTNESS_ROWS) {
    const diff = Math.abs(r.l - l);
    if (diff < minLDiff) {
      minLDiff = diff;
      bestL = r.l;
    }
  }
  let bestS = MATRIX_SATURATION_COLS[0].s;
  let minSDiff = Infinity;
  for (const c of MATRIX_SATURATION_COLS) {
    const diff = Math.abs(c.s - s);
    if (diff < minSDiff) {
      minSDiff = diff;
      bestS = c.s;
    }
  }
  return { l: bestL, s: bestS };
}

interface ColoringSandboxLabProps {
  onCloseLab?: () => void;
  lang?: Language;
  theme?: Theme;
  setTheme?: (t: Theme) => void;
  incomingImage?: { url: string; label?: string; token: number } | null;
  onSendColorToMixer?: (hex: string) => void;
  onNavigateToBrandTint?: (hex: string) => void;
  onCreatePaintProject?: (project: PaintProject) => void;
  externalCatalogPaints?: CatalogPaint[];
  isActiveTab?: boolean;
  onSyncSandboxState?: (payload: SandboxSyncPayload) => void;
  externalBrandAssignment?: {
    targetHex: string;
    paint: CatalogPaint;
    token: number;
  } | null;
}

export const ColoringSandboxLab: React.FC<ColoringSandboxLabProps> = ({
  lang = "zh",
  incomingImage,
  onSendColorToMixer,
  onNavigateToBrandTint,
  onCreatePaintProject,
  externalCatalogPaints,
  isActiveTab = true,
  onSyncSandboxState,
  externalBrandAssignment,
}) => {
  const brandLang = (lang === "en" || lang === "ja" ? lang : "zh") as "en" | "zh" | "ja";

  const [uiStyle, setUiStyle] = useState<UIStyle>(() => loadUIStyle());
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(() => loadWorkflowMode());
  const isBlueprint = uiStyle === "blueprint";

  useEffect(() => {
    const sync = () => {
      setUiStyle(loadUIStyle());
      setWorkflowMode(loadWorkflowMode());
    };
    window.addEventListener(THEME_SYNC_EVENT, sync);
    return () => window.removeEventListener(THEME_SYNC_EVENT, sync);
  }, []);

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
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
  const [scenePreset, setScenePreset] = useState<ScenePresetKey>("cg_recolor");
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("xdog");
  const [renderMode, setRenderMode] = useState<RenderShadingMode>("four-layer");
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
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed) && parsed >= MIN_RIGHT_PANEL_WIDTH && parsed <= MAX_RIGHT_PANEL_WIDTH) {
        return Math.round(parsed);
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_RIGHT_PANEL_WIDTH;
  });
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [hideCanvasHint, setHideCanvasHint] = useState(false);
  const [coloringMode, setColoringMode] = useState<ColoringWorkMode>("custom");
  const [catalogColorFamily, setCatalogColorFamily] = useState<ColorFamilyFilter>("all");
  const [assigningTargetHex, setAssigningTargetHex] = useState<string | null>(null);
  const [stagedSwatches, setStagedSwatches] = useState<StagedSwatchItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(STAGED_TRAY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, MAX_STAGED_SWATCHES);
        }
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_STAGED_SWATCHES;
  });
  const [toolDockPos, setToolDockPos] = useState<ToolDockPosition>(() => {
    try {
      const saved = window.localStorage.getItem(DOCK_POS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          (parsed.side === "left" || parsed.side === "right" || parsed.side === "top" || parsed.side === "bottom") &&
          typeof parsed.xRatio === "number" &&
          typeof parsed.yRatio === "number"
        ) {
          return {
            side: parsed.side,
            xRatio: Math.max(0, Math.min(1, parsed.xRatio)),
            yRatio: Math.max(0, Math.min(1, parsed.yRatio)),
          };
        }
      }
    } catch {
      /* ignore */
    }
    return { side: "left", xRatio: 0.02, yRatio: 0.5, isInitialCentered: true };
  });
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DOCK_COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [showShadingPopover, setShowShadingPopover] = useState(false);
  const [dockMetrics, setDockMetrics] = useState<{
    vw: number;
    vh: number;
    dockW: number;
    dockH: number;
  }>({ vw: 800, vh: 600, dockW: 54, dockH: 416 });
  const [dockDragState, setDockDragState] = useState<{
    x: number;
    y: number;
    previewSide: DockPosition;
    mode: "expanded" | "collapsed";
  } | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("AI 试色方案");
  const [newPartName, setNewPartName] = useState("主外甲试色总成");

  // Algorithm parameters — Visual Lineart Layer (XDoG / Threshold)
  const [lineThreshold, setLineThreshold] = useState(165);
  const [lineSoftness, setLineSoftness] = useState(35);
  const [filterRedStamp, setFilterRedStamp] = useState(false);
  // XDoG Lineart parameters (σ is debounced: blur pyramid ≈100ms; p/ε/φ are a ~50ms pointwise pass)
  const [xdogSigma, setXdogSigma] = useState(0.9);
  const [xdogSigmaApplied, setXdogSigmaApplied] = useState(0.9);
  const [xdogP, setXdogP] = useState(20);
  const [xdogEpsilon, setXdogEpsilon] = useState(0.78);
  const [xdogPhi, setXdogPhi] = useState(2.5);
  const [xdogInkFill, setXdogInkFill] = useState(false);
  const [showXdogAdvanced, setShowXdogAdvanced] = useState(false);

  useEffect(() => {
    if (xdogSigma === xdogSigmaApplied) return;
    const t = window.setTimeout(() => setXdogSigmaApplied(xdogSigma), 140);
    return () => window.clearTimeout(t);
  }, [xdogSigma, xdogSigmaApplied]);

  // Hybrid 3-Barrier Engine parameters
  // Barrier A: XDoG + Canny Union + Morphological Closing
  const [useCannyBarrier, setUseCannyBarrier] = useState(true);
  const [cannyLow, setCannyLow] = useState(26);
  const [cannyHigh, setCannyHigh] = useState(68);
  const [gapCloseRadius, setGapCloseRadius] = useState(1);
  // Barrier B: Source Chroma / Redmean Color Distance Tolerance (0 = off, 26 = CG default)
  const [fillTolerance, setFillTolerance] = useState(26);
  // Barrier C: 1px/2px Neighbor Local Gradient Step Barrier (0 = off, 15 = CG/Photo default)
  const [localStepThreshold, setLocalStepThreshold] = useState(15);
  // Edge absorb: extra color-guided rings that eat fattened wall pixels so thin parts fill to their edges
  const [edgeAbsorb, setEdgeAbsorb] = useState(3);

  const [lineOpacity, setLineOpacity] = useState(45);
  const [brushRadius, setBrushRadius] = useState(3);
  const [paperBgStyle, setPaperBgStyle] = useState<"source" | "white">("source");
  // Default collapsed so the right panel focuses 100% on coloring
  const [showAlgorithmPanel, setShowAlgorithmPanel] = useState(false);

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
      setRenderMode(quiet ? "four-layer" : "flat");
      setLineOpacity(92);
      if (!quiet) {
        setStatusMessage("已启用「📄 黑白线稿/试色卡」预设：XDoG 线框阻断 + 🎨 2D 纯色平涂 + 1.5px 抗锯齿下潜");
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
      setRenderMode(quiet ? "four-layer" : "intrinsic");
      setLineOpacity(35);
      if (!quiet) {
        setStatusMessage(
          "已启用「🤖 彩色官图/成品改色」预设：三合一复合阻断 (色差26 + 局部梯度15) + 💎 3D 相对光影保留 + 35% 视觉线框"
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
      setRenderMode("four-layer");
      setLineOpacity(65);
      if (!quiet) {
        setStatusMessage("已启用「🗿 素组灰模/实拍照片」预设：XDoG+Canny 2px 闭运算焊死断口 + 局部梯度阻断 + ✨ 四层光影推导");
      }
    }
  }, []);

  // Active paint & impCAT triad
  const [activeHex, setActiveHex] = useState("#7968D8");
  const [activePaintMeta, setActivePaintMeta] = useState<{ brand?: string; code?: string; name?: string }>({
    brand: "夜之工坊",
    code: "NDL033",
    name: "海牛紫蓝",
  });
  // Staging Anchor: The benchmark paint selected from [STAGING] or [Brand Catalog] that drives the 360° Hue Slider, 5×5 Matrix Anchor, and [HARMONY] Recommendations
  const [stagingAnchor, setStagingAnchor] = useState<StagedSwatchItem>(() =>
    stagedSwatches[0] || DEFAULT_STAGED_SWATCHES[0]
  );
  const [selectedHue, setSelectedHue] = useState<number>(260);
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ l: number; s: number }>({ l: 55, s: 65 });
  const [harmonyMode, setHarmonyMode] = useState<HarmonyMode>("analogous");
  const [copiedHex, setCopiedHex] = useState(false);
  const [isFocusAnimating, setIsFocusAnimating] = useState(false);
  const [customShadeHex, setCustomShadeHex] = useState<string | null>(null);
  const [customHighlightHex, setCustomHighlightHex] = useState<string | null>(null);

  const clampRightPanelWidth = useCallback((rawWidth: number): number => {
    const containerW =
      splitContainerRef.current?.clientWidth ||
      (typeof window !== "undefined" ? window.innerWidth : 1280);
    const maxByRatio = Math.floor(containerW * 0.48);
    const maxByLeftGuard = containerW - MIN_LEFT_CANVAS_WIDTH - 10;
    const effectiveMax = Math.max(
      MIN_RIGHT_PANEL_WIDTH,
      Math.min(MAX_RIGHT_PANEL_WIDTH, maxByRatio, maxByLeftGuard)
    );
    return Math.round(Math.min(Math.max(rawWidth, MIN_RIGHT_PANEL_WIDTH), effectiveMax));
  }, []);

  useEffect(() => {
    const onWinResize = () => {
      setRightPanelWidth((prev) => clampRightPanelWidth(prev));
    };
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, [clampRightPanelWidth]);

  const activeTriad = useMemo(() => {
    const auto = deriveImpcatTriad(activeHex);
    return {
      baseHex: auto.baseHex,
      shadeHex: customShadeHex || auto.shadeHex,
      highlightHex: customHighlightHex || auto.highlightHex,
    };
  }, [activeHex, customShadeHex, customHighlightHex]);

  // Staging & Recent Swatches Tray helpers
  const persistStagedSwatches = useCallback((next: StagedSwatchItem[]) => {
    setStagedSwatches(next);
    try {
      window.localStorage.setItem(STAGED_TRAY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const pushSwatchToTray = useCallback(
    (item: StagedSwatchItem, notify = false) => {
      const normHex = item.hex.toUpperCase();
      setStagedSwatches((prev) => {
        const filtered = prev.filter((s) => s.hex.toUpperCase() !== normHex);
        const existing = prev.find((s) => s.hex.toUpperCase() === normHex);
        const merged: StagedSwatchItem = {
          hex: normHex,
          brand: isConfirmedBrandPaint(item.brand, item.code)
            ? item.brand
            : existing && isConfirmedBrandPaint(existing.brand, existing.code)
            ? existing.brand
            : item.brand,
          code: isConfirmedBrandPaint(item.brand, item.code)
            ? item.code
            : existing && isConfirmedBrandPaint(existing.brand, existing.code)
            ? existing.code
            : item.code,
          name: isConfirmedBrandPaint(item.brand, item.code)
            ? item.name
            : existing && isConfirmedBrandPaint(existing.brand, existing.code)
            ? existing.name
            : item.name,
          pinned: item.pinned ?? existing?.pinned,
        };
        const combined = [merged, ...filtered];
        if (combined.length <= MAX_STAGED_SWATCHES) {
          try {
            window.localStorage.setItem(STAGED_TRAY_STORAGE_KEY, JSON.stringify(combined));
          } catch {
            /* ignore */
          }
          return combined;
        }
        // When exceeding MAX_STAGED_SWATCHES, never evict colors currently painted on the model canvas
        const paintedHexes = new Set<string>();
        for (const r of regionsRef.current.values()) {
          paintedHexes.add(r.baseHex.toUpperCase());
        }
        const next: StagedSwatchItem[] = [];
        for (const itemSw of combined) {
          if (next.length < MAX_STAGED_SWATCHES || paintedHexes.has(itemSw.hex.toUpperCase())) {
            next.push(itemSw);
          }
        }
        try {
          window.localStorage.setItem(STAGED_TRAY_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      if (notify) {
        setStatusMessage(`📌 已暂存备选色：${item.brand} ${item.code} ${item.name} (${normHex})`);
      }
    },
    []
  );

  const removeStagedSwatch = useCallback((hex: string) => {
    const norm = hex.toUpperCase();
    setStagedSwatches((prev) => {
      const next = prev.filter((s) => s.hex.toUpperCase() !== norm);
      try {
        window.localStorage.setItem(STAGED_TRAY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Paint database
  const [catalogPaints, setCatalogPaints] = useState<CatalogPaint[]>([]);
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

  /** Returns Top 3 closest commercial brand paints (diverse brands preferred) for 1-click Paint Assignment */
  const findTopClosestCatalogPaints = useCallback(
    (hex: string, limit = 3): { paint: CatalogPaint; deltaE: number; brandZh: string }[] => {
      if (!catalogPaints.length) return [];
      const target = labFromHex(hex);
      if (!target) return [];
      const candidates: { paint: CatalogPaint; deltaE: number; isFeatured: boolean }[] = [];
      for (const p of catalogPaints) {
        if (p.finish !== "standard") continue;
        const pLab =
          p.lab && p.lab.length >= 3
            ? { l: p.lab[0], a: p.lab[1], b: p.lab[2] }
            : labFromHex(p.hex);
        if (!pLab) continue;
        const dE = deltaE2000(target, pLab);
        const isFeatured = featuredBrandsSet.has(p.brand);
        if (dE < 18) {
          candidates.push({ paint: p, deltaE: dE, isFeatured });
        }
      }
      candidates.sort((a, b) => {
        const scoreA = a.deltaE - (a.isFeatured ? 0.45 : 0);
        const scoreB = b.deltaE - (b.isFeatured ? 0.45 : 0);
        return scoreA - scoreB;
      });
      const picked: { paint: CatalogPaint; deltaE: number; brandZh: string }[] = [];
      const usedBrands = new Set<string>();
      for (const c of candidates) {
        if (picked.length >= limit) break;
        if (!usedBrands.has(c.paint.brand) || picked.length === 0) {
          usedBrands.add(c.paint.brand);
          picked.push({
            paint: c.paint,
            deltaE: c.deltaE,
            brandZh: localizedBrand(c.paint.brand, brandLang),
          });
        }
      }
      if (picked.length < limit) {
        for (const c of candidates) {
          if (picked.length >= limit) break;
          if (!picked.some((x) => x.paint.id === c.paint.id)) {
            picked.push({
              paint: c.paint,
              deltaE: c.deltaE,
              brandZh: localizedBrand(c.paint.brand, brandLang),
            });
          }
        }
      }
      return picked;
    },
    [catalogPaints, featuredBrandsSet, brandLang]
  );

  const activeTopMatches = useMemo(
    () => findTopClosestCatalogPaints(activeHex, 3),
    [findTopClosestCatalogPaints, activeHex]
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

  // Nearest 5×5 matrix cell corresponding to the currently selected Staging Anchor paint
  const anchorMatrixCell = useMemo(() => {
    const hsl = hexToHsl(stagingAnchor.hex);
    return findNearestMatrixCell(hsl.l, hsl.s);
  }, [stagingAnchor.hex]);

  const harmonyAnchorLabel = useMemo(() => {
    if (isConfirmedBrandPaint(stagingAnchor.brand, stagingAnchor.code)) {
      return `${stagingAnchor.brand} ${stagingAnchor.code}`;
    }
    if (stagingAnchor.name && stagingAnchor.name !== stagingAnchor.hex) {
      return `${stagingAnchor.name}`;
    }
    return stagingAnchor.hex;
  }, [stagingAnchor]);

  // Harmony Generator deeply bound to the selected Staging Anchor (preserving its true H, S, L & saturation character)
  const harmonySwatches = useMemo(() => {
    const anchorHex = (stagingAnchor?.hex || activeHex).toUpperCase();
    const hsl = hexToHsl(anchorHex);
    const baseH = hsl.s < 4 ? selectedHue : hsl.h;
    const baseS = hsl.s < 8 ? 52 : hsl.s;
    const baseL = Math.max(24, Math.min(80, hsl.l));
    const clampPct = (v: number, lo = 14, hi = 92) => Math.max(lo, Math.min(hi, Math.round(v)));

    if (harmonyMode === "analogous") {
      return [
        {
          role: "高光浅阶",
          tag: "L+16",
          hex: hslToHex(baseH, clampPct(baseS * 0.88, 14, 94), clampPct(baseL + 16, 24, 88)),
        },
        {
          role: "邻近冷阶",
          tag: "-28°",
          hex: hslToHex((baseH - 28 + 360) % 360, clampPct(baseS * 0.96, 16, 94), baseL),
        },
        { role: "基准主色", tag: "0°主", hex: anchorHex },
        {
          role: "邻近暖阶",
          tag: "+28°",
          hex: hslToHex((baseH + 28) % 360, clampPct(baseS * 0.96, 16, 94), baseL),
        },
        {
          role: "暗部深阶",
          tag: "L-16",
          hex: hslToHex(baseH, clampPct(baseS * 1.08, 18, 96), clampPct(baseL - 16, 16, 78)),
        },
      ];
    }
    if (harmonyMode === "complementary") {
      const compH = (baseH + 180) % 360;
      const compS = clampPct(baseS * 1.05, 24, 92);
      return [
        {
          role: "主甲亮色",
          tag: "0°亮",
          hex: hslToHex(baseH, clampPct(baseS * 0.88, 16, 94), clampPct(baseL + 15, 26, 86)),
        },
        { role: "基准主色", tag: "0°主", hex: anchorHex },
        {
          role: "主甲暗部",
          tag: "0°暗",
          hex: hslToHex(baseH, clampPct(baseS * 1.06, 18, 95), clampPct(baseL - 15, 16, 78)),
        },
        {
          role: "互补撞色",
          tag: "+180°",
          hex: hslToHex(compH, compS, clampPct(baseL, 36, 68)),
        },
        {
          role: "撞色高光",
          tag: "+180°亮",
          hex: hslToHex(compH, clampPct(compS * 0.85, 20, 88), clampPct(baseL + 16, 48, 82)),
        },
      ];
    }
    if (harmonyMode === "split") {
      const split1 = (baseH + 150) % 360;
      const split2 = (baseH + 210) % 360;
      return [
        { role: "基准主色", tag: "0°主", hex: anchorHex },
        {
          role: "主色深层",
          tag: "0°暗",
          hex: hslToHex(baseH, clampPct(baseS * 1.05, 18, 94), clampPct(baseL - 16, 16, 76)),
        },
        {
          role: "分裂副色",
          tag: "+150°",
          hex: hslToHex(split1, clampPct(baseS * 0.94, 22, 90), clampPct(baseL + 2, 34, 70)),
        },
        {
          role: "警示点缀",
          tag: "+210°",
          hex: hslToHex(split2, clampPct(baseS * 1.08, 28, 94), clampPct(baseL + 4, 38, 72)),
        },
        {
          role: "中和装甲灰",
          tag: "低饱",
          hex: hslToHex(baseH, clampPct(baseS * 0.24, 10, 26), clampPct(baseL + 12, 58, 78)),
        },
      ];
    }
    // triadic
    const tri1 = (baseH + 120) % 360;
    const tri2 = (baseH + 240) % 360;
    return [
      { role: "第一主色", tag: "0°主", hex: anchorHex },
      {
        role: "第二主色",
        tag: "+120°",
        hex: hslToHex(tri1, clampPct(baseS * 0.96, 24, 92), clampPct(baseL, 34, 68)),
      },
      {
        role: "第三主色",
        tag: "+240°",
        hex: hslToHex(tri2, clampPct(baseS * 0.96, 24, 92), clampPct(baseL, 34, 68)),
      },
      {
        role: "三角浅阶",
        tag: "+120°亮",
        hex: hslToHex(tri1, clampPct(baseS * 0.72, 18, 82), clampPct(baseL + 18, 52, 84)),
      },
      {
        role: "压阵骨架灰",
        tag: "骨架",
        hex: hslToHex(baseH, clampPct(baseS * 0.22, 10, 24), 32),
      },
    ];
  }, [stagingAnchor, activeHex, harmonyMode, selectedHue]);

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
      if (catalogColorFamily !== "all" && !matchesColorFamily(p, catalogColorFamily)) continue;
      if (tokens.length > 0) {
        const hay = `${p.brand} ${localizedBrand(p.brand, "zh")} ${p.code} ${p.name} ${p.hex}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) continue;
      }
      out.push(p);
      if (out.length >= 72) break;
    }
    return out;
  }, [catalogPaints, catalogSearch, catalogBrandFilter, catalogColorFamily]);

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
    if (renderMode === "four-layer") {
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
          // Sample chroma & luminance distribution to accurately distinguish:
          // - lineart_card (true black-and-white lineart on bright white paper, no dark background or color)
          // - cg_recolor (colored official art / CG / painted model, including mostly-white mecha with colored accents)
          // - photo_miniature (unpainted grey primer / resin / low-saturation miniature photo)
          let chromaSum = 0;
          let coloredCount = 0;
          let brightWhiteCount = 0;
          let darkPixelCount = 0;
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
            const chroma = maxC - minC;
            chromaSum += chroma;
            if (chroma > 24) coloredCount++;
            const gr = cache.gray[i];
            if (gr >= 230 && chroma < 16) brightWhiteCount++;
            else if (gr < 65) darkPixelCount++;
            else midToneCount++;
            samples++;
          }
          const total = Math.max(1, samples);
          const avgChroma = chromaSum / total;
          const coloredRatio = coloredCount / total;
          const brightWhiteRatio = brightWhiteCount / total;
          const darkPixelRatio = darkPixelCount / total;
          const midRatio = midToneCount / total;

          const isPureLineartOnWhite =
            brightWhiteRatio > 0.65 &&
            darkPixelRatio < 0.12 &&
            coloredRatio < 0.02 &&
            midRatio < 0.22;

          if (isPureLineartOnWhite) {
            applyScenePreset("lineart_card", true);
          } else if (coloredRatio >= 0.022 || avgChroma > 7) {
            applyScenePreset("cg_recolor", true);
          } else {
            applyScenePreset("photo_miniature", true);
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
    pushSwatchToTray(
      {
        hex: triad.baseHex,
        brand: meta?.brand || "Custom",
        code: meta?.code || "HEX",
        name: meta?.name || triad.baseHex,
      },
      false
    );
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
        pushSwatchToTray(
          {
            hex: activeTriad.baseHex,
            brand: activePaintMeta.brand || "Custom",
            code: activePaintMeta.code || "HEX",
            name: activePaintMeta.name || activeTriad.baseHex,
          },
          false
        );
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

  // Mobile Crosshair Selector Ring (准星选取器: 手指按住底部边缘移动，环中心十字准星即为取色/填色点)
  const [thumbOffsetMode, setThumbOffsetMode] = useState<boolean>(true);
  const studioLoupeContainerRef = useRef<HTMLDivElement>(null);
  const studioLoupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const hideStudioTouchSight = useCallback(() => {
    if (studioLoupeContainerRef.current) {
      studioLoupeContainerRef.current.style.opacity = "0";
      studioLoupeContainerRef.current.style.transform = "translate3d(-9999px, -9999px, 0)";
    }
  }, []);

  const resolveStudioTouchTarget = useCallback(
    (touchX: number, touchY: number): { targetX: number; targetY: number } => {
      if (!thumbOffsetMode) {
        return { targetX: touchX, targetY: touchY };
      }
      const vp = viewportRef.current;
      // Ring diameter = 92px -> radius = 46px, so the finger rests on the bottom edge of the ring
      // while the center crosshair of the ring sits 46px above the finger!
      const edgeRadiusOffsetPx = 46;
      if (!vp) {
        return { targetX: touchX, targetY: touchY - edgeRadiusOffsetPx };
      }
      const rect = vp.getBoundingClientRect();
      const targetX = Math.max(rect.left + 2, Math.min(rect.right - 2, touchX));
      const targetY = Math.max(
        rect.top + 2,
        Math.min(rect.bottom - 2, touchY - edgeRadiusOffsetPx)
      );
      return { targetX, targetY };
    },
    [thumbOffsetMode]
  );

  const updateStudioTouchSight = useCallback(
    (
      targetX: number,
      targetY: number,
      _touchX: number,
      _touchY: number,
      imgPt: { x: number; y: number } | null
    ) => {
      if (!imgPt || dimsRef.current.w <= 0) {
        hideStudioTouchSight();
        return;
      }

      const loupeCanvas = studioLoupeCanvasRef.current;
      const loupeContainer = studioLoupeContainerRef.current;
      if (loupeCanvas && loupeContainer) {
        const LSIZE = 92;
        // Modest ~2.3x low-zoom lens so surrounding part contours and panel lines are clearly visible
        const effectiveScale = Math.max(0.25, viewRef.current.scale || 1);
        const srcSpan = Math.max(16, Math.round((LSIZE / 2.3) / effectiveScale));
        const half = Math.floor(srcSpan / 2);
        const sx = Math.round(imgPt.x - half);
        const sy = Math.round(imgPt.y - half);
        const ctx = loupeCanvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, LSIZE, LSIZE);
          try {
            if (baseCanvasRef.current) {
              ctx.drawImage(baseCanvasRef.current, sx, sy, srcSpan, srcSpan, 0, 0, LSIZE, LSIZE);
            }
            if (fillCanvasRef.current && !isComparingOriginal) {
              ctx.drawImage(fillCanvasRef.current, sx, sy, srcSpan, srcSpan, 0, 0, LSIZE, LSIZE);
            }
            if (lineCanvasRef.current && !isComparingOriginal && lineOpacity > 0) {
              ctx.save();
              ctx.globalAlpha = lineOpacity / 100;
              ctx.globalCompositeOperation = "multiply";
              ctx.drawImage(lineCanvasRef.current, sx, sy, srcSpan, srcSpan, 0, 0, LSIZE, LSIZE);
              ctx.restore();
            }
          } catch {
            // ignore edge draw
          }

          // Crisp tactical Crosshair Reticle (+) at the exact center of the Selector Ring
          const mid = LSIZE / 2;
          const gap = 5;
          ctx.strokeStyle = "rgba(15, 23, 42, 0.78)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(mid, 6);
          ctx.lineTo(mid, mid - gap);
          ctx.moveTo(mid, mid + gap);
          ctx.lineTo(mid, LSIZE - 6);
          ctx.moveTo(6, mid);
          ctx.lineTo(mid - gap, mid);
          ctx.moveTo(mid + gap, mid);
          ctx.lineTo(LSIZE - 6, mid);
          ctx.stroke();

          ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(mid, 6);
          ctx.lineTo(mid, mid - gap);
          ctx.moveTo(mid, mid + gap);
          ctx.lineTo(mid, LSIZE - 6);
          ctx.moveTo(6, mid);
          ctx.lineTo(mid - gap, mid);
          ctx.moveTo(mid + gap, mid);
          ctx.lineTo(LSIZE - 6, mid);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(mid, mid, gap, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        // Center the Crosshair Selector Ring directly on (targetX, targetY)
        const left = targetX - LSIZE / 2;
        const top = targetY - LSIZE / 2;
        loupeContainer.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        loupeContainer.style.opacity = "1";
      }
    },
    [hideStudioTouchSight, isComparingOriginal, lineOpacity]
  );

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
    hideStudioTouchSight();
    if (withCooldown) {
      pinchCooldownUntilRef.current = performance.now() + 150;
    }
  }, [hideStudioTouchSight]);

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
      hideStudioTouchSight();
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
        hideStudioTouchSight();
        startPanFrom(t0.clientX, t0.clientY);
        return;
      }

      const { targetX, targetY } = resolveStudioTouchTarget(t0.clientX, t0.clientY);
      const pt = clientToImage(targetX, targetY);
      if (!pt) {
        if (e.cancelable) e.preventDefault();
        hideStudioTouchSight();
        startPanFrom(t0.clientX, t0.clientY);
        return;
      }

      if (e.cancelable) e.preventDefault();
      if (activeTool === "pen" || activeTool === "lineEraser") {
        g.mode = "draw";
        beginStroke(pt);
        updateStudioTouchSight(targetX, targetY, t0.clientX, t0.clientY, pt);
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
      updateStudioTouchSight(targetX, targetY, t0.clientX, t0.clientY, pt);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dimsRef.current.w <= 0) return;

    // 2 Fingers: simultaneous Pinch Zoom + Two-Finger Center Translation (dx, dy)
    if (e.touches.length === 2) {
      if (e.cancelable) e.preventDefault();
      hideStudioTouchSight();
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
        const { targetX, targetY } = resolveStudioTouchTarget(t0.clientX, t0.clientY);
        const pt = clientToImage(targetX, targetY);
        if (!pt) {
          hideStudioTouchSight();
          return;
        }
        const prev = fillStrokeLastImgPtRef.current || pt;
        const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        if (dist >= 2) {
          const steps = Math.max(1, Math.ceil(dist / 5));
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const sx = Math.round(prev.x + (pt.x - prev.x) * t);
            const sy = Math.round(prev.y + (pt.y - prev.y) * t);
            stepFillStrokeAt(sx, sy, false);
          }
          fillStrokeLastImgPtRef.current = pt;
        }
        updateStudioTouchSight(targetX, targetY, t0.clientX, t0.clientY, pt);
        return;
      }
      if (g.mode === "draw") {
        if (e.cancelable) e.preventDefault();
        const { targetX, targetY } = resolveStudioTouchTarget(t0.clientX, t0.clientY);
        const pt = clientToImage(targetX, targetY);
        if (!pt) {
          hideStudioTouchSight();
          return;
        }
        const prev = lastDrawPtRef.current || pt;
        stampSegment(prev.x, prev.y, pt.x, pt.y, activeTool === "pen");
        lastDrawPtRef.current = pt;
        updateStudioTouchSight(targetX, targetY, t0.clientX, t0.clientY, pt);
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

  const findCatalogPaintByCode = useCallback(
    (code?: string): CatalogPaint | null => {
      if (!code || !catalogPaints.length) return null;
      const normCode = code.trim().toUpperCase();
      return catalogPaints.find((p) => p.code.trim().toUpperCase() === normCode) || null;
    },
    [catalogPaints]
  );

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
        isConfirmed: boolean;
        regionCount: number;
        closestPaint: { paint: CatalogPaint; deltaE: number; brandZh: string } | null;
        tintRecipe: BrandTintRecipe | null;
      }
    >();
    for (const reg of regionsRef.current.values()) {
      const key = reg.baseHex.toUpperCase();
      const prev = map.get(key);
      if (prev) {
        prev.regionCount += 1;
        if (!prev.isConfirmed && isConfirmedBrandPaint(reg.paintBrand, reg.paintCode)) {
          prev.brand = reg.paintBrand;
          prev.code = reg.paintCode;
          prev.name = reg.paintName;
          prev.isConfirmed = true;
          const exactPaint = findCatalogPaintByCode(reg.paintCode) || prev.closestPaint?.paint || null;
          prev.tintRecipe = exactPaint ? computeBrandTintRecipe(key, exactPaint, brandLang) : prev.tintRecipe;
        }
      } else {
        const confirmed = isConfirmedBrandPaint(reg.paintBrand, reg.paintCode);
        const closest = findClosestCatalogPaint(key);
        const basePaint = (confirmed ? findCatalogPaintByCode(reg.paintCode) : null) || closest?.paint || null;
        map.set(key, {
          hex: key,
          brand: reg.paintBrand,
          code: reg.paintCode,
          name: reg.paintName,
          isConfirmed: confirmed,
          regionCount: 1,
          closestPaint: closest,
          tintRecipe: basePaint ? computeBrandTintRecipe(key, basePaint, brandLang) : null,
        });
      }
    }
    return Array.from(map.values());
  }, [usedRegionsVersion, findClosestCatalogPaint, findCatalogPaintByCode, brandLang]);

  const usedHexSet = useMemo(
    () => new Set(usedPaintsSummary.map((u) => u.hex.toUpperCase())),
    [usedPaintsSummary]
  );

  const unassignedUsedCount = useMemo(
    () => usedPaintsSummary.filter((u) => !u.isConfirmed).length,
    [usedPaintsSummary]
  );

  const handleClearUnusedStaged = () => {
    const activeUpper = activeHex.toUpperCase();
    const kept = stagedSwatches.filter(
      (s) => usedHexSet.has(s.hex.toUpperCase()) || s.hex.toUpperCase() === activeUpper
    );
    persistStagedSwatches(kept);
    setStatusMessage("已清理缓存托盘中未在画布使用的备选色");
  };

  /** Binds a real commercial brand paint to all canvas regions of `targetHex` (and updates active/staged state) */
  const assignBrandPaintToHexRegions = (
    targetHex: string,
    paint: CatalogPaint,
    brandZh: string,
    syncHexToCatalog = false
  ) => {
    const normTarget = targetHex.toUpperCase();
    const nextHex = syncHexToCatalog ? paint.hex.toUpperCase() : normTarget;
    const triad = deriveImpcatTriad(nextHex);

    let updatedRegions = 0;
    for (const r of regionsRef.current.values()) {
      if (r.baseHex.toUpperCase() === normTarget) {
        updatedRegions++;
      }
    }
    if (updatedRegions > 0) {
      pushUndoSnapshot(`指派品牌漆 ${brandZh} ${paint.code}`);
      for (const [id, r] of regionsRef.current.entries()) {
        if (r.baseHex.toUpperCase() === normTarget) {
          regionsRef.current.set(id, {
            ...r,
            baseHex: triad.baseHex,
            shadeHex: triad.shadeHex,
            highlightHex: triad.highlightHex,
            paintBrand: brandZh,
            paintCode: paint.code,
            paintName: paint.name,
          });
        }
      }
      renderFillFull();
      setUsedRegionsVersion((v) => v + 1);
    }

    if (activeHex.toUpperCase() === normTarget) {
      setActiveHex(triad.baseHex);
      setActivePaintMeta({ brand: brandZh, code: paint.code, name: paint.name });
    }
    pushSwatchToTray(
      {
        hex: triad.baseHex,
        brand: brandZh,
        code: paint.code,
        name: paint.name,
        pinned: true,
      },
      false
    );
    setAssigningTargetHex(null);
    setStatusMessage(
      updatedRegions > 0
        ? `🎯 已将 ${updatedRegions} 处分区指派为品牌油漆：${brandZh} ${paint.code} ${paint.name}`
        : `🎯 已锁定当前品牌油漆：${brandZh} ${paint.code} ${paint.name} (${triad.baseHex})`
    );
  };

  /** One-click batch assigns all unassigned custom regions on the canvas to their closest CIEDE2000 commercial paint */
  const handleBatchAssignAllBrandPaints = () => {
    if (usedPaintsSummary.length === 0) return;
    pushUndoSnapshot("🪄 一键全部指派品牌油漆");
    let assignedColorCount = 0;
    let assignedRegionCount = 0;

    for (const item of usedPaintsSummary) {
      if (item.isConfirmed || !item.closestPaint) continue;
      const { paint, brandZh } = item.closestPaint;
      assignedColorCount++;
      for (const [id, r] of regionsRef.current.entries()) {
        if (r.baseHex.toUpperCase() === item.hex.toUpperCase()) {
          assignedRegionCount++;
          regionsRef.current.set(id, {
            ...r,
            paintBrand: brandZh,
            paintCode: paint.code,
            paintName: paint.name,
          });
        }
      }
      pushSwatchToTray(
        {
          hex: item.hex,
          brand: brandZh,
          code: paint.code,
          name: paint.name,
          pinned: true,
        },
        false
      );
      if (activeHex.toUpperCase() === item.hex.toUpperCase()) {
        setActivePaintMeta({ brand: brandZh, code: paint.code, name: paint.name });
      }
    }

    setUsedRegionsVersion((v) => v + 1);
    setStatusMessage(
      `🪄 已将 ${assignedColorCount} 款自定义色（共 ${assignedRegionCount} 处分区）全部绑定为真实品牌油漆！`
    );
  };

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

  const buildCompositePngDataUrl = (withBrandFooter = false): string | null => {
    const base = baseCanvasRef.current;
    const fill = fillCanvasRef.current;
    const line = lineCanvasRef.current;
    if (!base || !fill || !line || base.width <= 0 || base.height <= 0) return null;

    const w = base.width;
    const h = base.height;
    const items = withBrandFooter ? usedPaintsSummary : [];
    const cols = Math.max(2, Math.min(4, Math.floor(w / 280)));
    const rows = items.length > 0 ? Math.ceil(items.length / cols) : 0;
    const rowH = Math.max(52, Math.round(w * 0.044));
    const headerH = items.length > 0 ? Math.max(34, Math.round(w * 0.028)) : 0;
    const pad = Math.max(16, Math.round(w * 0.018));
    const footerH = items.length > 0 ? headerH + rows * rowH + pad * 2 : 0;

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h + footerH;
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

    if (items.length > 0) {
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, h, w, footerH);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h + 1);
      ctx.lineTo(w, h + 1);
      ctx.stroke();

      const titleFont = Math.max(13, Math.round(w * 0.014));
      ctx.fillStyle = "#94A3B8";
      ctx.font = `900 ${titleFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(
        `GKMIXER COLOR STUDIO · 涂装用漆清单 & 微调指南 (${items.length} 色)`,
        pad,
        h + pad + titleFont * 0.85
      );

      const cellW = (w - pad * 2) / cols;
      const swSize = Math.round(rowH * 0.68);
      items.forEach((it, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const x = pad + c * cellW;
        const y = h + pad + headerH + r * rowH;

        ctx.fillStyle = it.hex;
        ctx.fillRect(x, y, swSize, swSize);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, swSize, swSize);

        // If fine-tuned from a commercial base paint, draw a 14x14px original base paint corner dot in the top-right corner of the swatch
        const tr = it.tintRecipe;
        if (tr && !tr.isDirectSpray) {
          const cornerSize = Math.max(12, Math.min(16, Math.round(swSize * 0.38)));
          const cx = x + swSize - cornerSize - 1;
          const cy = y + 1;
          ctx.fillStyle = tr.basePaint.hex;
          ctx.fillRect(cx, cy, cornerSize, cornerSize);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(cx, cy, cornerSize, cornerSize);
        }

        const brandCode = it.isConfirmed
          ? `${it.brand} ${it.code}`
          : it.closestPaint
          ? `≈ ${it.closestPaint.brandZh} ${it.closestPaint.paint.code}`
          : it.brand || "Custom";
        const paintName = it.isConfirmed
          ? it.name || it.hex
          : it.closestPaint
          ? it.closestPaint.paint.name
          : it.name || it.hex;
        const directSuffix = tr && tr.isDirectSpray ? " (直喷)" : "";

        const mainFont = Math.max(11, Math.round(rowH * 0.27));
        const subFont = Math.max(9, Math.round(rowH * 0.21));
        ctx.fillStyle = "#F8FAFC";
        ctx.font = `800 ${mainFont}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(`${brandCode} · ${paintName}${directSuffix}`, x + swSize + 10, y + swSize * 0.42);

        if (tr && !tr.isDirectSpray) {
          ctx.fillStyle = "#FBBF24";
          ctx.font = `800 ${subFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.fillText(tr.compactBadgeText, x + swSize + 10, y + swSize * 0.88);
        } else {
          ctx.fillStyle = "#94A3B8";
          ctx.font = `700 ${subFont}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.fillText(`${it.hex} · 直喷免调 (${it.regionCount}处分区)`, x + swSize + 10, y + swSize * 0.88);
        }
      });
    }

    return out.toDataURL("image/png");
  };

  const handleExportCompositePng = () => {
    const dataUrl = buildCompositePngDataUrl(true);
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.download = `GKMixer-STUDIO-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    setStatusMessage("已导出带品牌油漆色卡清单的高清 PNG 试色海报");
  };

  const handleConfirmConvertToProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePaintProject) return;
    const compositeUrl = buildCompositePngDataUrl(false);
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
      basePaintHex?: string;
      tintBadgeText?: string;
      recipeSummary?: string;
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

      const confirmed = isConfirmedBrandPaint(primary.paintBrand, primary.paintCode);
      const fallbackClosest = !confirmed ? findClosestCatalogPaint(hexKey) : null;
      const baseCatalogPaint =
        (confirmed ? findCatalogPaintByCode(primary.paintCode) : null) ||
        fallbackClosest?.paint ||
        findClosestCatalogPaint(hexKey)?.paint ||
        null;
      const tintRecipe = baseCatalogPaint
        ? computeBrandTintRecipe(hexKey, baseCatalogPaint, brandLang)
        : null;

      rawNodes.push({
        anchorX,
        anchorY,
        hex: hexKey,
        shadeHex: primary.shadeHex,
        highlightHex: primary.highlightHex,
        brand: confirmed
          ? primary.paintBrand!
          : fallbackClosest?.brandZh || primary.paintBrand || "Custom",
        code: confirmed
          ? primary.paintCode!
          : fallbackClosest?.paint.code || primary.paintCode || "HEX",
        name: confirmed
          ? primary.paintName!
          : fallbackClosest?.paint.name || primary.paintName || hexKey,
        basePaintHex: tintRecipe && !tintRecipe.isDirectSpray ? tintRecipe.basePaint.hex : undefined,
        tintBadgeText: tintRecipe ? tintRecipe.compactBadgeText : undefined,
        recipeSummary: tintRecipe ? tintRecipe.spokenInstruction : undefined,
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
          basePaintHex: item.basePaintHex,
          tintBadgeText: item.tintBadgeText,
          recipeSummary: item.recipeSummary,
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

  // Handle external brand paint assignments coming from Beginner Mode's「选漆与微调」tab
  const lastExternalAssignTokenRef = useRef<number>(0);
  useEffect(() => {
    if (!externalBrandAssignment || externalBrandAssignment.token === lastExternalAssignTokenRef.current) {
      return;
    }
    lastExternalAssignTokenRef.current = externalBrandAssignment.token;
    const { targetHex, paint } = externalBrandAssignment;
    const brandZh = localizedBrand(paint.brand, brandLang);
    assignBrandPaintToHexRegions(targetHex, paint, brandZh, false);
  }, [externalBrandAssignment, brandLang]);

  // Sync live composite image & staged+painted model swatches to App.tsx for Beginner Mode's「选漆与微调」tab
  useEffect(() => {
    if (!onSyncSandboxState) return;
    const delay = isActiveTab ? 180 : 10;
    const timer = window.setTimeout(() => {
      const { w, h } = dimsRef.current;
      const hasLoadedImage = w > 0 && h > 0;
      const compositeDataUrl = hasLoadedImage ? buildCompositePngDataUrl(false) : null;

      // Group painted regions on the model by baseHex
      const groupedByHex = new Map<string, ColoredRegion[]>();
      for (const reg of regionsRef.current.values()) {
        const key = reg.baseHex.toUpperCase();
        const arr = groupedByHex.get(key) || [];
        arr.push(reg);
        groupedByHex.set(key, arr);
      }

      // Filter colors that are BOTH in [STAGING] 备选缓存盘 AND painted on the model (ordered by stagedSwatches)
      const stagedHexOrder = stagedSwatches
        .map((s) => s.hex.toUpperCase())
        .filter((hx) => groupedByHex.has(hx));

      // If any painted region was manually removed from staging tray, only fallback if intersection is empty
      const targetHexList =
        stagedHexOrder.length > 0 ? stagedHexOrder : Array.from(groupedByHex.keys());

      const rawItems: Omit<SandboxSyncedSwatch, "offsetX" | "offsetY">[] = [];
      targetHexList.forEach((hexKey) => {
        const regs = groupedByHex.get(hexKey);
        if (!regs || regs.length === 0) return;

        let primary = regs[0];
        for (const r of regs) {
          if (r.pixels.length > primary.pixels.length) primary = r;
        }
        const px = primary.pixels;
        let sumX = 0;
        let sumY = 0;
        const step = Math.max(1, (px.length / 600) | 0);
        let count = 0;
        for (let i = 0; i < px.length; i += step) {
          const p = px[i];
          const y = (p / Math.max(1, w)) | 0;
          const x = p - y * w;
          sumX += x;
          sumY += y;
          count++;
        }
        const avgX = count > 0 ? sumX / count : w / 2;
        const avgY = count > 0 ? sumY / count : h / 2;

        let bestX = avgX;
        let bestY = avgY;
        let bestDistSq = Infinity;
        for (let i = 0; i < px.length; i += step) {
          const p = px[i];
          const y = (p / Math.max(1, w)) | 0;
          const x = p - y * w;
          const dSq = (x - avgX) * (x - avgX) + (y - avgY) * (y - avgY);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestX = x;
            bestY = y;
          }
        }

        const anchorX = w > 0 ? Math.min(0.94, Math.max(0.06, (bestX + 0.5) / w)) : 0.5;
        const anchorY = h > 0 ? Math.min(0.94, Math.max(0.06, (bestY + 0.5) / h)) : 0.5;

        const stagedMeta = stagedSwatches.find((s) => s.hex.toUpperCase() === hexKey);
        const confirmed =
          isConfirmedBrandPaint(primary.paintBrand, primary.paintCode) ||
          (stagedMeta ? isConfirmedBrandPaint(stagedMeta.brand, stagedMeta.code) : false);
        const rawBrand = isConfirmedBrandPaint(primary.paintBrand, primary.paintCode)
          ? primary.paintBrand!
          : stagedMeta?.brand || primary.paintBrand || "Custom";
        const rawCode = isConfirmedBrandPaint(primary.paintBrand, primary.paintCode)
          ? primary.paintCode!
          : stagedMeta?.code || primary.paintCode || "HEX";
        const rawName = isConfirmedBrandPaint(primary.paintBrand, primary.paintCode)
          ? primary.paintName!
          : stagedMeta?.name || primary.paintName || hexKey;

        const fallbackClosest = !confirmed ? findClosestCatalogPaint(hexKey) : null;
        const exactCatalogPaint = confirmed ? findCatalogPaintByCode(rawCode) : null;
        const baseCatalogPaint = exactCatalogPaint || fallbackClosest?.paint || null;
        const tintRecipe = baseCatalogPaint
          ? computeBrandTintRecipe(hexKey, baseCatalogPaint, brandLang)
          : null;

        const effectiveBrand = confirmed
          ? rawBrand
          : fallbackClosest
          ? `≈ ${fallbackClosest.brandZh}`
          : rawBrand;
        const effectiveCode = confirmed
          ? rawCode
          : fallbackClosest?.paint.code || rawCode;
        const effectiveName = confirmed
          ? rawName
          : fallbackClosest?.paint.name || rawName;

        const resolvedAssignedPaint: CatalogPaint = exactCatalogPaint
          ? { ...exactCatalogPaint, brand: rawBrand }
          : confirmed
          ? {
              id: `sandbox-confirmed-${hexKey}`,
              brand: rawBrand,
              code: rawCode,
              name: rawName,
              hex: hexKey,
              finish: "gloss",
            }
          : fallbackClosest?.paint
          ? {
              ...fallbackClosest.paint,
              brand: `≈ ${fallbackClosest.brandZh}`,
            }
          : {
              id: `sandbox-custom-${hexKey}`,
              brand: "试色自定义",
              code: hexKey,
              name: rawName,
              hex: hexKey,
              finish: "gloss",
            };

        rawItems.push({
          id: `sandbox-swatch-${hexKey}`,
          hex: hexKey,
          shadeHex: primary.shadeHex,
          highlightHex: primary.highlightHex,
          brand: effectiveBrand,
          code: effectiveCode,
          name: effectiveName,
          isConfirmed: confirmed,
          regionCount: regs.length,
          anchorX,
          anchorY,
          assignedPaint: resolvedAssignedPaint,
          basePaintHex: tintRecipe && !tintRecipe.isDirectSpray ? tintRecipe.basePaint.hex : undefined,
          tintBadgeText: tintRecipe ? tintRecipe.compactBadgeText : undefined,
          recipeSummary: tintRecipe ? tintRecipe.spokenInstruction : undefined,
        });
      });

      const leftSide = rawItems.filter((n) => n.anchorX < 0.5).sort((a, b) => a.anchorY - b.anchorY);
      const rightSide = rawItems.filter((n) => n.anchorX >= 0.5).sort((a, b) => a.anchorY - b.anchorY);

      const assignSideCoords = (
        items: typeof rawItems,
        offsetX: number
      ): SandboxSyncedSwatch[] =>
        items.map((item, idx) => {
          const count = items.length;
          const offsetY =
            count === 1
              ? Math.min(0.84, Math.max(0.14, item.anchorY))
              : 0.12 + (idx / Math.max(1, count - 1)) * 0.72;
          return {
            ...item,
            offsetX,
            offsetY,
          };
        });

      const positionedMap = new Map<string, SandboxSyncedSwatch>();
      for (const s of [...assignSideCoords(leftSide, 0.04), ...assignSideCoords(rightSide, 0.72)]) {
        positionedMap.set(s.hex, s);
      }
      // Preserve staging tray order for the vertical list
      const syncedSwatches = rawItems
        .map((r) => positionedMap.get(r.hex))
        .filter(Boolean) as SandboxSyncedSwatch[];

      onSyncSandboxState({
        compositeDataUrl,
        syncedSwatches,
        stagedSwatches,
        activeHex: activeHex.toUpperCase(),
        hasLoadedImage,
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    usedRegionsVersion,
    stagedSwatches,
    imageToken,
    lineOpacity,
    renderMode,
    activeHex,
    isActiveTab,
    catalogPaints,
    brandLang,
    findClosestCatalogPaint,
    findCatalogPaintByCode,
    onSyncSandboxState,
  ]);

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

  // Reusable Palette Section (Dual Coloring Modes + Active Staging Tray + 4D Color Engine)
  const isCurrentBrandConfirmed = isConfirmedBrandPaint(activePaintMeta.brand, activePaintMeta.code);

  const renderPaletteSection = () => (
    <div className="space-y-2.5 shrink-0" translate="no">
      {/* 1. TOP DUAL COLORING MODE SWITCHER (品牌油漆直涂 vs 明度色板调色) */}
      <div
        className={`grid grid-cols-2 gap-1 p-1 shrink-0 ${
          isBlueprint
            ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/90 shadow-[2px_2px_0px_#0F172A]"
            : "rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-100/90 dark:bg-slate-800/80"
        }`}
      >
        <button
          type="button"
          onClick={() => setColoringMode("brand")}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-black transition cursor-pointer ${
            coloringMode === "brand"
              ? isBlueprint
                ? "rounded-[4px] border-[1.5px] border-slate-900 bg-[var(--accent-color)] text-white shadow-[1.5px_1.5px_0px_#0F172A] font-mono"
                : "rounded-lg bg-[var(--accent-color)] text-white shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span>🏷️ 品牌油漆直涂</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setColoringMode("custom");
            setAssigningTargetHex(null);
          }}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-black transition cursor-pointer ${
            coloringMode === "custom"
              ? isBlueprint
                ? "rounded-[4px] border-[1.5px] border-slate-900 bg-[var(--accent-color)] text-white shadow-[1.5px_1.5px_0px_#0F172A] font-mono"
                : "rounded-lg bg-[var(--accent-color)] text-white shadow-xs"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <span>🎛️ 明度色板调色</span>
        </button>
      </div>

      {/* 2. COMPACT CURRENT ACTIVE PAINT BAR (Fixed 48x48 Square Swatch + Micro 3-Tone Strip + Stage Button + Top 3 Brand Assignment) */}
      <div
        className={`p-2 space-y-1.5 shrink-0 ${
          isBlueprint
            ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-900 shadow-[2px_2px_0px_#0F172A]"
            : "rounded-xl border border-slate-200/85 dark:border-slate-700/85 bg-slate-50/80 dark:bg-slate-800/50"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Strictly Fixed 48x48px Square Swatch with Embedded 6px 3-Tone Micro Strip (暗部 | 主色 | 高光) */}
          <div
            style={{ width: 48, height: 48, minWidth: 48, minHeight: 48 }}
            className={`relative w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 ${
              isBlueprint
                ? "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-400 shadow-[2px_2px_0px_#0F172A]"
                : "rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs"
            }`}
          >
            <label
              title="点击主色块打开系统取色器"
              className="flex-1 w-full cursor-pointer relative block"
              style={{ backgroundColor: activeHex }}
            >
              <input
                type="color"
                value={/^#[0-9A-F]{6}$/i.test(activeHex) ? activeHex : "#808080"}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  const hsl = hexToHsl(v);
                  if (hsl.s >= 4) setSelectedHue(hsl.h);
                  setSelectedMatrixCell(findNearestMatrixCell(hsl.l, hsl.s));
                  setStagingAnchor({
                    hex: v,
                    brand: "Custom",
                    code: "HEX",
                    name: `自定义 ${v}`,
                  });
                  applyPaintToSelectedRegions(v, { brand: "Custom", code: "HEX", name: "自定义调色" });
                }}
                className="sr-only"
              />
            </label>
            {/* Micro 3-step triad strip (Shade | Base | Highlight, 6px height) — click to sample */}
            <div className="grid grid-cols-3 h-1.5 min-h-[6px] w-full shrink-0 border-t border-black/25 dark:border-white/15">
              <button
                type="button"
                onClick={() =>
                  applyPaintToSelectedRegions(activeTriad.shadeHex, {
                    brand: activePaintMeta.brand || "Custom",
                    code: activePaintMeta.code ? `${activePaintMeta.code}-暗` : "SHADE",
                    name: `${activePaintMeta.name || "当前色"}·暗部`,
                  })
                }
                title={`点击取用推导暗部色 (${activeTriad.shadeHex})`}
                className="h-full w-full cursor-pointer"
                style={{ backgroundColor: activeTriad.shadeHex }}
              />
              <span
                title={`标准主色 (${activeTriad.baseHex})`}
                className="h-full w-full border-x border-black/20"
                style={{ backgroundColor: activeTriad.baseHex }}
              />
              <button
                type="button"
                onClick={() =>
                  applyPaintToSelectedRegions(activeTriad.highlightHex, {
                    brand: activePaintMeta.brand || "Custom",
                    code: activePaintMeta.code ? `${activePaintMeta.code}-亮` : "HIGH",
                    name: `${activePaintMeta.name || "当前色"}·高光`,
                  })
                }
                title={`点击取用推导高光色 (${activeTriad.highlightHex})`}
                className="h-full w-full cursor-pointer"
                style={{ backgroundColor: activeTriad.highlightHex }}
              />
            </div>
          </div>

          {/* Optional Mini Bottle Thumbnail when a Confirmed Brand Paint is Active */}
          {isCurrentBrandConfirmed && activePaintMeta.brand && activePaintMeta.code && (
            <MiniBottlePreviewBadge
              brand={activePaintMeta.brand}
              code={activePaintMeta.code}
              name={activePaintMeta.name}
              hex={activeHex}
              isBlueprint={isBlueprint}
            />
          )}

          {/* Center: Current Paint Brand/Code/Name Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`shrink-0 px-1.5 py-0.5 text-[9px] font-black truncate max-w-[145px] ${
                  isBlueprint
                    ? `rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-400 font-mono shadow-[1.5px_1.5px_0px_#0F172A] ${
                        isCurrentBrandConfirmed
                          ? "bg-emerald-100 dark:bg-emerald-950/90 text-slate-900 dark:text-emerald-200"
                          : "bg-amber-100 dark:bg-amber-950/90 text-slate-900 dark:text-amber-200"
                      }`
                    : `rounded ${
                        isCurrentBrandConfirmed
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      }`
                }`}
              >
                {isCurrentBrandConfirmed
                  ? `🏷️ ${activePaintMeta.brand} ${activePaintMeta.code}`
                  : "🎛️ 自由调色"}
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                {activeHex}
              </span>
            </div>
            <div className="mt-1 text-xs font-black text-slate-900 dark:text-white truncate">
              {activePaintMeta.name || activeHex}
            </div>
          </div>

          {/* Right: [📌 暂存备选] & Copy */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                const item: StagedSwatchItem = {
                  hex: activeHex.toUpperCase(),
                  brand: activePaintMeta.brand || "Custom",
                  code: activePaintMeta.code || "HEX",
                  name: activePaintMeta.name || activeHex.toUpperCase(),
                  pinned: true,
                };
                setStagingAnchor(item);
                pushSwatchToTray(item, true);
              }}
              title="将当前颜色加入下方「备选与最近用色缓存栏」，方便随时秒切喷涂"
              className={`px-2 py-1 text-[10px] font-black cursor-pointer transition whitespace-nowrap ${primaryActionBtnClass}`}
            >
              📌 暂存备选
            </button>
            <button
              type="button"
              onClick={handleCopyHex}
              title="复制当前色值"
              className={`px-1.5 py-1 text-[10px] font-extrabold cursor-pointer transition whitespace-nowrap ${secondaryActionBtnClass}`}
            >
              {copiedHex ? "✓" : "复制"}
            </button>
          </div>
        </div>

        {/* Real-Time Top 3 Closest Commercial Paint Assignment Strip */}
        {activeTopMatches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
            {activeTopMatches.map((m, idx) => {
              const isAlreadyBound =
                isCurrentBrandConfirmed &&
                activePaintMeta.brand === m.brandZh &&
                activePaintMeta.code === m.paint.code;
              return (
                <button
                  key={m.paint.id}
                  type="button"
                  onClick={() => {
                    assignBrandPaintToHexRegions(activeHex, m.paint, m.brandZh, false);
                    setStagingAnchor({
                      hex: activeHex.toUpperCase(),
                      brand: m.brandZh,
                      code: m.paint.code,
                      name: m.paint.name,
                      pinned: true,
                    });
                  }}
                  title={`点击将当前色直接指派并绑定为实体模型漆：${m.brandZh} ${m.paint.code} ${m.paint.name} (${m.paint.hex} · ΔE ${m.deltaE.toFixed(1)})`}
                  className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                    isBlueprint
                      ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 font-mono shadow-[1.5px_1.5px_0px_#0F172A] ${
                          isAlreadyBound
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-slate-900 dark:text-emerald-200"
                            : idx === 0
                            ? "bg-[var(--accent-soft)] text-slate-900 dark:text-white hover:bg-[var(--accent-color)] hover:text-white"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-[var(--accent-soft)]"
                        }`
                      : `rounded-md border ${
                          isAlreadyBound
                            ? "border-emerald-600 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                            : idx === 0
                            ? "border-[var(--accent-color)]/60 bg-[var(--accent-soft)] text-slate-900 dark:text-white hover:border-[var(--accent-color)]"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)]"
                        }`
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 ${
                      isBlueprint ? "rounded-[2px] border border-slate-900" : "rounded-xs border border-black/20"
                    }`}
                    style={{ backgroundColor: m.paint.hex }}
                  />
                  <span className="truncate max-w-[140px]">
                    {idx === 0 ? `🎯 指派: ${m.brandZh} ${m.paint.code} ${m.paint.name}` : `${m.brandZh} ${m.paint.code}`}
                  </span>
                  <span className="font-mono text-[9px] opacity-80">ΔE{m.deltaE.toFixed(1)}</span>
                </button>
              );
            })}
            {coloringMode === "custom" && (
              <button
                type="button"
                onClick={() => {
                  setAssigningTargetHex(activeHex.toUpperCase());
                  setColoringMode("brand");
                }}
                title="从 10999+ 款油漆库中手动搜索并指派其他品牌油漆"
                className={`shrink-0 px-1.5 py-0.5 text-[10px] font-extrabold cursor-pointer ${secondaryActionBtnClass}`}
              >
                🔍 换漆
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. PERSISTENT ACTIVE PALETTE TRAY (📌 备选与最近用色缓存栏，容量扩充至 30+ 槽位，已上色槽位自动保护不淘汰) */}
      <div className={`space-y-1.5 pt-2 shrink-0 ${dividerTopClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
            <span className="tech-prefix">[STAGING]</span>
            📌 备选与最近用色缓存盘 ({stagedSwatches.length}/{Math.max(MAX_STAGED_SWATCHES, stagedSwatches.length)})
          </span>
          <div className="flex items-center gap-2">
            {stagedSwatches.length > 1 && (
              <button
                type="button"
                onClick={handleClearUnusedStaged}
                className="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline cursor-pointer"
                title="清理缓存托盘中尚未涂在画布上的颜色"
              >
                清空未用
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 shrink-0 max-h-[176px] overflow-y-auto p-0.5 pr-1.5 pb-1.5">
          {stagedSwatches.map((sw) => {
            const isSelected = activeHex.toUpperCase() === sw.hex.toUpperCase();
            const isHarmonyBase = stagingAnchor.hex.toUpperCase() === sw.hex.toUpperCase();
            const isUsedOnCanvas = usedHexSet.has(sw.hex.toUpperCase());
            const confirmed = isConfirmedBrandPaint(sw.brand, sw.code);
            const badgeText = confirmed
              ? `${sw.brand} ${sw.code}`
              : sw.code && sw.code !== "HEX"
              ? sw.code
              : sw.hex;
            return (
              <div
                key={sw.hex}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const hsl = hexToHsl(sw.hex);
                  if (hsl.s >= 4) {
                    setSelectedHue(hsl.h);
                  }
                  setSelectedMatrixCell(findNearestMatrixCell(hsl.l, hsl.s));
                  setStagingAnchor(sw);
                  applyPaintToSelectedRegions(sw.hex, {
                    brand: sw.brand,
                    code: sw.code,
                    name: sw.name,
                  });
                  setStatusMessage(
                    `📌 已选备选色「${sw.brand} ${sw.code} ${sw.name}」· 色相环已同步至 H=${hsl.h}° 供衍生明暗，和谐推荐已更新`
                  );
                }}
                title={`${sw.brand} ${sw.code} · ${sw.name} (${sw.hex}) — 点击自动同步 360° 色相环与和谐分色推荐`}
                className={`bp-subcard bp-subcard-interactive group relative flex flex-col items-center p-1 transition cursor-pointer ${
                  isBlueprint
                    ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 ${
                        isSelected
                          ? "bp-subcard-active bg-[var(--accent-soft)] ring-1 ring-[var(--accent-color)] shadow-[2px_2px_0px_#0F172A]"
                          : "bg-white dark:bg-slate-800/90 hover:bg-[var(--accent-soft)] shadow-[2px_2px_0px_#0F172A]"
                      }`
                    : `rounded-lg border ${
                        isSelected
                          ? "border-[var(--accent-color)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent-color)]"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-[var(--accent-color)]"
                      }`
                }`}
              >
                <span
                  className={`relative h-5 min-h-[20px] w-full shrink-0 ${
                    isBlueprint
                      ? "rounded-[2px] border-[1.5px] border-slate-900 dark:border-slate-400"
                      : "rounded-xs border border-black/15 dark:border-white/15"
                  }`}
                  style={{ backgroundColor: sw.hex }}
                >
                  {isUsedOnCanvas && (
                    <span
                      title="已涂在模型画布上"
                      className="absolute bottom-0.5 left-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-black/40"
                    />
                  )}
                  {isHarmonyBase && (
                    <span
                      title="当前色相环与和谐推荐基准锚点"
                      className="absolute top-0.5 right-0.5 px-0.5 rounded-[2px] bg-black/55 text-[7px] font-mono font-black text-white leading-none"
                    >
                      ★
                    </span>
                  )}
                </span>
                <span className="mt-0.5 text-[8px] font-mono font-extrabold text-slate-800 dark:text-slate-100 truncate w-full text-center leading-tight">
                  {badgeText}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStagedSwatch(sw.hex);
                  }}
                  title="从备选缓存栏移除"
                  className={`opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 h-3.5 w-3.5 bg-slate-900 text-white text-[8px] font-black flex items-center justify-center hover:bg-rose-600 cursor-pointer transition-opacity ${
                    isBlueprint ? "rounded-[3px] border border-white" : "rounded-full"
                  }`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MODE-SPECIFIC MAIN WORKSPACE */}
      {coloringMode === "brand" ? (
        /* ====================================================================
         * MODE A: 🏷️ 品牌油漆直涂 (Embedded Commercial Paint Selector)
         * ==================================================================== */
        <div className={`space-y-2 pt-2 shrink-0 ${dividerTopClass}`}>
          {assigningTargetHex && (
            <div
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-900 dark:text-amber-200 ${
                isBlueprint
                  ? "rounded-[4px] border-[1.5px] border-slate-900 bg-amber-100 dark:bg-amber-950/70 shadow-[2px_2px_0px_#0F172A]"
                  : "rounded-lg border border-amber-500/50 bg-amber-500/10"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="h-3.5 w-3.5 rounded-xs border border-black/30 shrink-0"
                  style={{ backgroundColor: assigningTargetHex }}
                />
                <span className="truncate">🎯 点击下方任意油漆即可绑定至色块 {assigningTargetHex}</span>
              </span>
              <button
                type="button"
                onClick={() => setAssigningTargetHex(null)}
                className="shrink-0 underline text-[10px] cursor-pointer"
              >
                取消
              </button>
            </div>
          )}

          {/* Compact Search Input */}
          <div className="relative shrink-0">
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="🔍 搜色号/名称/品牌 (如 003 / 万蓝 / 盖亚 / NDL)..."
              className={`w-full px-2.5 py-1.5 pr-7 text-xs font-bold outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                isBlueprint
                  ? "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 shadow-[2px_2px_0px_#0F172A] font-mono"
                  : "rounded-lg border border-slate-300 dark:border-slate-700 focus:border-[var(--accent-color)]"
              }`}
            />
            {catalogSearch && (
              <button
                type="button"
                onClick={() => setCatalogSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Horizontal Brand Filter Capsules (Blueprint: hard-bordered square pills; Glass: rounded-full) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0">
            <button
              type="button"
              onClick={() => setCatalogBrandFilter("ALL")}
              className={`px-2 py-0.5 text-[10px] font-extrabold shrink-0 cursor-pointer transition ${
                catalogBrandFilter === "ALL" ? "bp-pill-active" : "bp-pill"
              } ${
                isBlueprint
                  ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 font-mono ${
                      catalogBrandFilter === "ALL"
                        ? "bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[2px_2px_0px_#0F172A] hover:bg-[var(--accent-soft)]"
                    }`
                  : `rounded-full ${
                      catalogBrandFilter === "ALL"
                        ? "bg-[var(--accent-color)] text-white"
                        : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                    }`
              }`}
            >
              全部品牌
            </button>
            {FEATURED_BRANDS.map((b) => {
              const active = catalogBrandFilter === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setCatalogBrandFilter(b)}
                  className={`px-2 py-0.5 text-[10px] font-extrabold shrink-0 cursor-pointer transition ${
                    active ? "bp-pill-active" : "bp-pill"
                  } ${
                    isBlueprint
                      ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 font-mono ${
                          active
                            ? "bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[2px_2px_0px_#0F172A] hover:bg-[var(--accent-soft)]"
                        }`
                      : `rounded-full ${
                          active
                            ? "bg-[var(--accent-color)] text-white"
                            : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        }`
                  }`}
                >
                  {localizedBrand(b, brandLang)}
                </button>
              );
            })}
          </div>

          {/* Color Family Filter Dots (红/橙/黄/绿/青/蓝/紫/黑白灰/金银) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 shrink-0">
            {COLOR_FAMILY_FILTERS.map((cf) => {
              const active = catalogColorFamily === cf.id;
              return (
                <button
                  key={cf.id}
                  type="button"
                  onClick={() => setCatalogColorFamily(cf.id)}
                  className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                    active ? "bp-pill-active" : "bp-pill"
                  } ${
                    isBlueprint
                      ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 font-mono ${
                          active
                            ? "bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[2px_2px_0px_#0F172A] hover:bg-[var(--accent-soft)]"
                        }`
                      : `rounded-md border ${
                          active
                            ? "border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 dark:text-white"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
                        }`
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 ${
                      isBlueprint
                        ? "rounded-[2px] border-[1.5px] border-slate-900"
                        : "rounded-full border border-black/20"
                    }`}
                    style={{ background: cf.dotStyle }}
                  />
                  <span>{cf.label}</span>
                </button>
              );
            })}
          </div>

          {/* High-Density 3-Column Brand Paint Swatch Grid */}
          <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-0.5 pb-1 shrink-0">
            {filteredCatalogPaints.map((p) => {
              const brandZh = localizedBrand(p.brand, brandLang);
              const isSelected =
                activeHex.toUpperCase() === p.hex.toUpperCase() && activePaintMeta.code === p.code;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (assigningTargetHex) {
                      assignBrandPaintToHexRegions(assigningTargetHex, p, brandZh, true);
                      return;
                    }
                    const hsl = hexToHsl(p.hex);
                    if (hsl.s >= 4) setSelectedHue(hsl.h);
                    setSelectedMatrixCell(findNearestMatrixCell(hsl.l, hsl.s));
                    setStagingAnchor({
                      hex: p.hex.toUpperCase(),
                      brand: brandZh,
                      code: p.code,
                      name: p.name,
                    });
                    applyPaintToSelectedRegions(p.hex, {
                      brand: brandZh,
                      code: p.code,
                      name: p.name,
                    });
                    setStatusMessage(`🏷️ 已选品牌油漆：${brandZh} ${p.code} ${p.name} (${p.hex})`);
                  }}
                  title={`${brandZh} ${p.code} · ${p.name} (${p.hex}) — 点击直接上色`}
                  className={`bp-subcard bp-subcard-interactive group relative flex flex-col p-1.5 text-left transition cursor-pointer ${
                    isBlueprint
                      ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 shadow-[2px_2px_0px_#0F172A] ${
                          isSelected
                            ? "bp-subcard-active bg-[var(--accent-soft)] ring-1 ring-[var(--accent-color)]"
                            : "bg-white dark:bg-slate-800/95 hover:bg-[var(--accent-soft)]"
                        }`
                      : `rounded-lg border ${
                          isSelected
                            ? "border-[var(--accent-color)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent-color)]"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-[var(--accent-color)]"
                        }`
                  }`}
                >
                  <BrandPaintCardHeader
                    paint={p}
                    brandZh={brandZh}
                    isBlueprint={isBlueprint}
                    onStageClick={(e) => {
                      e.stopPropagation();
                      const item: StagedSwatchItem = {
                        hex: p.hex.toUpperCase(),
                        brand: brandZh,
                        code: p.code,
                        name: p.name,
                        pinned: true,
                      };
                      setStagingAnchor(item);
                      pushSwatchToTray(item, true);
                    }}
                  />
                  <div className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 truncate leading-tight">
                    {brandZh} {p.code}
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate leading-tight mt-0.5">
                    {p.name}
                  </div>
                </div>
              );
            })}
            {filteredCatalogPaints.length === 0 && (
              <div className="col-span-3 py-6 text-center text-[11px] font-bold text-slate-400">
                未找到匹配的模型漆，请尝试切换品牌或色系过滤条件
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ====================================================================
         * MODE B: 🎛️ 明度色板调色 (10-Step Grayscale + 360° Hue & 5×5 Matrix + Harmony)
         * ==================================================================== */
        <>
          {/* MODULE 2A: 10-Step Neutral Grayscale Bar (10 阶素组与机械骨架标准灰阶) */}
          <div className={`space-y-1.5 pt-2 shrink-0 ${dividerTopClass}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">
                <span className="tech-prefix">[GRAY_10]</span>
                10 阶素组与机械骨架标准灰阶
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-400">L10% ➔ L98%</span>
            </div>
            <div className="grid grid-cols-10 gap-1 shrink-0">
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
                    className={`bp-gray-step-btn group flex flex-col items-center cursor-pointer transition shrink-0 ${
                      !isBlueprint && (isSelected ? "scale-105" : "hover:scale-105")
                    }`}
                  >
                    <span
                      className={`bp-gray-step-swatch h-6 min-h-[24px] w-full shrink-0 transition ${
                        isBlueprint
                          ? `rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-400 ${
                              isSelected
                                ? "ring-2 ring-[var(--accent-color)] shadow-[2px_2px_0px_#0F172A]"
                                : "shadow-[2px_2px_0px_#0F172A]"
                            }`
                          : `rounded-md border ${
                              isSelected
                                ? "ring-2 ring-[var(--accent-color)] border-white dark:border-slate-900 shadow-sm"
                                : "border-black/20 dark:border-white/15"
                            }`
                      }`}
                      style={{ backgroundColor: g.hex }}
                    />
                    <span className="mt-1 text-[8px] font-mono font-bold text-slate-600 dark:text-slate-400 leading-none">
                      {g.lLabel.replace("%", "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODULE 2B: 360° Hue Spectrum Slider (Real-Time Hue-Synced Thumb) + 5×5 Value × Chroma Matrix */}
          <div className={`space-y-2 pt-2 shrink-0 ${dividerTopClass}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                <span className="tech-prefix">[HVC_5x5]</span>
                360° 色相环 + 明度×纯度 5×5 阶梯矩阵
              </span>
              <span
                className={`shrink-0 px-1.5 py-0.5 font-mono text-[10px] font-black flex items-center gap-1 ${
                  isBlueprint
                    ? "rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[1.5px_1.5px_0px_#0F172A]"
                    : "rounded bg-[var(--accent-soft)] text-[var(--accent-color)]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-[2px] border border-black/30 shrink-0"
                  style={{ backgroundColor: `hsl(${selectedHue}, 95%, 52%)` }}
                />
                <span>H {selectedHue}°</span>
              </span>
            </div>

            {/* Custom 0°~360° Full Spectrum Hue Slider with Hue-Synchronized Thumb */}
            <div className="relative flex items-center h-6 w-full shrink-0 select-none">
              <div
                className={`w-full h-3.5 ${
                  isBlueprint
                    ? "rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 shadow-[1.5px_1.5px_0px_#0F172A]"
                    : "rounded-full border border-black/20 dark:border-white/20 shadow-inner"
                }`}
                style={{
                  background:
                    "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                }}
              />
              {/* Custom Hue-Colored Thumb (never hardcoded purple!) */}
              <div
                className={`pointer-events-none absolute top-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 transition-transform ${
                  isBlueprint
                    ? "rounded-[4px] border-2 border-[#0F172A] ring-2 ring-inset ring-white shadow-[1.5px_1.5px_0px_#0F172A]"
                    : "rounded-full border-2 border-white ring-1 ring-black/35 shadow-md"
                }`}
                style={{
                  left: `${(selectedHue / 360) * 100}%`,
                  backgroundColor: `hsl(${selectedHue}, 95%, 52%)`,
                }}
              />
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
                  setStagingAnchor({
                    hex: nextHex.toUpperCase(),
                    brand: "GK矩阵",
                    code: `H${nextH}°`,
                    name: `色相 ${nextH}° · L${selectedMatrixCell.l} S${selectedMatrixCell.s}`,
                  });
                  applyPaintToSelectedRegions(nextHex, {
                    brand: "GK矩阵",
                    code: `H${nextH}°`,
                    name: `色相 ${nextH}° · L${selectedMatrixCell.l} S${selectedMatrixCell.s}`,
                  });
                }}
                aria-label="360度色相滑轨"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
              />
            </div>

            {/* 5×5 Value (Lightness) × Chroma (Saturation) Stepped Matrix (Explicit h-8 min-h-[32px] per cell!) */}
            <div
              className={`p-2 space-y-1.5 shrink-0 ${
                isBlueprint
                  ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-900 shadow-[2px_2px_0px_#0F172A]"
                  : "rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50"
              }`}
            >
              <div className="grid grid-cols-[44px_1fr] gap-1.5 items-center text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400">
                <span className="text-left pl-0.5 truncate">明度\纯度</span>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {MATRIX_SATURATION_COLS.map((col) => (
                    <span key={col.s} title={col.label} className="truncate">
                      {col.shortLabel.split(" ")[0]}
                    </span>
                  ))}
                </div>
              </div>

              {matrixGridSwatches.map((row) => (
                <div key={row.l} className="grid grid-cols-[44px_1fr] gap-1.5 items-center shrink-0">
                  <span
                    title={row.label}
                    className="text-[9px] font-mono font-extrabold text-slate-600 dark:text-slate-300 truncate pr-0.5"
                  >
                    {row.shortLabel}
                  </span>
                  <div className="grid grid-cols-5 gap-1.5 shrink-0">
                    {row.cells.map((cell) => {
                      const isCurrent = activeHex.toUpperCase() === cell.hex.toUpperCase();
                      const isAnchorCell =
                        anchorMatrixCell.l === cell.l && anchorMatrixCell.s === cell.s;
                      return (
                        <button
                          key={`${cell.l}-${cell.s}`}
                          type="button"
                          onClick={() => {
                            setSelectedMatrixCell({ l: cell.l, s: cell.s });
                            const isAnchorConfirmed = isConfirmedBrandPaint(stagingAnchor.brand, stagingAnchor.code);
                            const anchorPrefix = isAnchorConfirmed
                              ? `${stagingAnchor.brand}${stagingAnchor.code}衍生`
                              : `H${selectedHue}°`;
                            applyPaintToSelectedRegions(cell.hex, {
                              brand: isAnchorConfirmed ? stagingAnchor.brand : "GK矩阵",
                              code: isAnchorConfirmed ? stagingAnchor.code : `H${selectedHue}°`,
                              name: isAnchorConfirmed
                                ? `${stagingAnchor.name} · ${row.label.split(" ")[1]}`
                                : `${anchorPrefix} · ${row.label.split(" ")[1]} · ${cell.colLabel.split(" ")[1]}`,
                            });
                          }}
                          title={`H${selectedHue}° · 明度 L${cell.l}% · 纯度 S${cell.s}% (${cell.hex})${
                            isAnchorCell ? ` [★ 当前备选色 ${harmonyAnchorLabel} 近似格]` : ""
                          }`}
                          style={{ backgroundColor: cell.hex, minHeight: 32 }}
                          className={`bp-matrix-cell ${
                            isCurrent ? "bp-matrix-cell-active" : ""
                          } relative h-8 min-h-[32px] w-full shrink-0 transition cursor-pointer flex items-center justify-center ${
                            isBlueprint
                              ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-400 ${
                                  isCurrent
                                    ? "ring-2 ring-[var(--accent-color)] shadow-[2.5px_2.5px_0px_#0F172A] z-10"
                                    : "shadow-[2px_2px_0px_#0F172A]"
                                }`
                              : `rounded-md border ${
                                  isCurrent
                                    ? "ring-2 ring-[var(--accent-color)] border-white dark:border-slate-900 scale-[1.04] z-10 shadow-sm"
                                    : "border-black/20 dark:border-white/15 hover:scale-[1.03]"
                                }`
                          }`}
                        >
                          {isAnchorCell && (
                            <span
                              title={`备选基准色 (${harmonyAnchorLabel}) 所在近似明度/纯度位置`}
                              className="pointer-events-none px-1 py-0.2 rounded-[2px] bg-black/55 border border-dashed border-white/85 text-[8px] font-mono font-black text-white leading-none"
                            >
                              ★基准
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MODULE 2C: Smart Color Harmony Generator (色相环和谐分色推荐栏 · 深度绑定选中备选色) */}
          <div className={`space-y-1.5 pt-2 shrink-0 ${dividerTopClass}`}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                <span className="tech-prefix">[HARMONY]</span>
                色相环和谐分色推荐
              </span>
              <span
                title={`当前和谐分色推荐以「${harmonyAnchorLabel} (${stagingAnchor.hex})」的色相/明度/纯度为基准实时推导`}
                className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-black truncate max-w-[165px] ${
                  isBlueprint
                    ? "rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-[1.5px_1.5px_0px_#0F172A]"
                    : "rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-[2px] border border-black/30 shrink-0"
                  style={{ backgroundColor: stagingAnchor.hex }}
                />
                <span className="truncate">基准: {harmonyAnchorLabel}</span>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 shrink-0">
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
                      active ? "bp-pill-active" : "bp-pill"
                    } ${
                      isBlueprint
                        ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 font-mono ${
                            active
                              ? "bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[2px_2px_0px_#0F172A] hover:bg-[var(--accent-soft)]"
                          }`
                        : `rounded-lg border ${
                            active
                              ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-2xs"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300"
                          }`
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-5 gap-1.5 shrink-0">
              {harmonySwatches.map((sw, idx) => {
                const isCurrent = activeHex.toUpperCase() === sw.hex.toUpperCase();
                return (
                  <div
                    key={`${sw.role}-${idx}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      applyPaintToSelectedRegions(sw.hex, {
                        brand: "和谐推荐",
                        code: sw.tag,
                        name: `${harmonyAnchorLabel}·${sw.role}`,
                      })
                    }
                    title={`${sw.role} (${sw.tag}) · ${sw.hex} — 点击直接上色，右上角「+」可存入备选栏`}
                    className={`bp-subcard bp-subcard-interactive group relative flex flex-col items-center p-1 transition cursor-pointer shrink-0 ${
                      isBlueprint
                        ? `rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 shadow-[2px_2px_0px_#0F172A] ${
                            isCurrent
                              ? "bp-subcard-active bg-[var(--accent-soft)] ring-1 ring-[var(--accent-color)]"
                              : "bg-white dark:bg-slate-800/90 hover:bg-[var(--accent-soft)]"
                          }`
                        : `rounded-lg border ${
                            isCurrent
                              ? "border-[var(--accent-color)] bg-[var(--accent-soft)]"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-[var(--accent-color)]"
                          }`
                    }`}
                  >
                    <span
                      className={`h-6 min-h-[24px] w-full shrink-0 transition ${
                        isBlueprint
                          ? "rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-400"
                          : "rounded border border-black/15 dark:border-white/15 group-hover:scale-105"
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                    <span className="mt-1 text-[9px] font-extrabold text-slate-800 dark:text-slate-200 truncate w-full text-center">
                      {sw.role}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        pushSwatchToTray(
                          {
                            hex: sw.hex.toUpperCase(),
                            brand: "和谐推荐",
                            code: sw.tag,
                            name: `${harmonyAnchorLabel}·${sw.role}`,
                            pinned: true,
                          },
                          true
                        );
                      }}
                      title="📌 将此推荐和谐色存入上方备选缓存盘"
                      className={`opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 px-1 py-0.2 bg-slate-900 text-white text-[7px] font-mono font-black hover:bg-[var(--accent-color)] cursor-pointer transition-opacity ${
                        isBlueprint ? "rounded-[2px] border border-white" : "rounded"
                      }`}
                    >
                      +备
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Reusable Algorithm Controls Section (⚙️ 高级设置: Beginner-friendly 3-Step Layout + Prominent Checkable Switches)
  const renderAlgorithmSection = (alwaysOpen = false) => {
    const colorBarrierEnabled = fillTolerance > 0;
    const stepBarrierEnabled = localStepThreshold > 0;

    return (
      <div className="space-y-2 shrink-0" translate="no">
        {!alwaysOpen && (
          <div
            className={`flex items-center justify-between gap-1.5 h-9 px-2 shrink-0 ${
              isBlueprint
                ? "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-slate-100 dark:bg-slate-800/95 shadow-[2px_2px_0px_#0F172A]"
                : "rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-slate-100/80 dark:bg-slate-800/70"
            }`}
          >
            {/* Left: Inline Quick Scene Preset Selector (No need to expand panel) */}
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 shrink-0">原图类型:</span>
              <select
                value={scenePreset}
                onChange={(e) => applyScenePreset(e.target.value as ScenePresetKey)}
                aria-label="图像识别预设"
                className="bg-transparent text-[11px] font-black text-slate-800 dark:text-slate-100 outline-none cursor-pointer truncate"
              >
                <option value="cg_recolor">🤖 彩色官图 / CG</option>
                <option value="photo_miniature">🗿 灰模 / 实拍图</option>
                <option value="lineart_card">📄 纯黑白线稿</option>
              </select>
            </div>

            {/* Right: Expand/Collapse Advanced Settings */}
            <button
              type="button"
              onClick={() => setShowAlgorithmPanel((v) => !v)}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold text-slate-800 dark:text-slate-100 bg-white/80 dark:bg-slate-900/70 border border-slate-300/80 dark:border-slate-600/80 hover:bg-[var(--accent-soft)] cursor-pointer transition"
            >
              <span>⚙️ 高级设置</span>
              <span>{showAlgorithmPanel ? "▾" : "▸"}</span>
            </button>
          </div>
        )}

        {(alwaysOpen || showAlgorithmPanel) && (
          <div
            className={`p-3 space-y-3 text-xs shrink-0 ${
              isBlueprint
                ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-900 shadow-[2px_2px_0px_#0F172A]"
                : "rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
            }`}
          >
            {/* STEP 1: One-Click Image Type Presets (Always visible on both Mobile & Desktop) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                  1. 选择原图类型（一键匹配最佳参数）
                </span>
                <button
                  type="button"
                  onClick={() => applyScenePreset(scenePreset)}
                  className="text-[10px] font-extrabold underline cursor-pointer whitespace-nowrap shrink-0"
                  style={{ color: "var(--accent-color)" }}
                >
                  ↺ 恢复默认
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    {
                      key: "cg_recolor" as ScenePresetKey,
                      icon: "🤖",
                      title: "彩色官图/CG",
                      sub: "高达官图·成品图",
                    },
                    {
                      key: "photo_miniature" as ScenePresetKey,
                      icon: "🗿",
                      title: "灰模/实拍图",
                      sub: "水补土·素组照片",
                    },
                    {
                      key: "lineart_card" as ScenePresetKey,
                      icon: "📄",
                      title: "纯黑白线稿",
                      sub: "仅限白底设定稿",
                    },
                  ]
                ).map((p) => {
                  const active = scenePreset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyScenePreset(p.key)}
                      className={`flex flex-col items-center justify-center p-2 text-center transition cursor-pointer ${
                        isBlueprint
                          ? `rounded-[5px] border-[1.5px] ${
                              active
                                ? "border-slate-900 dark:border-slate-300 bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                                : "border-slate-900/70 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`
                          : `rounded-xl border ${
                              active
                                ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-sm"
                                : "border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 hover:border-[var(--accent-color)]"
                            }`
                      }`}
                    >
                      <span className="text-sm leading-none">{p.icon}</span>
                      <span className="mt-1 text-[11px] font-black leading-tight">{p.title}</span>
                      <span
                        className={`mt-0.5 text-[9px] font-bold leading-tight ${
                          active ? "text-white/90" : "text-slate-400 dark:text-slate-400"
                        }`}
                      >
                        {p.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: Prominent Checkable Switches (要打勾打开的设置) */}
            <div className={`pt-2.5 space-y-2 ${dividerTopClass}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                  2. 核心防漏与画面开关（点击打勾开启）
                </span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400">
                  遇到串色/变黑优先调这里
                </span>
              </div>

              {/* Switch 1: Canny Barrier (补全浅色断线) */}
              <div
                onClick={() => setUseCannyBarrier((v) => !v)}
                role="checkbox"
                aria-checked={useCannyBarrier}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setUseCannyBarrier((v) => !v);
                  }
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  useCannyBarrier
                    ? "border-[var(--accent-color)] bg-[var(--accent-soft)]/50 dark:bg-slate-800/90 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 border transition ${
                        useCannyBarrier
                          ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      🛡️ 补全浅色断线（防漏色必开）
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${
                      useCannyBarrier
                        ? "bg-[var(--accent-color)] text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {useCannyBarrier ? "已打勾 ✓" : "未开启"}
                  </span>
                </div>
                <p className="mt-1 pl-7 text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  自动补全高光反光处看不清的浅刻线，防止点按填色时颜料从断口漏到隔壁零件。
                </p>
              </div>

              {/* Switch 2: Color Difference Barrier (按原图颜色防串色) */}
              <div
                className={`p-2.5 rounded-xl border transition ${
                  colorBarrierEnabled
                    ? "border-[var(--accent-color)] bg-[var(--accent-soft)]/50 dark:bg-slate-800/90 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div
                  onClick={() => setFillTolerance((v) => (v > 0 ? 0 : 26))}
                  role="checkbox"
                  aria-checked={colorBarrierEnabled}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setFillTolerance((v) => (v > 0 ? 0 : 26));
                    }
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 border transition ${
                        colorBarrierEnabled
                          ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      🎨 按原图颜色边界防串色（官图/彩图必开）
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${
                      colorBarrierEnabled
                        ? "bg-[var(--accent-color)] text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {colorBarrierEnabled ? `已打勾 · ${fillTolerance}` : "未开启"}
                  </span>
                </div>
                <p className="mt-1 pl-7 text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  哪怕两个零件之间没有黑线，只要原图颜色不同就能自动挡住不串色。
                </p>
                {colorBarrierEnabled && (
                  <div className="mt-2 pl-7 pt-1.5 border-t border-dashed border-slate-300/70 dark:border-slate-700">
                    <SliderRow
                      label="颜色容差范围（调小=防串色更严，调大=单次涂抹范围更大）"
                      value={fillTolerance}
                      min={5}
                      max={60}
                      compact
                      onChange={setFillTolerance}
                    />
                  </div>
                )}
              </div>

              {/* Switch 3: 3D Corner / Shadow Step Barrier (按立体折角阴影防漏) */}
              <div
                className={`p-2.5 rounded-xl border transition ${
                  stepBarrierEnabled
                    ? "border-[var(--accent-color)] bg-[var(--accent-soft)]/50 dark:bg-slate-800/90 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div
                  onClick={() => setLocalStepThreshold((v) => (v > 0 ? 0 : 15))}
                  role="checkbox"
                  aria-checked={stepBarrierEnabled}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setLocalStepThreshold((v) => (v > 0 ? 0 : 15));
                    }
                  }}
                  className="flex items-center justify-between gap-2 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 border transition ${
                        stepBarrierEnabled
                          ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      📐 按立体折角阴影防漏（灰模/实拍必开）
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${
                      stepBarrierEnabled
                        ? "bg-[var(--accent-color)] text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {stepBarrierEnabled ? `已打勾 · ${localStepThreshold}` : "未开启"}
                  </span>
                </div>
                <p className="mt-1 pl-7 text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  识别零件立体转折的明暗交界线，防止同色零件在阴影处漏成一片。
                </p>
                {stepBarrierEnabled && (
                  <div className="mt-2 pl-7 pt-1.5 border-t border-dashed border-slate-300/70 dark:border-slate-700">
                    <SliderRow
                      label="折角阻断灵敏度（调小=更严密防漏，调大=跨阴影平涂）"
                      value={localStepThreshold}
                      min={4}
                      max={40}
                      compact
                      onChange={setLocalStepThreshold}
                    />
                  </div>
                )}
              </div>

              {/* Switch 4: Solid Ink Fill (深色区域涂黑加固 — With clear warning for CG/Photos!) */}
              <div
                onClick={() => setXdogInkFill((v) => !v)}
                role="checkbox"
                aria-checked={xdogInkFill}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setXdogInkFill((v) => !v);
                  }
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  xdogInkFill
                    ? "border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 border transition ${
                        xdogInkFill
                          ? "bg-amber-500 border-amber-600 text-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      ✒️ 深色区域涂黑加固（仅限白底线稿）
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${
                      xdogInkFill
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {xdogInkFill ? "已打勾 ⚠️" : "已关闭"}
                  </span>
                </div>
                <p className="mt-1 pl-7 text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  把深色部分全部涂成纯黑墨线。<strong className="text-amber-700 dark:text-amber-300">上传彩色官图或黑底照片请务必取消打勾</strong>，否则深色零件和背景会整块变黑！
                </p>
              </div>

              {/* Switch 5: Filter Red Stamp / Yellow Paper */}
              <div
                onClick={() => setFilterRedStamp((v) => !v)}
                role="checkbox"
                aria-checked={filterRedStamp}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setFilterRedStamp((v) => !v);
                  }
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  filterRedStamp
                    ? "border-[var(--accent-color)] bg-[var(--accent-soft)]/50 dark:bg-slate-800/90 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black shrink-0 border transition ${
                        filterRedStamp
                          ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-white"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      🧹 过滤说明书红印章 / 发黄底纹
                    </span>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-black ${
                      filterRedStamp
                        ? "bg-[var(--accent-color)] text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {filterRedStamp ? "已打勾 ✓" : "未开启"}
                  </span>
                </div>
                <p className="mt-1 pl-7 text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  仅在上传带红色印章或纸张发黄的扫描线稿时打勾；若是拍红色零件请关闭。
                </p>
              </div>
            </div>

            {/* STEP 3: Plain-Language Fine-Tuning Sliders (线条与填色细节微调) */}
            <div className={`pt-2.5 space-y-2.5 ${dividerTopClass}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                  3. 线条与填色细节微调
                </span>
              </div>

              <SliderRow
                label="👁️ 表面黑线显示浓淡"
                hint="黑线太重遮挡漆面颜色时调低（彩色官图建议 30%~50%）"
                value={lineOpacity}
                min={0}
                max={100}
                suffix="%"
                onChange={setLineOpacity}
              />

              <SliderRow
                label="🔗 自动缝合断线缺口"
                hint="填色容易从细小缝隙漏出去时往右调高（推荐 1~2px）"
                value={gapCloseRadius}
                min={0}
                max={3}
                suffix="px"
                onChange={setGapCloseRadius}
              />

              <SliderRow
                label="🧲 细小零件边缘填满度"
                hint="天线、火神炮或零件窄边留白填不满时往右调高"
                value={edgeAbsorb}
                min={0}
                max={8}
                suffix="px"
                onChange={setEdgeAbsorb}
              />

              {/* Line Extraction Method & Detail Sliders */}
              <div className="pt-1 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>线条提取方式</span>
                  <div className="flex items-center gap-1">
                    <span>未上色底纸：</span>
                    <button
                      type="button"
                      onClick={() => setPaperBgStyle((s) => (s === "source" ? "white" : "source"))}
                      className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {paperBgStyle === "source" ? "🖼️ 保留原图" : "📄 纯白底纸"}
                    </button>
                  </div>
                </div>

                <div className="gk-tab-bar grid grid-cols-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-200/70 dark:bg-slate-800 p-0.5 gap-1">
                  <button
                    type="button"
                    onClick={() => setExtractionMode("xdog")}
                    className={`gk-tab-pill rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                      extractionMode === "xdog"
                        ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    🎨 智能提取轮廓 (推荐)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtractionMode("threshold")}
                    className={`gk-tab-pill rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                      extractionMode === "threshold"
                        ? "gk-tab-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    ✒️ 黑白墨线直提
                  </button>
                </div>

                {extractionMode === "threshold" ? (
                  <div className="space-y-2 pt-1">
                    <SliderRow
                      label="✒️ 黑线提取深浅范围"
                      hint="往右调高可把浅灰铅笔线也变成黑线（仅限白底线稿）"
                      value={lineThreshold}
                      min={100}
                      max={230}
                      onChange={setLineThreshold}
                    />
                    <SliderRow
                      label="🫧 线条边缘柔化过渡"
                      hint="消除黑白线条边缘的锯齿感"
                      value={lineSoftness}
                      min={5}
                      max={70}
                      onChange={setLineSoftness}
                    />
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <SliderRow
                        label="📏 轮廓线条粗细"
                        hint="太粗糊细节调低，太细调高"
                        value={xdogSigma}
                        min={0.6}
                        max={2.5}
                        step={0.1}
                        onChange={setXdogSigma}
                        compact
                      />
                      <SliderRow
                        label="🔍 浅刻线识别度"
                        hint="浅刻线没显示出来时调高"
                        value={xdogP}
                        min={5}
                        max={45}
                        onChange={setXdogP}
                        compact
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <SliderRow
                        label="🌤️ 过滤曲面黑斑"
                        hint="暗部有脏黑斑噪点时调高"
                        value={xdogEpsilon}
                        min={0.4}
                        max={0.98}
                        step={0.01}
                        onChange={setXdogEpsilon}
                        compact
                      />
                      <SliderRow
                        label="🔪 线条边缘清晰度"
                        hint="线条发虚模糊时调高"
                        value={xdogPhi}
                        min={0.5}
                        max={8}
                        step={0.1}
                        onChange={setXdogPhi}
                        compact
                      />
                    </div>
                  </div>
                )}
              </div>

              {(activeTool === "pen" || activeTool === "lineEraser") && (
                <SliderRow
                  label="✏️ 手动封口笔 / 擦线橡皮粗细"
                  value={brushRadius}
                  min={1}
                  max={10}
                  suffix="px"
                  onChange={setBrushRadius}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Reusable Used Palette + Brand Paint Assignment Closed-Loop Section (📋 本图已用色卡)
  const renderUsedPaintsSection = (showExportActions = false) => (
    <div className="space-y-2 shrink-0" translate="no">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
          <span className="tech-prefix">[RECIPE]</span>
          📋 本图已用色卡 ({usedPaintsSummary.length})
        </span>
        <div className="flex items-center gap-1.5">
          {unassignedUsedCount > 0 && (
            <button
              type="button"
              onClick={handleBatchAssignAllBrandPaints}
              title="将本图中所有未绑定品牌的自定义色一键匹配并锁定为最接近的真实品牌模型漆"
              className={`px-2 py-0.5 text-[10px] font-black cursor-pointer transition ${primaryActionBtnClass}`}
            >
              🪄 一键全部指派品牌漆 ({unassignedUsedCount})
            </button>
          )}
          {usedPaintsSummary.length > 0 && (
            <button
              type="button"
              onClick={handleResetAllFills}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline cursor-pointer"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {usedPaintsSummary.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-1.5">
          在画布上点按或划过装甲区域填色后，这里会自动汇总本图已用色卡并支持一键绑定真实油漆品牌与色号。
        </p>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {usedPaintsSummary.map((item) => {
            const closest = item.closestPaint;
            return (
              <div
                key={item.hex}
                className={`flex items-center justify-between gap-1.5 px-2 py-1.5 transition ${
                  isBlueprint
                    ? "rounded-[4px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-800/90 shadow-[1.5px_1.5px_0px_#0F172A] hover:bg-[var(--accent-soft)]"
                    : "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:border-[var(--accent-color)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const hsl = hexToHsl(item.hex);
                    if (hsl.s >= 4) setSelectedHue(hsl.h);
                    setSelectedMatrixCell(findNearestMatrixCell(hsl.l, hsl.s));
                    const nextMeta = {
                      brand: item.brand || closest?.brandZh || "Custom",
                      code: item.code || closest?.paint.code || "HEX",
                      name: item.name || closest?.paint.name || item.hex,
                    };
                    setStagingAnchor({
                      hex: item.hex.toUpperCase(),
                      brand: nextMeta.brand,
                      code: nextMeta.code,
                      name: nextMeta.name,
                    });
                    applyPaintToSelectedRegions(item.hex, nextMeta);
                  }}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  title="点击复用该颜色或替换当前选中分区"
                >
                  <span
                    className={`relative h-6 w-6 min-w-[24px] min-h-[24px] shrink-0 ${
                      isBlueprint
                        ? "rounded-[3px] border-[1.5px] border-slate-900 dark:border-slate-400"
                        : "rounded border border-black/20 shadow-2xs"
                    }`}
                    style={{ backgroundColor: item.hex }}
                  >
                    {item.tintRecipe && !item.tintRecipe.isDirectSpray && (
                      <span
                        title={`基底主漆原色：${item.tintRecipe.baseBrandName} ${item.tintRecipe.basePaint.code} (${item.tintRecipe.basePaint.hex})`}
                        className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-[2px] border border-white shadow-2xs"
                        style={{ backgroundColor: item.tintRecipe.basePaint.hex }}
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {item.isConfirmed ? (
                      <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">
                        <span
                          className={`px-1 py-0.2 text-[9px] font-black shrink-0 ${
                            isBlueprint
                              ? "rounded-[3px] border border-slate-900 bg-emerald-100 dark:bg-emerald-950/90 text-slate-900 dark:text-emerald-200 font-mono"
                              : "rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {item.brand} {item.code}
                        </span>
                        <span className="truncate">{item.name}</span>
                        {item.tintRecipe?.isDirectSpray && (
                          <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                            (直喷)
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 truncate">
                        <span className="truncate font-mono">
                          [待确认 ≈ {closest ? `${closest.brandZh} ${closest.paint.code} ${closest.paint.name}` : item.hex}]
                        </span>
                      </div>
                    )}
                    {item.tintRecipe && !item.tintRecipe.isDirectSpray ? (
                      <div
                        title={item.tintRecipe.spokenInstruction}
                        className={`inline-flex items-center gap-1 h-[18px] px-1.5 max-w-full truncate ${
                          isBlueprint
                            ? "rounded-[3px] border border-slate-900 bg-amber-100/90 dark:bg-amber-950/80 text-slate-900 dark:text-amber-200"
                            : "rounded bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        <span className="inline-flex h-2.5 w-4 shrink-0 overflow-hidden rounded-[2px] border border-black/30">
                          <span className="flex-1 h-full" style={{ backgroundColor: item.tintRecipe.basePaint.hex }} />
                          <span className="flex-1 h-full" style={{ backgroundColor: item.hex }} />
                        </span>
                        <span className="text-[9px] font-mono font-black truncate">
                          {item.tintRecipe.compactBadgeText}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                        <span className="font-mono">{item.hex}</span> · {item.regionCount} 处分区
                        {!item.isConfirmed && closest ? ` · ΔE ${closest.deltaE.toFixed(1)}` : ""}
                      </div>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {!item.isConfirmed && closest && (
                    <button
                      type="button"
                      onClick={() => assignBrandPaintToHexRegions(item.hex, closest.paint, closest.brandZh, false)}
                      title={`一键确认为 ${closest.brandZh} ${closest.paint.code} ${closest.paint.name}`}
                      className={`px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black cursor-pointer ${
                        isBlueprint
                          ? "rounded-[3px] border-[1.5px] border-slate-900 shadow-[1.5px_1.5px_0px_#0F172A] font-mono"
                          : "rounded"
                      }`}
                    >
                      🎯 确认
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAssigningTargetHex(item.hex);
                      setColoringMode("brand");
                    }}
                    title="从品牌油漆库重新指派该分区色卡的品牌与色号"
                    className={`px-1.5 py-0.5 text-[9px] font-extrabold cursor-pointer ${secondaryActionBtnClass}`}
                  >
                    换漆
                  </button>
                  {onNavigateToBrandTint && (
                    <button
                      type="button"
                      onClick={() => onNavigateToBrandTint(item.hex)}
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold transition cursor-pointer ${secondaryActionBtnClass}`}
                      title="前往「选漆与微调」查看现成品牌漆 + 几滴白/黑微调补正方案"
                    >
                      🍼 微调
                    </button>
                  )}
                  {onSendColorToMixer && workflowMode === "pro" && (
                    <button
                      type="button"
                      onClick={() => onSendColorToMixer(item.hex)}
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold transition cursor-pointer ${secondaryActionBtnClass}`}
                      title="将该颜色发往主工作台「混色台 / 调色分解」反推实体漆调色配方"
                    >
                      🧪 调配
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dual Primary Actions in Used Palette Card (shown in mobile sheet) */}
      {showExportActions && (
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
            <span>📥 导出带色卡 PNG</span>
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
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Floating Tool Dock (Stepless 2D Free Positioning + 4-Edge Adaptive + Collapsible)
  // ---------------------------------------------------------------------------
  const SAFE_DOCK_PADDING = 8;
  const EDGE_SNAP_THRESHOLD = 24;

  const updateDockMetrics = useCallback(() => {
    const vp = viewportRef.current;
    const dk = dockRef.current;
    if (!vp) return;
    const vw = vp.clientWidth || 800;
    const vh = vp.clientHeight || 600;
    const dockW = dk ? dk.offsetWidth : isDockCollapsed ? 44 : 46;
    const dockH = dk ? dk.offsetHeight : isDockCollapsed ? 44 : 310;
    setDockMetrics((prev) =>
      prev.vw === vw && prev.vh === vh && prev.dockW === dockW && prev.dockH === dockH
        ? prev
        : { vw, vh, dockW, dockH }
    );
  }, [isDockCollapsed]);

  useLayoutEffect(() => {
    updateDockMetrics();
  }, [updateDockMetrics, isDockCollapsed, toolDockPos.side, isFullscreen, isDesktopPaletteCollapsed]);

  useEffect(() => {
    const vp = viewportRef.current;
    const dk = dockRef.current;
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => updateDockMetrics());
    if (vp) ro.observe(vp);
    if (dk) ro.observe(dk);
    return () => ro.disconnect();
  }, [updateDockMetrics, isDockCollapsed]);

  const dockDragStartRef = useRef<{
    mode: "expanded" | "collapsed";
    startX: number;
    startY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    moved: boolean;
  } | null>(null);

  const computeClosestDockEdge = (relX: number, relY: number, vw: number, vh: number): DockPosition => {
    const dLeft = relX / Math.max(1, vw);
    const dRight = (vw - relX) / Math.max(1, vw);
    const dTop = relY / Math.max(1, vh);
    const dBottom = (vh - relY) / Math.max(1, vh);
    const min = Math.min(dLeft, dRight, dTop, dBottom);
    if (min === dTop) return "top";
    if (min === dBottom) return "bottom";
    if (min === dRight) return "right";
    return "left";
  };

  const persistToolDockPos = (next: ToolDockPosition) => {
    setToolDockPos(next);
    try {
      window.localStorage.setItem(
        DOCK_POS_STORAGE_KEY,
        JSON.stringify({
          side: next.side,
          xRatio: Number(next.xRatio.toFixed(4)),
          yRatio: Number(next.yRatio.toFixed(4)),
        })
      );
    } catch {
      /* ignore */
    }
  };

  // Expanded mode: Drag handle (⋮⋮) pointer handlers (4-edge adaptive + stepless slide along edge)
  const handleDockHandlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const vp = viewportRef.current;
    const dk = dockRef.current;
    if (!vp || !dk) return;
    const dkRect = dk.getBoundingClientRect();
    dockDragStartRef.current = {
      mode: "expanded",
      startX: e.clientX,
      startY: e.clientY,
      grabOffsetX: Math.min(30, Math.max(8, e.clientX - dkRect.left)),
      grabOffsetY: Math.min(30, Math.max(8, e.clientY - dkRect.top)),
      moved: false,
    };
    setShowShadingPopover(false);
  };

  const handleDockHandlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dockDragStartRef.current;
    if (!drag || drag.mode !== "expanded") return;
    e.stopPropagation();
    const vp = viewportRef.current;
    const dk = dockRef.current;
    if (!vp) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    const rect = vp.getBoundingClientRect();
    const vw = rect.width || dockMetrics.vw;
    const vh = rect.height || dockMetrics.vh;
    const cursorX = Math.max(0, Math.min(vw, e.clientX - rect.left));
    const cursorY = Math.max(0, Math.min(vh, e.clientY - rect.top));
    const previewSide = computeClosestDockEdge(cursorX, cursorY, vw, vh);
    const previewHorizontal = previewSide === "top" || previewSide === "bottom";

    const curW = dk ? dk.offsetWidth : dockMetrics.dockW;
    const curH = dk ? dk.offsetHeight : dockMetrics.dockH;
    const longDim = Math.max(curW, curH, 380);
    const shortDim = Math.min(curW, curH, 58);
    const estW = previewHorizontal ? longDim : shortDim;
    const estH = previewHorizontal ? shortDim : longDim;

    const rawX = cursorX - drag.grabOffsetX;
    const rawY = cursorY - drag.grabOffsetY;
    const clampedX = Math.min(
      Math.max(rawX, SAFE_DOCK_PADDING),
      Math.max(SAFE_DOCK_PADDING, vw - estW - SAFE_DOCK_PADDING)
    );
    const clampedY = Math.min(
      Math.max(rawY, SAFE_DOCK_PADDING),
      Math.max(SAFE_DOCK_PADDING, vh - estH - SAFE_DOCK_PADDING)
    );
    setDockDragState({ x: clampedX, y: clampedY, previewSide, mode: "expanded" });
  };

  const handleDockHandlePointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dockDragStartRef.current;
    if (!drag || drag.mode !== "expanded") return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const wasMoved = drag.moved;
    dockDragStartRef.current = null;

    if (wasMoved && dockDragState) {
      const vp = viewportRef.current;
      const vw = vp?.clientWidth || dockMetrics.vw;
      const vh = vp?.clientHeight || dockMetrics.vh;
      const nextSide = dockDragState.previewSide;
      // Snap primary axis to edge (0 or 1), keep secondary axis 100% stepless at release coordinate!
      const nextXRatio =
        nextSide === "left"
          ? 0
          : nextSide === "right"
          ? 1
          : Math.max(0, Math.min(1, dockDragState.x / Math.max(1, vw)));
      const nextYRatio =
        nextSide === "top"
          ? 0
          : nextSide === "bottom"
          ? 1
          : Math.max(0, Math.min(1, dockDragState.y / Math.max(1, vh)));

      persistToolDockPos({
        side: nextSide,
        xRatio: nextXRatio,
        yRatio: nextYRatio,
      });
      const sideName =
        nextSide === "left" ? "左侧" : nextSide === "right" ? "右侧" : nextSide === "top" ? "顶部" : "底部";
      setStatusMessage(`工具坞：${sideName}自由停靠 (可任意拖拽定位)`);
    }
    setDockDragState(null);
  };

  // Collapsed Mini Cube: Full-cube 2D free drag + <24px gentle edge snap + d<=5px click-to-expand
  const handleCollapsedCubePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const dk = dockRef.current;
    if (!dk) return;
    const dkRect = dk.getBoundingClientRect();
    dockDragStartRef.current = {
      mode: "collapsed",
      startX: e.clientX,
      startY: e.clientY,
      grabOffsetX: e.clientX - dkRect.left,
      grabOffsetY: e.clientY - dkRect.top,
      moved: false,
    };
  };

  const handleCollapsedCubePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dockDragStartRef.current;
    if (!drag || drag.mode !== "collapsed") return;
    e.stopPropagation();
    const vp = viewportRef.current;
    const dk = dockRef.current;
    if (!vp) return;
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (dist > 5) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    const rect = vp.getBoundingClientRect();
    const vw = rect.width || dockMetrics.vw;
    const vh = rect.height || dockMetrics.vh;
    const cubeW = dk ? dk.offsetWidth : 48;
    const cubeH = dk ? dk.offsetHeight : 48;

    let rawX = e.clientX - rect.left - drag.grabOffsetX;
    let rawY = e.clientY - rect.top - drag.grabOffsetY;

    // Gentle edge snap when within < 24px of any border, preserving stepless position on the other axis
    if (rawX < EDGE_SNAP_THRESHOLD) rawX = SAFE_DOCK_PADDING;
    else if (rawX + cubeW > vw - EDGE_SNAP_THRESHOLD) rawX = vw - cubeW - SAFE_DOCK_PADDING;

    if (rawY < EDGE_SNAP_THRESHOLD) rawY = SAFE_DOCK_PADDING;
    else if (rawY + cubeH > vh - EDGE_SNAP_THRESHOLD) rawY = vh - cubeH - SAFE_DOCK_PADDING;

    const clampedX = Math.min(
      Math.max(rawX, SAFE_DOCK_PADDING),
      Math.max(SAFE_DOCK_PADDING, vw - cubeW - SAFE_DOCK_PADDING)
    );
    const clampedY = Math.min(
      Math.max(rawY, SAFE_DOCK_PADDING),
      Math.max(SAFE_DOCK_PADDING, vh - cubeH - SAFE_DOCK_PADDING)
    );
    const previewSide = computeClosestDockEdge(clampedX + cubeW / 2, clampedY + cubeH / 2, vw, vh);
    setDockDragState({ x: clampedX, y: clampedY, previewSide, mode: "collapsed" });
  };

  const handleCollapsedCubePointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dockDragStartRef.current;
    if (!drag || drag.mode !== "collapsed") return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const wasMoved = drag.moved;
    dockDragStartRef.current = null;

    if (wasMoved && dockDragState) {
      const vp = viewportRef.current;
      const dk = dockRef.current;
      const vw = vp?.clientWidth || dockMetrics.vw;
      const vh = vp?.clientHeight || dockMetrics.vh;
      const cubeW = dk ? dk.offsetWidth : 48;
      const cubeH = dk ? dk.offsetHeight : 48;

      const nextXRatio =
        dockDragState.x <= SAFE_DOCK_PADDING + 2
          ? 0
          : dockDragState.x >= vw - cubeW - SAFE_DOCK_PADDING - 2
          ? 1
          : Math.max(0, Math.min(1, dockDragState.x / Math.max(1, vw)));
      const nextYRatio =
        dockDragState.y <= SAFE_DOCK_PADDING + 2
          ? 0
          : dockDragState.y >= vh - cubeH - SAFE_DOCK_PADDING - 2
          ? 1
          : Math.max(0, Math.min(1, dockDragState.y / Math.max(1, vh)));

      persistToolDockPos({
        side: dockDragState.previewSide,
        xRatio: nextXRatio,
        yRatio: nextYRatio,
      });
      setStatusMessage("工具坞：已折叠悬浮 (可任意拖拽定位)");
      setDockDragState(null);
      return;
    }

    // d <= 5px: Pure click -> Expand in-place!
    setDockDragState(null);
    handleToggleDockCollapse(false);
  };

  const handleToggleDockCollapse = (nextCollapsed: boolean) => {
    // If collapsing from the initial centered state before any drag, freeze current top-left ratio
    if (nextCollapsed && toolDockPos.isInitialCentered && viewportRef.current && dockRef.current) {
      const vw = viewportRef.current.clientWidth || dockMetrics.vw;
      const vh = viewportRef.current.clientHeight || dockMetrics.vh;
      const dockH = dockRef.current.offsetHeight || dockMetrics.dockH;
      const currentTop = Math.max(SAFE_DOCK_PADDING, 0.5 * vh - dockH / 2);
      persistToolDockPos({
        side: toolDockPos.side,
        xRatio: 0,
        yRatio: Math.max(0, Math.min(1, currentTop / Math.max(1, vh))),
      });
    }
    setIsDockCollapsed(nextCollapsed);
    setShowShadingPopover(false);
    try {
      window.localStorage.setItem(DOCK_COLLAPSED_STORAGE_KEY, nextCollapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (nextCollapsed) {
      setStatusMessage("工具坞：已折叠悬浮 (按住可任意拖拽，点击原地展开)");
    } else {
      const sideName =
        toolDockPos.side === "left"
          ? "左侧"
          : toolDockPos.side === "right"
          ? "右侧"
          : toolDockPos.side === "top"
          ? "顶部"
          : "底部";
      setStatusMessage(`工具坞：${sideName}自由停靠 (可任意拖拽定位)`);
    }
  };

  const effectiveDockEdge: DockPosition = dockDragState ? dockDragState.previewSide : toolDockPos.side;
  const isHorizontalDock = effectiveDockEdge === "top" || effectiveDockEdge === "bottom";

  // Compute stepless pixel coordinates (clampedX, clampedY) with bounding-box safety clamping
  const { vw: curVw, vh: curVh, dockW: curDockW, dockH: curDockH } = dockMetrics;
  const rawDockX = dockDragState
    ? dockDragState.x
    : toolDockPos.xRatio >= 0.99
    ? curVw - curDockW - SAFE_DOCK_PADDING
    : toolDockPos.xRatio <= 0.01
    ? SAFE_DOCK_PADDING
    : toolDockPos.xRatio * curVw;
  const rawDockY = dockDragState
    ? dockDragState.y
    : toolDockPos.isInitialCentered
    ? 0.5 * curVh - curDockH / 2
    : toolDockPos.yRatio >= 0.99
    ? curVh - curDockH - SAFE_DOCK_PADDING
    : toolDockPos.yRatio <= 0.01
    ? SAFE_DOCK_PADDING
    : toolDockPos.yRatio * curVh;

  const clampedDockX = Math.min(
    Math.max(rawDockX, SAFE_DOCK_PADDING),
    Math.max(SAFE_DOCK_PADDING, curVw - curDockW - SAFE_DOCK_PADDING)
  );
  const clampedDockY = Math.min(
    Math.max(rawDockY, SAFE_DOCK_PADDING),
    Math.max(SAFE_DOCK_PADDING, curVh - curDockH - SAFE_DOCK_PADDING)
  );

  const shadingShortBadge = renderMode === "four-layer" ? "4层" : renderMode === "intrinsic" ? "3D" : "2D";
  const shadingFullLabel =
    renderMode === "four-layer"
      ? "✨ 四层光影推导"
      : renderMode === "intrinsic"
      ? "💎 3D 相对光影保留"
      : "🎨 2D 纯色平涂";

  const renderActiveToolIcon = (size = 18) => {
    switch (activeTool) {
      case "fill":
        return <PaintBucketIcon size={size} weight="duotone" />;
      case "select":
        return <SelectionPlusIcon size={size} weight="bold" />;
      case "pen":
        return <PencilSimpleLineIcon size={size} weight="bold" />;
      case "lineEraser":
        return <ScissorsIcon size={size} weight="bold" />;
      case "eraser":
        return <EraserIcon size={size} weight="duotone" />;
      case "pan":
        return <HandGrabbingIcon size={size} weight="duotone" />;
    }
  };

  const renderShadingModeIcon = (size = 18) => {
    if (renderMode === "four-layer") return <SparkleIcon size={size} weight="fill" />;
    if (renderMode === "intrinsic") return <CubeIcon size={size} weight="duotone" />;
    return <PaintBrushBroadIcon size={size} weight="duotone" />;
  };

  // Shading Popover positioning:
  // Because the [SHADING] button sits at the 7th slot (~360px along the 416px dock body),
  // anchoring `bottom-0` on vertical docks (left/right) grows the ~300px popover upward along the dock body,
  // and anchoring `right-0` on horizontal docks (top/bottom) grows the 320px popover leftward along the dock body,
  // guaranteeing 100% viewport containment at every edge and corner without clipping!
  const shadingPopoverPositionClass =
    effectiveDockEdge === "left"
      ? "left-[calc(100%+10px)] bottom-[-44px]"
      : effectiveDockEdge === "right"
      ? "right-[calc(100%+10px)] bottom-[-44px]"
      : effectiveDockEdge === "top"
      ? "top-[calc(100%+10px)] right-0"
      : "bottom-[calc(100%+10px)] right-0";

  const renderFloatingToolDock = () => (
    <>
      {/* Magnetic Edge Indicator while dragging in Expanded mode */}
      {dockDragState && dockDragState.mode === "expanded" && (
        <div
          className={`pointer-events-none absolute z-20 transition-opacity duration-150 ${
            dockDragState.previewSide === "left"
              ? "left-1.5 top-4 bottom-4 w-1.5 rounded-full"
              : dockDragState.previewSide === "right"
              ? "right-1.5 top-4 bottom-4 w-1.5 rounded-full"
              : dockDragState.previewSide === "top"
              ? "top-1.5 left-4 right-4 h-1.5 rounded-full"
              : "bottom-1.5 left-4 right-4 h-1.5 rounded-full"
          }`}
          style={{
            backgroundColor: "var(--accent-color)",
            boxShadow: "0 0 12px var(--accent-color)",
          }}
        />
      )}

      <div
        ref={dockRef}
        translate="no"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          left: `${Math.round(clampedDockX)}px`,
          top: `${Math.round(clampedDockY)}px`,
        }}
        className={`notranslate absolute z-30 flex ${
          isDockCollapsed
            ? "flex-col items-center p-1"
            : isHorizontalDock
            ? "flex-row items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5"
            : "flex-col items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5"
        } transition-shadow select-none ${
          isBlueprint
            ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white/95 dark:bg-[#111827]/95 shadow-[3px_3px_0px_#0F172A] dark:shadow-[3px_3px_0px_#020617]"
            : "rounded-2xl border border-slate-200/85 dark:border-slate-700/85 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md shadow-xl"
        }`}
      >
        {isDockCollapsed ? (
          /* COLLAPSED MINI CUBE: Whole 44x44px cube is 2D freely draggable anywhere on canvas; pure click (d <= 5px) expands in-place */
          <div
            role="button"
            tabIndex={0}
            onPointerDown={handleCollapsedCubePointerDown}
            onPointerMove={handleCollapsedCubePointerMove}
            onPointerUp={handleCollapsedCubePointerEnd}
            onPointerCancel={handleCollapsedCubePointerEnd}
            title={`当前画笔与光影 (${shadingFullLabel}) · 按住可全画布任意无极拖动，点击原地展开工具坞`}
            className={`relative w-[36px] h-[36px] sm:w-[42px] sm:h-[42px] flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none transition ${
              isBlueprint
                ? "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                : "rounded-xl bg-[var(--accent-color)] text-white shadow-md backdrop-blur-md"
            }`}
          >
            {renderActiveToolIcon(17)}
            <div className="mt-0.5 flex items-center gap-0.5 px-1 rounded-[3px] bg-black/30 text-[8px] font-mono font-black leading-tight text-white">
              <span>{shadingShortBadge}</span>
              {effectiveDockEdge === "right" ? (
                <CaretLeftIcon className="w-2.5 h-2.5" weight="bold" />
              ) : effectiveDockEdge === "top" ? (
                <CaretDownIcon className="w-2.5 h-2.5" weight="bold" />
              ) : effectiveDockEdge === "bottom" ? (
                <CaretUpIcon className="w-2.5 h-2.5" weight="bold" />
              ) : (
                <CaretRightIcon className="w-2.5 h-2.5" weight="bold" />
              )}
            </div>
          </div>
        ) : (
          /* EXPANDED STATE: Drag Handle (⋮⋮) + Collapse Button + 6 Square Brush Buttons + Dashed Divider + Shading Slot + Reset Button */
          <>
            <div
              className={`flex ${
                isHorizontalDock
                  ? "flex-col items-center justify-between h-[32px] sm:h-[42px] pr-0.5"
                  : "flex-row items-center justify-between w-[35px] sm:w-[42px] pb-0.5"
              } text-slate-400 dark:text-slate-500`}
            >
              <div
                role="button"
                tabIndex={0}
                onPointerDown={handleDockHandlePointerDown}
                onPointerMove={handleDockHandlePointerMove}
                onPointerUp={handleDockHandlePointerEnd}
                onPointerCancel={handleDockHandlePointerEnd}
                title="⋮⋮ 按住可沿画布四边及四角无极自由拖拽停放"
                className="flex items-center justify-center p-0.5 rounded hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-grab active:cursor-grabbing touch-none"
              >
                {isHorizontalDock ? (
                  <DotsSixVerticalIcon className="w-3.5 h-3.5" weight="bold" />
                ) : (
                  <DotsSixIcon className="w-3.5 h-3.5" weight="bold" />
                )}
              </div>

              <button
                type="button"
                onClick={() => handleToggleDockCollapse(true)}
                title="收起为悬浮小方块（收起后可全画布 2D 无极拖拽摆放）"
                className="flex items-center justify-center p-0.5 rounded hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer"
              >
                {effectiveDockEdge === "right" ? (
                  <CaretRightIcon className="w-3 h-3" weight="bold" />
                ) : effectiveDockEdge === "top" ? (
                  <CaretUpIcon className="w-3 h-3" weight="bold" />
                ) : effectiveDockEdge === "bottom" ? (
                  <CaretDownIcon className="w-3 h-3" weight="bold" />
                ) : (
                  <CaretLeftIcon className="w-3 h-3" weight="bold" />
                )}
              </button>
            </div>

            <SquareDockButton
              active={activeTool === "fill"}
              onClick={() => setActiveTool("fill")}
              icon={<PaintBucketIcon size={18} weight="duotone" />}
              label="填色"
              title="🪣 智能填色：点击或按住连续划过装甲块填色"
              isBlueprint={isBlueprint}
            />
            <SquareDockButton
              active={activeTool === "select"}
              onClick={() => setActiveTool("select")}
              icon={<SelectionPlusIcon size={18} weight="bold" />}
              label="选区"
              title="🎯 选区多选：点选或划过多个装甲分区合并选区后统一换色"
              isBlueprint={isBlueprint}
            />
            <SquareDockButton
              active={activeTool === "pen"}
              onClick={() => setActiveTool("pen")}
              icon={<PencilSimpleLineIcon size={18} weight="bold" />}
              label="补线"
              title="✏️ 补线封口：手绘黑线焊死未闭合的装甲缝隙"
              isBlueprint={isBlueprint}
            />
            <SquareDockButton
              active={activeTool === "lineEraser"}
              onClick={() => setActiveTool("lineEraser")}
              icon={<ScissorsIcon size={18} weight="bold" />}
              label="擦线"
              title="✂️ 擦除黑线：擦除多余的噪点黑线"
              isBlueprint={isBlueprint}
            />
            <SquareDockButton
              active={activeTool === "eraser"}
              onClick={() => setActiveTool("eraser")}
              icon={<EraserIcon size={18} weight="duotone" />}
              label="橡皮"
              title="🧽 橡皮擦：点击或划过擦除已填颜色"
              isBlueprint={isBlueprint}
            />
            <SquareDockButton
              active={activeTool === "pan"}
              onClick={() => setActiveTool("pan")}
              icon={<HandGrabbingIcon size={18} weight="duotone" />}
              label="浏览"
              title="✋ 浏览平移：单指拖拽平移画布（也可按住空格键平移）"
              isBlueprint={isBlueprint}
            />

            {/* 1.5px Dashed Engineering Divider */}
            <div
              className={
                isHorizontalDock
                  ? "h-7 mx-0.5 border-l-[1.5px] border-dashed border-slate-400/90 dark:border-slate-500/90"
                  : "w-7 my-0.5 border-t-[1.5px] border-dashed border-slate-400/90 dark:border-slate-500/90"
              }
            />

            {/* Shading Mode Square Slot + Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowShadingPopover((v) => !v)}
                title={`当前光影合成：${shadingFullLabel}（点击切换 四层光影推导 / 3D相对光影保留 / 2D纯色平涂）`}
                className={`bp-btn ${
                  showShadingPopover ? "bp-pill-active" : ""
                } relative w-[35px] h-[31px] sm:w-[42px] sm:h-[42px] flex flex-col items-center justify-center transition cursor-pointer ${
                  isBlueprint
                    ? showShadingPopover
                      ? "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                      : "rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-[var(--accent-soft)] text-slate-900 dark:text-white shadow-[2px_2px_0px_#0F172A] hover:bg-[var(--accent-color)] hover:text-white"
                    : showShadingPopover
                    ? "rounded-xl border border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-md backdrop-blur-md"
                    : "rounded-xl border border-[var(--accent-color)]/45 bg-[var(--accent-soft)] text-[var(--accent-color)] dark:text-white hover:bg-[var(--accent-color)] hover:text-white backdrop-blur-md"
                }`}
              >
                {renderShadingModeIcon(15)}
                <span className="mt-0.5 text-[8px] sm:text-[9px] font-mono font-black leading-none">{shadingShortBadge}</span>
              </button>

              {showShadingPopover && (
                <div
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`absolute z-40 w-[300px] sm:w-[320px] p-2.5 space-y-2 ${shadingPopoverPositionClass} ${
                    isBlueprint
                      ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-[#111827] shadow-[4px_4px_0px_#0F172A] dark:shadow-[4px_4px_0px_#020617]"
                      : "rounded-2xl border border-slate-200/90 dark:border-slate-700/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl"
                  }`}
                >
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-dashed border-slate-300 dark:border-slate-700">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      <span className="tech-prefix">[SHADING]</span>
                      光影合成引擎
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowShadingPopover(false)}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {(
                    [
                      {
                        id: "four-layer" as RenderShadingMode,
                        title: "✨ 四层光影推导",
                        desc: "自动将所选颜色推导为「暗部阴影 · 标准主色 · 亮面 · 棱角高光」四阶色温，重塑浓郁的硬表面机甲立体感。",
                        fitLabel: "🎯 适合：素组灰模实拍 · 水补土图 · 机甲官图CG",
                        badge: "4层 · 默认推荐",
                      },
                      {
                        id: "intrinsic" as RenderShadingMode,
                        title: "💎 3D 相对光影保留",
                        desc: "1:1 无损保留原图真实的柔和明暗渐变与环境光影，仅替换零件表面的固有颜色（色相与明度）。",
                        fitLabel: "🎯 适合：成品棚拍照片 · GK手办皮肤服饰 · 细腻实拍图",
                        badge: "3D",
                      },
                      {
                        id: "flat" as RenderShadingMode,
                        title: "🎨 2D 纯色平涂",
                        desc: "完全忽略原图明暗起伏，填充 100% 均匀纯净的标准单色块，零光影叠加干扰。",
                        fitLabel: "🎯 适合：黑白设定线稿 (Lineart) · 平面分色卡设定稿",
                        badge: "2D",
                      },
                    ]
                  ).map((opt) => {
                    const active = renderMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setRenderMode(opt.id);
                          setShowShadingPopover(false);
                          setStatusMessage(`已切换光影模式：${opt.title}`);
                        }}
                        className={`w-full flex flex-col gap-1 p-2.5 text-left transition cursor-pointer ${
                          isBlueprint
                            ? `rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-500 ${
                                active
                                  ? "bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
                                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[1.5px_1.5px_0px_#0F172A] hover:bg-[var(--accent-soft)]"
                              }`
                            : `rounded-xl border ${
                                active
                                  ? "border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-xs"
                                  : "border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 hover:border-[var(--accent-color)]"
                              }`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="text-xs font-black leading-snug">{opt.title}</span>
                          <span
                            className={`shrink-0 px-1.5 py-0.5 font-mono text-[9px] font-black ${
                              isBlueprint
                                ? `rounded-[3px] border border-slate-900 ${
                                    active
                                      ? "bg-black/30 text-white"
                                      : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                                  }`
                                : `rounded ${
                                    active
                                      ? "bg-black/25 text-white"
                                      : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                  }`
                            }`}
                          >
                            {opt.badge}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] font-bold leading-relaxed break-words ${
                            active ? "text-white/95" : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {opt.desc}
                        </div>
                        <div
                          className={`mt-0.5 inline-flex items-center self-start px-1.5 py-0.5 text-[9px] font-extrabold leading-snug ${
                            isBlueprint
                              ? `rounded-[3px] border border-slate-900/70 font-mono ${
                                  active
                                    ? "bg-black/25 text-white"
                                    : "bg-[var(--accent-soft)] text-slate-900 dark:text-slate-100"
                                }`
                              : `rounded-md ${
                                  active
                                    ? "bg-black/20 text-white"
                                    : "bg-slate-200/75 dark:bg-slate-700/85 text-slate-700 dark:text-slate-200"
                                }`
                          }`}
                        >
                          {opt.fitLabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reset / Clear All Fills Square Button */}
            <SquareDockButton
              active={false}
              onClick={handleResetAllFills}
              icon={<TrashIcon size={17} weight="bold" />}
              label="重绘"
              title="🗑️ 一键清空重绘（支持通过顶栏「↶ 撤销」随时找回）"
              isBlueprint={isBlueprint}
              dangerHover
            />
          </>
        )}
      </div>
    </>
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
      {/* Main Resizable Split Workspace (Desktop >= 1024px: Flex Split with 10px Drag Handle & Safe Min/Max Bounds) */}
      <div
        ref={splitContainerRef}
        className={`flex flex-col lg:flex-row items-stretch w-full max-w-full min-w-0 gap-3.5 lg:gap-0 ${
          isFullscreen ? "flex-1 min-h-0 h-full" : ""
        }`}
      >
        {/* LEFT WORKSPACE: Interactive Sticky Canvas (Guaranteed min-width >= 520px on Desktop) */}
        <div
          style={{ minWidth: undefined }}
          className={`flex-1 min-w-0 lg:min-w-[520px] ${
            isFullscreen
              ? "h-full min-h-0"
              : "lg:h-[calc(100vh-204px)] lg:min-h-[540px]"
          } flex flex-col overflow-hidden ${cardSurfaceClass}`}
        >
          {/* Row 1: Upload / Line Mode / Compare / Undo-Redo / Collapse Palette / Fullscreen */}
          <div className={`shrink-0 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 ${isFullscreen ? "" : "pr-11 lg:pr-3"} ${dividerBottomClass}`}>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="tech-prefix hidden sm:inline text-slate-500 dark:text-slate-400">[STUDIO_CANVAS]</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`${primaryActionBtnClass} px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition cursor-pointer`}
              >
                📤 {imageToken > 0 ? "更换图片" : "上传图片"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadFile} className="hidden" />
            </div>

            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {/* Hold / Toggle Compare Original */}
              <button
                type="button"
                disabled={imageToken === 0}
                onPointerDown={() => setIsComparingOriginal(true)}
                onPointerUp={() => setIsComparingOriginal(false)}
                onPointerLeave={() => setIsComparingOriginal(false)}
                onClick={() => setIsComparingOriginal((v) => !v)}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition ${
                  imageToken === 0
                    ? "rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    : isComparingOriginal
                    ? `${primaryActionBtnClass} cursor-pointer`
                    : `${secondaryActionBtnClass} cursor-pointer`
                }`}
                title="按住或点击对比未上色原图"
              >
                👁️ 对比<span className="hidden sm:inline">原图</span>
              </button>
              <button
                type="button"
                disabled={undoCount === 0}
                onClick={handleUndo}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition ${
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
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition ${
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
                className={`hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
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
                className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  isFullscreen
                    ? primaryActionBtnClass
                    : isBlueprint
                    ? "gk-mech-btn rounded-[5px] border-[1.5px] border-slate-900 dark:border-slate-500 bg-[var(--accent-soft)] text-[var(--accent-color)] dark:text-white shadow-[2px_2px_0px_#0F172A]"
                    : "rounded-xl border border-[var(--accent-color)]/40 bg-[var(--accent-soft)] text-[var(--accent-color)] dark:text-white hover:bg-[var(--accent-color)] hover:text-white shadow-xs"
                }`}
                title={isFullscreen ? "退出全屏沉浸模式 (快捷键 Esc / F)" : "进入全屏沉浸操作模式，彻底消除顶栏与边缘遮挡 (快捷键 F)"}
              >
                <span>{isFullscreen ? "🗗 退出全屏" : "⛶ 全屏"}</span>
              </button>
            </div>
          </div>

          {/* Row 2: Locked Interactive Viewport with Floating Tool Dock + Engineering Darkroom Grid */}
          <div
            ref={viewportRef}
            onPointerDown={(e) => {
              if (showShadingPopover) setShowShadingPopover(false);
              handlePointerDown(e);
            }}
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
                : "h-[48dvh] min-h-[336px] max-h-[540px] sm:h-[52vh] lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1"
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

            {/* 4-Way Draggable & Collapsible Square Floating Tool Dock */}
            {renderFloatingToolDock()}

            {imageToken === 0 && (
              <div
                className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none ${
                  !isDockCollapsed && effectiveDockEdge === "left"
                    ? "pl-[56px] pr-3 py-4 sm:p-6"
                    : !isDockCollapsed && effectiveDockEdge === "right"
                    ? "pr-[56px] pl-3 py-4 sm:p-6"
                    : !isDockCollapsed && effectiveDockEdge === "top"
                    ? "pt-[56px] pb-3 px-4 sm:p-6"
                    : !isDockCollapsed && effectiveDockEdge === "bottom"
                    ? "pb-[56px] pt-3 px-4 sm:p-6"
                    : "p-4 sm:p-6"
                }`}
              >
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => fileInputRef.current?.click()}
                  className={`pointer-events-auto flex flex-col items-center gap-2 border-2 border-dashed px-4 py-5 sm:px-8 sm:py-7 w-full max-w-[260px] sm:max-w-xs text-center transition cursor-pointer ${
                    isBlueprint
                      ? "rounded-[6px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-900 shadow-[3px_3px_0px_#0F172A]"
                      : "rounded-2xl border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 shadow-xl hover:border-[var(--accent-color)]"
                  }`}
                >
                  <span
                    className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl text-xl sm:text-2xl text-white shadow-sm"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    📤
                  </span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">上传一张图片开始试色</span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
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
                className={`absolute top-3 left-16 z-20 flex items-center gap-2 px-3 py-1.5 text-xs font-extrabold text-white ${primaryActionBtnClass}`}
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

            {/* Compact Active Spray Color Pill when Desktop Right Palette is Collapsed */}
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
                  title={`当前喷涂色 ${activeHex}（点击展开右侧四维调色引擎面板）`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-black text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-xs border border-black/20 shrink-0"
                    style={{ backgroundColor: activeHex }}
                  />
                  <span>{activeHex}</span>
                  <span className="text-[10px] font-sans font-extrabold text-[var(--accent-color)] ml-1">
                    ⇤ 展开色板
                  </span>
                </button>
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

          {/* Row 3: Zoom bar + Status */}
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
              <button
                type="button"
                onClick={() => {
                  setThumbOffsetMode((v) => {
                    const next = !v;
                    setStatusMessage(
                      next
                        ? "已开启「拇指前准星+放大镜」：触屏点按位置在拇指前方，彻底避开手指遮挡盲区"
                        : "已切换为手指中心直接点按模式"
                    );
                    return next;
                  });
                }}
                title="手机竖屏触控防遮挡：开启后准星位于拇指前方并联动放大镜，避免手指挡住细小零件"
                className={`lg:hidden h-7 px-2 text-[11px] font-extrabold cursor-pointer whitespace-nowrap shrink-0 transition ${
                  thumbOffsetMode ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                {thumbOffsetMode ? "⊕ 拇指准星:开" : "⊕ 拇指准星:关"}
              </button>
              <span className="ml-1 text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                {statusMessage}
              </span>
            </div>
            <div className="hidden xl:block text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {shadingFullLabel} · 闭合 {gapCloseRadius}px · 色差 {fillTolerance} · 梯度 {localStepThreshold} · {imgSize.w}×{imgSize.h}
            </div>
          </div>

          {/* Row 4 (Mobile < 1024px Only): Bottom Sheet Drawer Triggers */}
          <div className={`lg:hidden shrink-0 bg-white dark:bg-slate-900 px-2 pt-2.5 pb-2 ${dividerTopClass}`} translate="no">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "palette" ? null : "palette"))}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  mobileDrawer === "palette" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-sm border border-black/20 shrink-0"
                  style={{ backgroundColor: activeHex }}
                />
                <span>调色盘</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "params" ? null : "params"))}
                className={`flex items-center justify-center gap-1 px-2 py-2 text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  mobileDrawer === "params" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span>⚙️ 高级设置</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileDrawer((d) => (d === "used" ? null : "used"))}
                className={`relative flex items-center justify-center gap-1 px-2 py-2 text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                  mobileDrawer === "used" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span>📋 已用色卡</span>
                <span
                  className={`absolute -top-2 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-mono font-black leading-none tabular-nums z-10 ${
                    isBlueprint
                      ? "rounded-full border-[1.5px] border-slate-900 dark:border-slate-200 bg-[var(--accent-color)] text-white shadow-[1.5px_1.5px_0px_#0F172A]"
                      : "rounded-full bg-[var(--accent-color)] text-white shadow-sm ring-1.5 ring-white dark:ring-slate-900"
                  }`}
                >
                  {usedPaintsSummary.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP SPLIT RESIZE HANDLE (10px wide, col-resize, double-click resets to 420px) */}
        {!isDesktopPaletteCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="左右拖拽调节画布与右侧调色面板宽度比例（双击恢复默认宽度）"
            title="左右拖动调节画布与调色台比例 · 双击恢复默认宽度 (420px)"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              setIsResizingSplit(true);
            }}
            onPointerMove={(e) => {
              if (!isResizingSplit) return;
              const container = splitContainerRef.current;
              if (!container) return;
              const rect = container.getBoundingClientRect();
              const rawRightW = rect.right - e.clientX - 5;
              const nextW = clampRightPanelWidth(rawRightW);
              setRightPanelWidth(nextW);
            }}
            onPointerUp={(e) => {
              if (!isResizingSplit) return;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              setIsResizingSplit(false);
              try {
                window.localStorage.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(rightPanelWidth));
              } catch {
                /* ignore */
              }
              setStatusMessage(`已调整右侧调色台宽度：${rightPanelWidth}px (双击分割条可恢复默认 420px)`);
            }}
            onPointerCancel={() => setIsResizingSplit(false)}
            onDoubleClick={() => {
              const defW = clampRightPanelWidth(DEFAULT_RIGHT_PANEL_WIDTH);
              setRightPanelWidth(defW);
              try {
                window.localStorage.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(defW));
              } catch {
                /* ignore */
              }
              setStatusMessage("已恢复右侧调色台默认宽度 (420px)");
            }}
            className="hidden lg:flex w-[10px] shrink-0 cursor-col-resize items-center justify-center group select-none touch-none"
          >
            <div
              className={`h-20 w-[5px] flex flex-col items-center justify-center rounded-full transition-all ${
                isResizingSplit
                  ? "bg-[var(--accent-color)] text-white scale-y-110 shadow-sm"
                  : isBlueprint
                  ? "border border-dashed border-slate-400 dark:border-slate-600 bg-slate-200/70 dark:bg-slate-800/70 group-hover:border-solid group-hover:border-slate-900 group-hover:bg-[var(--accent-color)] group-hover:text-white"
                  : "bg-slate-300/70 dark:bg-slate-700/70 group-hover:bg-[var(--accent-color)] group-hover:text-white"
              }`}
            >
              <span className="text-[9px] font-mono font-black leading-none text-slate-600 dark:text-slate-300 group-hover:text-white">
                ⋮
              </span>
            </div>
          </div>
        )}

        {/* RIGHT CONTROL PANEL (Desktop >= 1024px: Resizable 380px~560px with Independent Internal Scroll) */}
        <div
          style={{
            width: `${rightPanelWidth}px`,
            minWidth: `${MIN_RIGHT_PANEL_WIDTH}px`,
            maxWidth: "min(560px, 48vw)",
          }}
          className={`${
            isDesktopPaletteCollapsed ? "hidden" : "hidden lg:flex"
          } ${
            isFullscreen
              ? "h-full min-h-0"
              : "lg:h-[calc(100vh-204px)] lg:min-h-[540px]"
          } shrink-0 min-h-0 flex-col overflow-hidden ${cardSurfaceClass}`}
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

          <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
            {renderPaletteSection()}
            <div className={`pt-2 shrink-0 ${dividerTopClass}`}>{renderAlgorithmSection(false)}</div>
            <div className={`pt-2 shrink-0 ${dividerTopClass}`}>{renderUsedPaintsSection(false)}</div>
          </div>

          {/* Streamlined Right Panel Footer: Beginner 3-Step Guided Bar or Pro Export Bar */}
          <div className={`shrink-0 bg-white/95 dark:bg-slate-900/95 p-2.5 space-y-1.5 ${dividerTopClass}`} translate="no">
            {workflowMode === "beginner" ? (
              <>
                <div className="flex items-center justify-between text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  <span>🌱 新手三步闭环：试色 ➔ 选现成漆/微调 ➔ 出图归档</span>
                  <span className="font-mono">已用 {usedPaintsSummary.length} 色</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={imageToken === 0}
                    onClick={handleExportCompositePng}
                    title="第1步：导出含品牌色号与微调胶囊的讨论海报 PNG，方便发群交流"
                    className={`flex flex-col items-center justify-center py-1.5 px-1.5 text-[10px] font-extrabold transition ${
                      imageToken > 0
                        ? `${secondaryActionBtnClass} cursor-pointer`
                        : "rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <span className="font-mono text-[9px] text-slate-400">STEP 1</span>
                    <span className="truncate">📋 生成讨论卡</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const target = usedPaintsSummary[0]?.hex || activeHex;
                      if (onNavigateToBrandTint) {
                        onNavigateToBrandTint(target);
                      } else {
                        setColoringMode("brand");
                      }
                    }}
                    title="第2步：匹配现成品牌油漆或查看几滴白/黑微调补正方案"
                    className={`flex flex-col items-center justify-center py-1.5 px-1.5 text-[10px] font-extrabold transition cursor-pointer ${secondaryActionBtnClass}`}
                  >
                    <span className="font-mono text-[9px] text-slate-400">STEP 2</span>
                    <span className="truncate">🏷️ 选漆与微调</span>
                  </button>

                  <button
                    type="button"
                    disabled={imageToken === 0 || !onCreatePaintProject}
                    onClick={() => setShowConvertModal(true)}
                    title="第3步：一键生成带悬浮色卡与微调配方的涂装库工程"
                    className={`flex flex-col items-center justify-center py-1.5 px-1.5 text-[10px] font-black transition ${
                      imageToken > 0 && onCreatePaintProject
                        ? `${primaryActionBtnClass} cursor-pointer`
                        : "rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <span className="font-mono text-[9px] opacity-85">STEP 3</span>
                    <span className="truncate">📁 存入涂装库</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
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
                  <span>📥 导出带品牌色卡 PNG</span>
                </button>

                {onCreatePaintProject ? (
                  <button
                    type="button"
                    disabled={imageToken === 0}
                    onClick={() => setShowConvertModal(true)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black transition ${
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
            )}
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
          <div className={`shrink-0 flex items-center justify-between gap-1.5 px-2.5 sm:px-4 py-2.5 ${dividerBottomClass}`}>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileDrawer("palette")}
                className={`px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                  mobileDrawer === "palette" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                🎨 调色盘
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawer("params")}
                className={`px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                  mobileDrawer === "params" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                ⚙️ 高级设置
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawer("used")}
                className={`relative px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                  mobileDrawer === "used" ? primaryActionBtnClass : secondaryActionBtnClass
                }`}
              >
                <span>📋 已用色卡</span>
                <span
                  className={`absolute -top-2 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-mono font-black leading-none tabular-nums z-10 ${
                    isBlueprint
                      ? "rounded-full border-[1.5px] border-slate-900 dark:border-slate-200 bg-[var(--accent-color)] text-white shadow-[1.5px_1.5px_0px_#0F172A]"
                      : "rounded-full bg-[var(--accent-color)] text-white shadow-sm ring-1.5 ring-white dark:ring-slate-900"
                  }`}
                >
                  {usedPaintsSummary.length}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawer(null)}
              className={`px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-xs font-black whitespace-nowrap shrink-0 cursor-pointer ${secondaryActionBtnClass}`}
            >
              ✕ 收起
            </button>
          </div>

          {/* Sheet Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
            {mobileDrawer === "palette" && renderPaletteSection()}
            {mobileDrawer === "params" && renderAlgorithmSection(true)}
            {mobileDrawer === "used" && renderUsedPaintsSection(true)}
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

      {/* Mobile Touch Unified Low-Zoom Crosshair Selector Ring (准星选取器: 手指按住底部边缘移动，环中心准星即为作用点) */}
      <div
        ref={studioLoupeContainerRef}
        className="pointer-events-none fixed top-0 left-0 z-[106] flex flex-col items-center transition-opacity duration-75"
        style={{
          opacity: 0,
          transform: "translate3d(-9999px, -9999px, 0)",
          willChange: "transform, opacity",
        }}
      >
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-slate-950/92 px-2 py-0.5 font-mono text-[9px] font-bold text-white shadow-md border border-white/25 whitespace-nowrap">
          <span
            className="inline-block h-2 w-2 rounded-full border border-white/75 shrink-0"
            style={{ backgroundColor: activeHex }}
          />
          <span>⊕ 准星选取器</span>
        </div>
        <div className="relative flex items-center justify-center h-[92px] w-[92px]">
          <canvas
            ref={studioLoupeCanvasRef}
            width={92}
            height={92}
            className="h-[92px] w-[92px] rounded-full border-[2.5px] border-white shadow-[0_4px_18px_rgba(0,0,0,0.45)] ring-2 ring-slate-950/60"
          />
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-amber-400 rounded-full shadow-[0_0_2px_#000]" />
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-amber-400 rounded-full shadow-[0_0_2px_#000]" />
          <span className="absolute -right-1 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-amber-400 rounded-full shadow-[0_0_2px_#000]" />
          {thumbOffsetMode && (
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 text-[9px] font-extrabold shadow-[0_2px_6px_rgba(0,0,0,0.45)] border border-slate-950/40 whitespace-nowrap">
              <span>⠿</span>
              <span>拖边缘移动</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Small presentational helpers
// ============================================================================
const SliderRow: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  compact?: boolean;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step = 1, suffix = "", compact, onChange }) => {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (
    <div translate="no" className="space-y-0.5">
      <div className={`flex justify-between font-bold text-slate-700 dark:text-slate-200 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        <span className="truncate">{label}</span>
        <span className="font-mono shrink-0 ml-1">
          {value.toFixed(decimals)}
          {suffix}
        </span>
      </div>
      {hint && (
        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-snug">
          {hint}
        </div>
      )}
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

const SquareDockButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
  isBlueprint?: boolean;
  dangerHover?: boolean;
}> = ({ active, onClick, icon, label, title, isBlueprint, dangerHover }) => (
  <button
    type="button"
    translate="no"
    onClick={onClick}
    title={title}
    className={`bp-btn ${
      active ? "bp-pill-active" : ""
    } notranslate w-[35px] h-[31px] sm:w-[42px] sm:h-[42px] shrink-0 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
      active
        ? isBlueprint
          ? "rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-400 bg-[var(--accent-color)] text-white shadow-[2px_2px_0px_#0F172A]"
          : "rounded-xl bg-[var(--accent-color)] text-white shadow-md"
        : isBlueprint
        ? `rounded-[6px] border-[1.5px] border-slate-900 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-[2px_2px_0px_#0F172A] ${
            dangerHover
              ? "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
              : "hover:bg-slate-100 dark:hover:bg-slate-700"
          }`
        : `rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 ${
            dangerHover
              ? "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
              : "hover:bg-white dark:hover:bg-slate-700"
          }`
    }`}
  >
    <span className="flex items-center justify-center leading-none scale-90 sm:scale-100">{icon}</span>
    <span className="text-[8px] sm:text-[9px] font-black leading-none tracking-tight">{label}</span>
  </button>
);

export default ColoringSandboxLab;
