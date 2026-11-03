import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CatalogPaint,
  FloatingSwatchNode,
  Language,
  PaintProject,
  PartCanvas,
} from "../types";
import {
  loadBottle,
  loadImage,
  renderAnnotatedCanvas,
  shareExportedImage,
} from "../utils/exportAnnotatedImage";
import { floatingNodesToColors } from "../utils/projectStore";
import { encodeQRPayloadString, parseStepParams } from "../utils/projectSharing";
import { embedPayloadInPngDataUrl, renderQRCodeToDataUrl } from "../utils/qrCode";
import { localizedBrand } from "../utils/paintCatalog";
import { computeBrandTintRecipe } from "../utils/brandTintRecipe";
import { getContrastColor } from "../utils/colorUtils";
import { cleanPaintCardName, SwatchSettings } from "../utils/swatchLayout";
import {
  isValidImageSrc,
  reconstructCompositeFromSession,
  resolvePartImageSrc,
} from "../utils/studioSession";
import { ProjectAnnotatedCanvas } from "./ProjectAnnotatedCanvas";
import HoloCard, {
  HOLO_FOIL_COLORS,
  HOLO_PRESETS,
  HoloPreset,
  createHoloFoilAnimator,
  renderHoloFoilOnCanvas,
} from "./HoloCard";
import {
  XIcon,
  DownloadSimpleIcon,
  ShareNetworkIcon,
  QrCodeIcon,
  CopyIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  SlidersHorizontalIcon,
  ArrowsOutSimpleIcon,
  ArrowsInSimpleIcon,
  FilmStripIcon,
  SparkleIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";

export type PosterThemeMode = "light" | "dark";
export type PosterStylePreset = "wireframe" | "holo";
export type PosterQualityMode = "1x" | "2x" | "4x";
export type PosterLayoutPosition = "bottom" | "left" | "right";
export type PosterCornerStyle = "rounded" | "chamfer";

/**
 * 标准化导出风格可调控件声明（供新增导出风格 Skill 统一注册右侧面板开关）
 */
export interface PosterStyleControlDef {
  key: string;
  label: string;
  type: "segmented" | "slider" | "toggle";
  hint?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface PosterStyleConfig {
  id: PosterStylePreset;
  name: string;
  badge: string;
  desc: string;
  supportsVideoExport?: boolean;
  controls: PosterStyleControlDef[];
}

/**
 * 导出卡片风格注册表：
 * 遵循 `.agent/skills/export-card-style/SKILL.md` 规范，在此追加新风格即可自动生成左侧 Tab 与右侧调控开关
 */
export const POSTER_STYLE_PRESETS: PosterStyleConfig[] = [
  {
    id: "wireframe",
    name: "WIREFRAME",
    badge: "WIREFRAME",
    desc: "线框蓝图 · 硬边阴影",
    supportsVideoExport: true,
    controls: [
      {
        key: "cornerStyle",
        label: "卡片边角样式",
        type: "segmented",
        options: [
          { value: "rounded", label: "圆角" },
          { value: "chamfer", label: "倒角" },
        ],
      },
      {
        key: "cornerRadius",
        label: "边角弧度 / 倒角大小",
        type: "slider",
        min: 0,
        max: 28,
        step: 1,
        unit: "px",
      },
      {
        key: "shadowFollowsPaintColor",
        label: "阴影跟随色卡漆色",
        hint: "开启后卡片硬朗投影匹配对应油漆色值",
        type: "toggle",
      },
      {
        key: "enableEffectAnimation",
        label: "动态流光扫描特效",
        hint: "开启卡片表面流光巡检动画，支持导出短视频",
        type: "toggle",
      },
    ],
  },
  {
    id: "holo",
    name: "HOLO FOIL",
    badge: "HOLO FOIL",
    desc: "全息镭射 · 3D 闪卡",
    supportsVideoExport: true,
    controls: [
      {
        key: "holoPreset",
        label: "覆膜纹理预设",
        type: "segmented",
      },
      {
        key: "holoIntensity",
        label: "全息覆膜强度",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.05,
        unit: "%",
      },
      {
        key: "holoScale",
        label: "纹理颗粒密度",
        type: "slider",
        min: 0.5,
        max: 2.5,
        step: 0.1,
        unit: "x",
      },
      {
        key: "holoEdgeSparkle",
        label: "银边闪粉亮度",
        type: "slider",
        min: 0,
        max: 1,
        step: 0.05,
        unit: "%",
      },
      {
        key: "holoTiltMax",
        label: "3D 旋转最大角度",
        type: "slider",
        min: 0,
        max: 25,
        step: 1,
        unit: "°",
      },
      {
        key: "holoIdle",
        label: "未悬停自动呼吸",
        hint: "无鼠标悬停时自动微幅摆动展示覆膜折光",
        type: "toggle",
      },
    ],
  },
];

const QUALITY_OPTIONS: Array<{ id: PosterQualityMode; label: string; sub: string; u: number }> = [
  { id: "1x", label: "标准 1x", sub: "1080w", u: 1 },
  { id: "2x", label: "高清 2x", sub: "2160w", u: 2 },
  { id: "4x", label: "超清 4x", sub: "印刷级", u: 4 },
];

/** iOS Safari canvas area hard limit (~16.7MP) */
const MAX_CANVAS_AREA = 16_000_000;

interface ProjectSharePosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PaintProject;
  part: PartCanvas;
  catalogPaints: CatalogPaint[];
  swatchSettings: SwatchSettings;
  onUpdateSwatchSettings?: React.Dispatch<React.SetStateAction<SwatchSettings>>;
  onOpenSwatchEditor?: () => void;
  lang: Language;
}

const inferStepCategoryMeta = (actionText: string) => {
  if (/Citadel|Recess|Chunky|Fine Edge|Dot Highlight|Stippl|Glaze|Contrast|Slapchop|NMM|手涂|层涂|点拍|刀锋/.test(actionText)) {
    return { label: "战锤手涂", color: "#0284C7" };
  }
  if (/水补土|补土|底漆|打底|灰补|黑补|白补|洗件|打磨|天顶|Zenithal/.test(actionText)) {
    return { label: "底漆打底", color: "#64748B" };
  }
  if (/阴影|高光|MAX|预置|渍洗|旧化|滤镜|掉漆|Grimdark|OSL|荧光/.test(actionText)) {
    return { label: "光影层次", color: "#F59E0B" };
  }
  if (/保护漆|消光|光油|半光|封层|水研|抛光/.test(actionText)) {
    return { label: "封层保护", color: "#10B981" };
  }
  if (/水贴|渗线|刻线|蚀刻片|细节|点缀|遮盖/.test(actionText)) {
    return { label: "分色细节", color: "#8B5CF6" };
  }
  return { label: "主色面漆", color: "#EF5350" };
};

function shiftHexL(hex: string, deltaL: number): string {
  const clean = hex.replace("#", "").trim();
  const num = parseInt(
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean,
    16
  );
  if (Number.isNaN(num)) return hex;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  l = Math.max(0.05, Math.min(0.96, l + deltaL / 100));
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  let nr = l;
  let ng = l;
  let nb = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    nr = hue2rgb(p, q, h + 1 / 3);
    ng = hue2rgb(p, q, h);
    nb = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`.toUpperCase();
}

/**
 * Draws a card path with either rounded corners (`rounded`) or 45° beveled corners (`chamfer`)
 */
export const drawCardShape = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  sizePx: number,
  cornerStyle: PosterCornerStyle
) => {
  const clamped = Math.max(0, Math.min(sizePx, Math.floor(Math.min(w, h) * 0.42)));
  ctx.beginPath();
  if (clamped <= 0.5) {
    ctx.rect(x, y, w, h);
    ctx.closePath();
    return;
  }
  if (cornerStyle === "chamfer") {
    ctx.moveTo(x + clamped, y);
    ctx.lineTo(x + w - clamped, y);
    ctx.lineTo(x + w, y + clamped);
    ctx.lineTo(x + w, y + h - clamped);
    ctx.lineTo(x + w - clamped, y + h);
    ctx.lineTo(x + clamped, y + h);
    ctx.lineTo(x, y + h - clamped);
    ctx.lineTo(x, y + clamped);
    ctx.closePath();
  } else {
    ctx.roundRect(x, y, w, h, clamped);
  }
};

const drawArrowHead = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineW: number,
  headSize: number
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x2 - Math.cos(angle) * headSize * 0.7,
    y2 - Math.sin(angle) * headSize * 0.7
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle - Math.PI / 6),
    y2 - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headSize * Math.cos(angle + Math.PI / 6),
    y2 - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/**
 * Standardized Blueprint-compatible Toggle Button Row.
 * Uses `.bp-btn` / `.bp-subcard` so pressing any row triggers the signature tactile shadow-collapse animation.
 */
const ToggleRow: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  sub?: boolean;
}> = ({ label, hint, checked, onChange, sub }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`bp-btn gk-btn-secondary w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-left transition cursor-pointer ${
      sub
        ? "ml-2.5 w-[calc(100%-0.625rem)] bg-slate-50/80 dark:bg-slate-800/50"
        : "bg-white dark:bg-slate-800/90"
    }`}
    aria-pressed={checked}
  >
    <span className="min-w-0">
      <span
        className={`block font-bold text-slate-800 dark:text-slate-100 ${
          sub ? "text-[11px]" : "text-xs"
        }`}
      >
        {label}
      </span>
      {hint && (
        <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-400 truncate">
          {hint}
        </span>
      )}
    </span>
    <span
      className={`gk-switch-track bp-badge relative h-5 w-9 shrink-0 rounded-full border border-slate-900 dark:border-slate-500 transition-colors ${
        checked
          ? "gk-switch-track-on bg-[var(--accent-color)]"
          : "gk-switch-track-off bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`gk-switch-thumb bp-dot absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white border border-slate-900 transition-transform ${
          checked ? "gk-switch-thumb-on translate-x-4" : "gk-switch-thumb-off translate-x-0"
        }`}
      />
    </span>
  </button>
);

export const ProjectSharePosterModal: React.FC<ProjectSharePosterModalProps> = ({
  isOpen,
  onClose,
  project,
  part,
  catalogPaints,
  swatchSettings,
  onUpdateSwatchSettings,
  onOpenSwatchEditor,
  lang,
}) => {
  const [posterDataUrl, setPosterDataUrl] = useState<string>("");
  const [posterDimensions, setPosterDimensions] = useState<{ w: number; h: number }>({
    w: 2160,
    h: 2880,
  });
  const [posterArtCropRect, setPosterArtCropRect] = useState<[number, number, number, number]>([
    0, 0, 1, 0.5,
  ]);
  const [effectiveArtSrc, setEffectiveArtSrc] = useState<string>(() => resolvePartImageSrc(part));
  const partColors = useMemo(
    () => (part ? floatingNodesToColors(part.nodes, catalogPaints) : []),
    [part, catalogPaints]
  );
  const [qrPayloadStr, setQrPayloadStr] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [wasAreaClamped, setWasAreaClamped] = useState<boolean>(false);

  // Poster editor states
  const [posterTheme, setPosterTheme] = useState<PosterThemeMode>("light");
  const [stylePreset, setStylePreset] = useState<PosterStylePreset>("wireframe");
  const [posterLayout, setPosterLayout] = useState<PosterLayoutPosition>("bottom");
  const [qualityMode, setQualityMode] = useState<PosterQualityMode>("2x");

  // Wireframe style specific customizable parameters
  const [cornerStyle, setCornerStyle] = useState<PosterCornerStyle>("rounded");
  const [cornerRadius, setCornerRadius] = useState<number>(14);
  const [shadowFollowsPaintColor, setShadowFollowsPaintColor] = useState<boolean>(false);
  const [enableEffectAnimation, setEnableEffectAnimation] = useState<boolean>(false);

  // Holo Foil style specific customizable parameters
  const [holoPreset, setHoloPreset] = useState<HoloPreset>("bursts");
  const [holoFoilColor, setHoloFoilColor] = useState<string>("#E2E6EC");
  const [holoIntensity, setHoloIntensity] = useState<number>(0.78);
  const [holoScale, setHoloScale] = useState<number>(1.0);
  const [holoEdgeSparkle, setHoloEdgeSparkle] = useState<number>(0.85);
  const [holoFrame, setHoloFrame] = useState<number>(2.5);
  const [holoGlare, setHoloGlare] = useState<number>(0.48);
  const [holoTiltMax, setHoloTiltMax] = useState<number>(14);
  const [holoIdle, setHoloIdle] = useState<boolean>(true);

  // Measure center preview stage so <HoloCard /> follows the exact exported poster aspect ratio
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const [previewStageSize, setPreviewStageSize] = useState<{ w: number; h: number }>({
    w: 640,
    h: 640,
  });

  useEffect(() => {
    const el = previewStageRef.current;
    if (!el || !isOpen) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setPreviewStageSize({
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  // Content visibility switches
  const [showPaintsSection, setShowPaintsSection] = useState<boolean>(true);
  const [showPaintThumbs, setShowPaintThumbs] = useState<boolean>(false);
  const [showStepsFlowchart, setShowStepsFlowchart] = useState<boolean>(true);
  const [showQrCard, setShowQrCard] = useState<boolean>(true);
  const [showPromoQr, setShowPromoQr] = useState<boolean>(true);
  const [renderRetryCount, setRenderRetryCount] = useState<number>(0);

  // Interactive Live Preview pan & zoom state
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isPanningPreview, setIsPanningPreview] = useState<boolean>(false);
  const previewTransformRef = useRef<{
    scale: number;
    pan: { x: number; y: number };
  }>({ scale: 1, pan: { x: 0, y: 0 } });
  previewTransformRef.current = { scale: previewScale, pan: previewPan };

  const panDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number | null;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    pointerId: null,
  });

  const resetPreviewViewport = () => {
    setPreviewScale(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  const zoomPreviewTo = (
    targetScaleRaw: number,
    focalOffset?: { dx: number; dy: number }
  ) => {
    const prevScale = previewTransformRef.current.scale;
    const prevPan = previewTransformRef.current.pan;
    const nextScale =
      Math.round(Math.max(0.5, Math.min(4.0, targetScaleRaw)) * 100) / 100;
    if (Math.abs(nextScale - prevScale) < 0.005) return;
    if (Math.abs(nextScale - 1) < 0.02 && !focalOffset) {
      setPreviewScale(1);
      setPreviewPan({ x: 0, y: 0 });
      return;
    }
    if (focalOffset) {
      const ratio = nextScale / prevScale;
      const nextX = Math.round(
        focalOffset.dx - (focalOffset.dx - prevPan.x) * ratio
      );
      const nextY = Math.round(
        focalOffset.dy - (focalOffset.dy - prevPan.y) * ratio
      );
      setPreviewPan({ x: nextX, y: nextY });
    }
    setPreviewScale(nextScale);
  };

  useEffect(() => {
    const el = previewStageRef.current;
    if (!el || !isOpen) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const curScale = previewTransformRef.current.scale;
      const deltaFactor = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.0018;
      const nextScale = curScale * Math.exp(deltaFactor);
      zoomPreviewTo(nextScale, { dx, dy });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isOpen]);

  // Hold the latest rendered static base canvas so animated video export can composite over it at 30fps
  const latestBaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestCardRectsRef = useRef<
    Array<{ x: number; y: number; w: number; h: number; radius: number; accentHex: string }>
  >([]);
  const latestQrBoxesRef = useRef<
    Array<{ x: number; y: number; w: number; h: number }>
  >([]);

  const updateCardScale = (val: number) => {
    onUpdateSwatchSettings?.((prev) => ({ ...prev, cardScale: val }));
  };

  useEffect(() => {
    if (!isOpen || !part) return;
    let cancelled = false;

    const buildPoster = async () => {
      setIsGenerating(true);
      try {
        // Resolve valid source image (auto-recovering from studioSession if part.sourceImageDataUrl was corrupted)
        let effectiveSrc = resolvePartImageSrc(part);
        if (
          !isValidImageSrc(part.sourceImageDataUrl) &&
          part.studioSession
        ) {
          const reconstructed = await reconstructCompositeFromSession(part.studioSession);
          if (reconstructed) effectiveSrc = reconstructed;
        }
        if (!cancelled && effectiveSrc) {
          setEffectiveArtSrc(effectiveSrc);
        }
        const srcImg = effectiveSrc ? await loadImage(effectiveSrc, false) : null;
        const colors = floatingNodesToColors(part.nodes, catalogPaints);
        const markers = colors.map((c) => ({
          id: c.id,
          nx: c.sampleX ?? 0.5,
          ny: c.sampleY ?? 0.5,
          hex: c.hex,
          paint: c.assignedPaint,
          labelNx: c.labelNx,
          labelNy: c.labelNy,
          labelScale: c.labelScale,
          tonalGradient: c.tonalGradient,
        }));
        const srcW = srcImg?.naturalWidth || srcImg?.width || 1600;
        const srcH = srcImg?.naturalHeight || srcImg?.height || 1200;
        const aspect = srcImg && srcW > 0 && srcH > 0 ? srcH / srcW : 0.72;

        const isLight = posterTheme === "light";
        const isHolo = stylePreset === "holo";
        const isGoldHolo = isHolo && holoPreset === "gold";
        const palette = isHolo
          ? isLight
            ? {
                sheetBg: "#EEF2F9",
                gridLine: "rgba(99, 102, 241, 0.065)",
                cardBg: "#FFFFFF",
                cardBgAlt: "#F1F5F9",
                border: isGoldHolo ? "#D97706" : "#6366F1",
                borderSubtle: isGoldHolo ? "#FDE68A" : "#C7D2FE",
                hardShadow: "rgba(15, 23, 42, 0.22)",
                textPrimary: "#0F172A",
                textSecondary: "#334155",
                textMuted: "#64748B",
                accent: isGoldHolo ? "#D97706" : "#6366F1",
                accentSoft: isGoldHolo
                  ? "rgba(217, 119, 6, 0.14)"
                  : "rgba(99, 102, 241, 0.12)",
                directBg: "#ECFDF5",
                directText: "#047857",
                tintBg: "#FEF3C7",
                tintText: "#B45309",
                chipBg: "#EEF2FF",
                chipText: "#312E81",
                connector: isGoldHolo ? "#F59E0B" : "#818CF8",
                artBg: "#090D16",
              }
            : {
                sheetBg: "#070B14",
                gridLine: "rgba(129, 140, 248, 0.08)",
                cardBg: "#0F172A",
                cardBgAlt: "#1E1B4B",
                border: isGoldHolo ? "#FBBF24" : "#818CF8",
                borderSubtle: isGoldHolo ? "#78350F" : "#312E81",
                hardShadow: "rgba(2, 6, 23, 0.65)",
                textPrimary: "#F8FAFC",
                textSecondary: "#E2E8F0",
                textMuted: "#94A3B8",
                accent: isGoldHolo ? "#FBBF24" : "#38BDF8",
                accentSoft: isGoldHolo
                  ? "rgba(251, 191, 36, 0.18)"
                  : "rgba(56, 189, 248, 0.18)",
                directBg: "rgba(16, 185, 129, 0.18)",
                directText: "#34D399",
                tintBg: "rgba(245, 158, 11, 0.18)",
                tintText: "#FBBF24",
                chipBg: "rgba(30, 41, 59, 0.9)",
                chipText: "#E0E7FF",
                connector: isGoldHolo ? "#FBBF24" : "#38BDF8",
                artBg: "#030712",
              }
          : isLight
          ? {
              sheetBg: "#F4F6FA",
              gridLine: "rgba(15, 23, 42, 0.045)",
              cardBg: "#FFFFFF",
              cardBgAlt: "#F8FAFC",
              border: "#0F172A",
              borderSubtle: "#CBD5E1",
              hardShadow: "#0F172A",
              textPrimary: "#0F172A",
              textSecondary: "#334155",
              textMuted: "#64748B",
              accent: "#EF5350",
              accentSoft: "rgba(239, 83, 80, 0.12)",
              directBg: "#ECFDF5",
              directText: "#047857",
              tintBg: "#FFFBEB",
              tintText: "#B45309",
              chipBg: "#F1F5F9",
              chipText: "#334155",
              connector: "#94A3B8",
              artBg: "#0F172A",
            }
          : {
              sheetBg: "#0B0F19",
              gridLine: "rgba(148, 163, 184, 0.055)",
              cardBg: "#111827",
              cardBgAlt: "#1E293B",
              border: "#64748B",
              borderSubtle: "#334155",
              hardShadow: "#020617",
              textPrimary: "#F8FAFC",
              textSecondary: "#CBD5E1",
              textMuted: "#94A3B8",
              accent: "#EF5350",
              accentSoft: "rgba(239, 83, 80, 0.18)",
              directBg: "rgba(16, 185, 129, 0.16)",
              directText: "#34D399",
              tintBg: "rgba(245, 158, 11, 0.16)",
              tintText: "#FBBF24",
              chipBg: "#1E293B",
              chipText: "#E2E8F0",
              connector: "#64748B",
              artBg: "#020617",
            };

        const hasPaints = showPaintsSection && part.nodes.length > 0;
        const hasSteps = showStepsFlowchart && part.steps.length > 0;
        const hasQr = showQrCard;
        const hasSpec = hasPaints || hasSteps || hasQr;
        const isSide = posterLayout !== "bottom" && hasSpec;

        // ------------------------------------------------------------
        // Layout computation (all values in px at unit scale `u`)
        // ------------------------------------------------------------
        const computeLayout = (u: number) => {
          const r = (v: number) => Math.round(v * u);
          const specPanelW = isSide ? r(900) : Math.round(1080 * u);
          const padX = r(40);
          const padTop = r(40);
          const padBottom = r(40);
          const sectionGap = r(36);
          const headerH = r(30);
          const headerGap = r(16);
          const contentW = specPanelW - padX * 2;

          const paintCols = isSide ? 3 : 4;
          const paintGap = r(18);
          const paintCardW = Math.floor((contentW - paintGap * (paintCols - 1)) / paintCols);
          const paintColorH = r(96);
          const paintCardH = paintColorH + r(96);
          const paintRows = hasPaints ? Math.ceil(part.nodes.length / paintCols) : 0;
          const paintsGridH =
            paintRows * paintCardH + Math.max(0, paintRows - 1) * paintGap;

          const stepCols = isSide ? 3 : 4;
          const stepArrowGap = r(34);
          const stepRowGap = r(44);
          const stepCardW = Math.floor(
            (contentW - stepArrowGap * (stepCols - 1)) / stepCols
          );
          const stepCardH = r(200);
          const stepRows = hasSteps ? Math.ceil(part.steps.length / stepCols) : 0;
          const stepsGridH =
            stepRows * stepCardH + Math.max(0, stepRows - 1) * stepRowGap;

          const qrCardH = r(232);

          const blocks: number[] = [];
          if (hasPaints) blocks.push(headerH + headerGap + paintsGridH);
          if (hasSteps) blocks.push(headerH + headerGap + stepsGridH);
          if (hasQr) blocks.push(qrCardH);
          const specH = hasSpec
            ? padTop +
              padBottom +
              blocks.reduce((a, b) => a + b, 0) +
              sectionGap * Math.max(0, blocks.length - 1)
            : 0;

          let artW = Math.round(1080 * u);
          let artH = Math.max(1, Math.round(artW * aspect));
          if (isSide && specH > artH) {
            const grownW = Math.min(Math.round(artW * 1.6), Math.round(specH / aspect));
            artW = Math.max(artW, grownW);
            artH = Math.max(1, Math.round(artW * aspect));
          }

          const totalW = isSide ? artW + specPanelW : artW;
          const totalH = isSide ? Math.max(artH, specH) : artH + specH;
          return {
            u,
            r,
            specPanelW,
            padX,
            padTop,
            sectionGap,
            headerH,
            headerGap,
            contentW,
            paintCols,
            paintGap,
            paintCardW,
            paintColorH,
            paintCardH,
            paintsGridH,
            stepCols,
            stepArrowGap,
            stepRowGap,
            stepCardW,
            stepCardH,
            stepsGridH,
            qrCardH,
            specH,
            artW,
            artH,
            totalW,
            totalH,
          };
        };

        const baseU = QUALITY_OPTIONS.find((q) => q.id === qualityMode)?.u ?? 2;
        let L = computeLayout(baseU);
        let clamped = false;
        if (L.totalW * L.totalH > MAX_CANVAS_AREA) {
          const factor = Math.sqrt(MAX_CANVAS_AREA / (L.totalW * L.totalH)) * 0.98;
          L = computeLayout(baseU * factor);
          clamped = true;
        }
        const { r } = L;

        // Region placement
        let artX = 0;
        let artY = 0;
        let specX = 0;
        let specY = L.artH;
        if (posterLayout === "right" && isSide) {
          artY = Math.round((L.totalH - L.artH) / 2);
          specX = L.artW;
          specY = 0;
        } else if (posterLayout === "left" && isSide) {
          artX = L.specPanelW;
          artY = Math.round((L.totalH - L.artH) / 2);
          specX = 0;
          specY = 0;
        }
        const specH = isSide ? L.totalH : L.specH;

        const round4 = (v: number) => Math.round(v * 10000) / 10000;
        const cropRect: [number, number, number, number] = [
          round4(artX / L.totalW),
          round4(artY / L.totalH),
          round4(L.artW / L.totalW),
          round4(L.artH / L.totalH),
        ];

        // Annotated artwork + QR payload + images
        const upperCanvas =
          srcImg && srcW > 0 && srcH > 0
            ? await renderAnnotatedCanvas(srcImg, markers, swatchSettings, false, L.artW)
            : null;
        const payloadStr = await encodeQRPayloadString(project.title, part, cropRect);
        if (cancelled) return;
        setQrPayloadStr(payloadStr);

        const logoImg = await loadImage("/app-logo.png", false);
        const promoWebUrl =
          typeof window !== "undefined" &&
          window.location?.origin &&
          !window.location.origin.includes("localhost") &&
          !window.location.origin.includes("127.0.0.1")
            ? window.location.origin
            : "https://gk-mixer.pages.dev";
        const [projectQrImg, promoQrImg] = hasQr
          ? await Promise.all([
              loadImage(
                renderQRCodeToDataUrl(payloadStr, 360, 12, "M", {
                  fgColor: "#0F172A",
                  bgColor: "#FFFFFF",
                }),
                false
              ),
              showPromoQr
                ? loadImage(
                    renderQRCodeToDataUrl(promoWebUrl, 360, 12, "M", {
                      logoImg,
                      fgColor: "#0F172A",
                      bgColor: "#FFFFFF",
                      accentBorderColor: "#EF5350",
                      logoScale: 0.21,
                    }),
                    false
                  )
                : Promise.resolve(null),
            ])
          : [null, null];

        // Resolve catalog paints, thumbnails & recipes for each node
        const findCatalog = (node: FloatingSwatchNode) => {
          const code = (node.paintCode || "").trim().toUpperCase();
          if (!code) return undefined;
          const brand = (node.paintBrand || "").trim();
          return (
            catalogPaints.find(
              (p) =>
                p.code.trim().toUpperCase() === code &&
                (p.brand === brand || localizedBrand(p.brand, "zh") === brand)
            ) || catalogPaints.find((p) => p.code.trim().toUpperCase() === code)
          );
        };
        const paintInfos = await Promise.all(
          part.nodes.map(async (node) => {
            const cat = findCatalog(node);
            const hex = (node.hex || "#64748B").toUpperCase();
            const tonal = node.tonalGradient || [];
            const shadow =
              tonal.find((t) => t.role === "shadow")?.hex || shiftHexL(hex, -16);
            const highlight =
              tonal.find((t) => t.role === "highlight")?.hex || shiftHexL(hex, 16);
            let isFineTuned = Boolean(
              node.basePaintHex && node.basePaintHex.toUpperCase() !== hex
            );
            let recipeText = node.tintBadgeText || "";
            if (!isFineTuned && cat) {
              const rec = computeBrandTintRecipe(hex, cat, lang);
              if (!rec.isDirectMatch) {
                isFineTuned = true;
                recipeText = recipeText || rec.shortFormulaText;
              }
            }
            const thumb =
              hasPaints && showPaintThumbs
                ? await loadBottle({
                    brand: cat?.brand || node.paintBrand,
                    code: cat?.code || node.paintCode,
                  })
                : null;
            return {
              node,
              hex,
              shadow,
              highlight,
              brandLabel:
                localizedBrand(cat?.brand || node.paintBrand || "", lang) || "自定义",
              code: node.paintCode || cat?.code || "",
              name: cleanPaintCardName(
                node.paintName || cat?.name || node.paintCode || hex
              ),
              isFineTuned,
              isCustom: !cat && !node.paintCode,
              recipeText,
              thumb,
            };
          })
        );
        if (cancelled) return;

        // ------------------------------------------------------------
        // Canvas drawing
        // ------------------------------------------------------------
        const canvas = document.createElement("canvas");
        canvas.width = L.totalW;
        canvas.height = L.totalH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.textBaseline = "alphabetic";

        const SANS =
          "ui-sans-serif, system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
        const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

        const fitText = (text: string, maxWidth: number): string => {
          if (maxWidth <= 0) return "";
          if (ctx.measureText(text).width <= maxWidth) return text;
          let str = text;
          while (str.length > 1 && ctx.measureText(str + "…").width > maxWidth) {
            str = str.slice(0, -1);
          }
          return str + "…";
        };

        const wrapText = (text: string, maxWidth: number, maxLines: number): string[] => {
          const chars = Array.from(text);
          const lines: string[] = [];
          let cur = "";
          for (let i = 0; i < chars.length; i++) {
            const next = cur + chars[i];
            if (ctx.measureText(next).width > maxWidth && cur) {
              lines.push(cur);
              cur = chars[i];
              if (lines.length === maxLines - 1) {
                const rest = chars.slice(i).join("");
                lines.push(fitText(rest, maxWidth));
                return lines;
              }
            } else {
              cur = next;
            }
          }
          if (cur) lines.push(cur);
          return lines;
        };

        const fitFontSize = (
          text: string,
          weight: string,
          family: string,
          startPx: number,
          minPx: number,
          maxW: number
        ) => {
          let px = startPx;
          ctx.font = `${weight} ${px}px ${family}`;
          while (px > minPx && ctx.measureText(text).width > maxW) {
            px -= Math.max(1, Math.round(startPx * 0.05));
            ctx.font = `${weight} ${px}px ${family}`;
          }
          return px;
        };

        const recordedCards: Array<{
          x: number;
          y: number;
          w: number;
          h: number;
          radius: number;
          accentHex: string;
        }> = [];
        const recordedQrBoxes: Array<{
          x: number;
          y: number;
          w: number;
          h: number;
        }> = [];

        /**
         * Creates a prismatic holographic foil gradient or 24K gold foil gradient
         */
        const createHoloFoilGrad = (
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          seedHex?: string
        ) => {
          const g = ctx.createLinearGradient(x1, y1, x2, y2);
          if (isGoldHolo) {
            g.addColorStop(0, "#B45309");
            g.addColorStop(0.22, "#FDE047");
            g.addColorStop(0.48, "#F59E0B");
            g.addColorStop(0.75, "#FEF08A");
            g.addColorStop(1, "#D97706");
          } else {
            g.addColorStop(0, seedHex || "#38BDF8");
            g.addColorStop(0.25, "#818CF8");
            g.addColorStop(0.5, "#E879F9");
            g.addColorStop(0.75, "#FACC15");
            g.addColorStop(1, "#2DD4BF");
          }
          return g;
        };

        /**
         * Card renderer supporting both Wireframe brutalist cards and Holo Collector Foil cards
         */
        const drawCard = (
          x: number,
          y: number,
          w: number,
          h: number,
          radiusPx: number,
          assignedPaintHex?: string,
          fill = palette.cardBg
        ) => {
          if (isHolo) {
            // 1. Collector luminous elevation shadow
            ctx.save();
            ctx.shadowColor =
              shadowFollowsPaintColor && assignedPaintHex
                ? `${assignedPaintHex}66`
                : isLight
                ? "rgba(79, 70, 229, 0.16)"
                : "rgba(2, 6, 23, 0.72)";
            ctx.shadowBlur = r(18);
            ctx.shadowOffsetY = r(6);
            drawCardShape(ctx, x, y, w, h, radiusPx, cornerStyle);
            const cardGrad = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
            if (isLight) {
              cardGrad.addColorStop(0, "#FFFFFF");
              cardGrad.addColorStop(0.65, "#F8FAFC");
              cardGrad.addColorStop(1, "#EEF2FF");
            } else {
              cardGrad.addColorStop(0, "#111827");
              cardGrad.addColorStop(0.6, "#0F172A");
              cardGrad.addColorStop(1, "#1E1B4B");
            }
            ctx.fillStyle = cardGrad;
            ctx.fill();
            ctx.restore();

            // 2. Metallic foil double-border (prismatic outer border + inner specular rim)
            ctx.save();
            drawCardShape(ctx, x, y, w, h, radiusPx, cornerStyle);
            ctx.strokeStyle = createHoloFoilGrad(
              x,
              y,
              x + w,
              y + h,
              shadowFollowsPaintColor ? assignedPaintHex : undefined
            );
            ctx.lineWidth = r(2.4);
            ctx.stroke();

            const inset = r(2.2);
            drawCardShape(
              ctx,
              x + inset,
              y + inset,
              w - inset * 2,
              h - inset * 2,
              Math.max(0, radiusPx - inset),
              cornerStyle
            );
            ctx.strokeStyle = isLight
              ? "rgba(255, 255, 255, 0.85)"
              : "rgba(255, 255, 255, 0.18)";
            ctx.lineWidth = Math.max(1, r(1));
            ctx.stroke();
            ctx.restore();
          } else {
            const off = r(4.5);
            const effectiveShadowColor =
              shadowFollowsPaintColor && assignedPaintHex
                ? assignedPaintHex
                : palette.hardShadow;

            // 1. Offset hard shadow
            ctx.save();
            drawCardShape(ctx, x + off, y + off, w, h, radiusPx, cornerStyle);
            ctx.fillStyle = effectiveShadowColor;
            ctx.fill();
            if (shadowFollowsPaintColor && assignedPaintHex) {
              ctx.strokeStyle = palette.border;
              ctx.lineWidth = r(1.5);
              ctx.stroke();
            }
            ctx.restore();

            // 2. Main card surface & wireframe border
            ctx.save();
            drawCardShape(ctx, x, y, w, h, radiusPx, cornerStyle);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.strokeStyle = palette.border;
            ctx.lineWidth = r(2);
            ctx.stroke();
            ctx.restore();
          }

          recordedCards.push({
            x,
            y,
            w,
            h,
            radius: radiusPx,
            accentHex: assignedPaintHex || palette.accent,
          });
        };

        const drawChip = (
          x: number,
          y: number,
          text: string,
          h: number,
          bg: string,
          fg: string,
          font: string,
          maxW: number
        ) => {
          ctx.font = font;
          const t = fitText(text, maxW - r(14));
          const w = Math.min(maxW, Math.ceil(ctx.measureText(t).width + r(14)));
          const chipCorner = Math.min(r(cornerRadius * 0.45), Math.round(h / 2.4));
          ctx.save();
          drawCardShape(ctx, x, y, w, h, chipCorner, cornerStyle);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.strokeStyle = isHolo
            ? createHoloFoilGrad(x, y, x + w, y + h)
            : palette.borderSubtle;
          ctx.lineWidth = Math.max(1, r(isHolo ? 1.25 : 1));
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = fg;
          ctx.textBaseline = "middle";
          ctx.fillText(t, x + r(7), y + h / 2 + r(0.5));
          ctx.textBaseline = "alphabetic";
          return w;
        };

        const drawSectionHeader = (
          x: number,
          y: number,
          index: number,
          title: string,
          subtitle: string,
          maxW: number
        ) => {
          const badgeH = L.headerH;
          ctx.font = `900 ${r(13)}px ${MONO}`;
          const idxText = isHolo
            ? `✦ ${String(index).padStart(2, "0")}`
            : String(index).padStart(2, "0");
          const badgeW = Math.ceil(ctx.measureText(idxText).width + r(18));
          const badgeCorner = Math.min(r(cornerRadius * 0.5), r(8));

          ctx.save();
          if (isHolo) {
            drawCardShape(ctx, x, y, badgeW, badgeH, badgeCorner, cornerStyle);
            ctx.fillStyle = createHoloFoilGrad(x, y, x + badgeW, y + badgeH);
            ctx.fill();
            ctx.strokeStyle = isLight ? "#FFFFFF" : "rgba(255,255,255,0.45)";
            ctx.lineWidth = r(1.5);
            ctx.stroke();
          } else {
            drawCardShape(
              ctx,
              x + r(2),
              y + r(2),
              badgeW,
              badgeH,
              badgeCorner,
              cornerStyle
            );
            ctx.fillStyle = palette.hardShadow;
            ctx.fill();
            drawCardShape(ctx, x, y, badgeW, badgeH, badgeCorner, cornerStyle);
            ctx.fillStyle = palette.accent;
            ctx.fill();
            ctx.strokeStyle = palette.border;
            ctx.lineWidth = r(1.5);
            ctx.stroke();
          }
          ctx.restore();

          ctx.fillStyle = isGoldHolo ? "#0F172A" : "#FFFFFF";
          ctx.textBaseline = "middle";
          ctx.fillText(idxText, x + r(9), y + badgeH / 2 + r(1));

          ctx.fillStyle = palette.textPrimary;
          ctx.font = `900 ${r(20)}px ${SANS}`;
          const titleX = x + badgeW + r(12);
          ctx.fillText(title, titleX, y + badgeH / 2 + r(1));
          const titleW = ctx.measureText(title).width;

          ctx.fillStyle = palette.textMuted;
          ctx.font = `700 ${r(12)}px ${MONO}`;
          const subX = titleX + titleW + r(14);
          const fittedSub = fitText(subtitle, x + maxW - subX);
          ctx.fillText(fittedSub, subX, y + badgeH / 2 + r(1));

          if (isHolo) {
            const lineStartX = subX + ctx.measureText(fittedSub).width + r(16);
            if (lineStartX < x + maxW - r(24)) {
              ctx.save();
              ctx.strokeStyle = createHoloFoilGrad(
                lineStartX,
                y + badgeH / 2,
                x + maxW,
                y + badgeH / 2
              );
              ctx.lineWidth = r(1.5);
              ctx.globalAlpha = 0.55;
              ctx.beginPath();
              ctx.moveTo(lineStartX, y + badgeH / 2);
              ctx.lineTo(x + maxW, y + badgeH / 2);
              ctx.stroke();
              ctx.restore();
            }
          }
          ctx.textBaseline = "alphabetic";
        };

        // A. Artwork region
        if (isSide) {
          ctx.fillStyle = palette.artBg;
          ctx.fillRect(artX, 0, L.artW, L.totalH);
        }
        if (upperCanvas) {
          ctx.drawImage(upperCanvas, artX, artY, L.artW, L.artH);
        } else {
          ctx.fillStyle = palette.artBg;
          ctx.fillRect(artX, artY, L.artW, L.artH);
        }

        const effectiveCornerPx = r(cornerRadius);

        if (hasSpec) {
          // B. Spec sheet background with blueprint engineering grid or Holo Collector Foil backdrop
          if (isHolo) {
            const bgGrad = ctx.createLinearGradient(
              specX,
              specY,
              specX + L.specPanelW,
              specY + specH
            );
            if (isLight) {
              bgGrad.addColorStop(0, "#EEF2F9");
              bgGrad.addColorStop(0.5, "#F8FAFC");
              bgGrad.addColorStop(1, "#EDE9FE");
            } else {
              bgGrad.addColorStop(0, "#050811");
              bgGrad.addColorStop(0.5, "#0B1120");
              bgGrad.addColorStop(1, "#13112C");
            }
            ctx.fillStyle = bgGrad;
            ctx.fillRect(specX, specY, L.specPanelW, specH);

            // Subtle 45° diamond holographic micro-lattice
            const step = r(32);
            ctx.save();
            ctx.beginPath();
            ctx.rect(specX, specY, L.specPanelW, specH);
            ctx.clip();
            ctx.strokeStyle = palette.gridLine;
            ctx.lineWidth = Math.max(1, r(1));
            for (
              let d = -specH;
              d <= L.specPanelW + specH;
              d += step
            ) {
              ctx.beginPath();
              ctx.moveTo(specX + d, specY);
              ctx.lineTo(specX + d - specH, specY + specH);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(specX + d, specY);
              ctx.lineTo(specX + d + specH, specY + specH);
              ctx.stroke();
            }
            ctx.restore();
          } else {
            ctx.fillStyle = palette.sheetBg;
            ctx.fillRect(specX, specY, L.specPanelW, specH);
            const step = r(24);
            ctx.save();
            ctx.strokeStyle = palette.gridLine;
            ctx.lineWidth = Math.max(1, r(1));
            for (let gx = specX; gx <= specX + L.specPanelW; gx += step) {
              ctx.beginPath();
              ctx.moveTo(gx, specY);
              ctx.lineTo(gx, specY + specH);
              ctx.stroke();
            }
            for (let gy = specY; gy <= specY + specH; gy += step) {
              ctx.beginPath();
              ctx.moveTo(specX, gy);
              ctx.lineTo(specX + L.specPanelW, gy);
              ctx.stroke();
            }
            ctx.restore();
          }

          const cx = specX + L.padX;
          let curY = specY + L.padTop;
          if (isSide && specH > L.specH) {
            curY += Math.round((specH - L.specH) / 2);
          }
          let sectionIdx = 0;

          // C. 使用的油漆 (tonal swatch grid)
          if (hasPaints) {
            sectionIdx += 1;
            drawSectionHeader(
              cx,
              curY,
              sectionIdx,
              "使用的油漆",
              isHolo
                ? `HOLO SWATCHES · ${part.nodes.length} 款收藏级色卡`
                : `PAINTS · ${part.nodes.length} 款`,
              L.contentW
            );
            const gridY = curY + L.headerH + L.headerGap;
            paintInfos.forEach((info, idx) => {
              const col = idx % L.paintCols;
              const row = Math.floor(idx / L.paintCols);
              const x = cx + col * (L.paintCardW + L.paintGap);
              const y = gridY + row * (L.paintCardH + L.paintGap);
              const w = L.paintCardW;
              const h = L.paintCardH;
              drawCard(x, y, w, h, effectiveCornerPx, info.hex);

              ctx.save();
              drawCardShape(ctx, x, y, w, h, effectiveCornerPx, cornerStyle);
              ctx.clip();

              // Color block (optional bottle thumbnail on the left)
              const thumbW = info.thumb ? L.paintColorH : 0;
              if (info.thumb) {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(x, y, thumbW, L.paintColorH);
                const iw = info.thumb.naturalWidth || info.thumb.width;
                const ih = info.thumb.naturalHeight || info.thumb.height;
                const s = Math.min(
                  (thumbW - r(10)) / iw,
                  (L.paintColorH - r(10)) / ih
                );
                ctx.drawImage(
                  info.thumb,
                  x + (thumbW - iw * s) / 2,
                  y + (L.paintColorH - ih * s) / 2,
                  iw * s,
                  ih * s
                );
                ctx.fillStyle = isHolo
                  ? createHoloFoilGrad(x + thumbW, y, x + thumbW, y + L.paintColorH, info.hex)
                  : palette.border;
                ctx.fillRect(x + thumbW - r(1.5), y, r(1.5), L.paintColorH);
              }
              const blockX = x + thumbW;
              const blockW = w - thumbW;
              const stripH = r(26);
              const mainH = L.paintColorH - stripH;
              ctx.fillStyle = info.hex;
              ctx.fillRect(blockX, y, blockW, mainH);

              if (isHolo || enableEffectAnimation) {
                const sheen = ctx.createLinearGradient(
                  blockX,
                  y,
                  blockX + blockW,
                  y + mainH
                );
                sheen.addColorStop(0, "rgba(255,255,255,0)");
                sheen.addColorStop(0.38, "rgba(255,255,255,0.06)");
                sheen.addColorStop(0.48, "rgba(255,255,255,0.34)");
                sheen.addColorStop(0.58, "rgba(103,232,249,0.16)");
                sheen.addColorStop(1, "rgba(255,255,255,0)");
                ctx.fillStyle = sheen;
                ctx.fillRect(blockX, y, blockW, mainH);
              } else {
                const sheen = ctx.createLinearGradient(0, y, 0, y + mainH);
                sheen.addColorStop(0, "rgba(255,255,255,0.18)");
                sheen.addColorStop(1, "rgba(255,255,255,0)");
                ctx.fillStyle = sheen;
                ctx.fillRect(blockX, y, blockW, mainH);
              }

              // Tonal strip: 暗部 · 主色 · 高光
              const segs = [
                { hex: info.shadow, label: "暗部" },
                { hex: info.hex, label: "主色" },
                { hex: info.highlight, label: "高光" },
              ];
              const segW = blockW / 3;
              segs.forEach((sg, si) => {
                const sx = blockX + si * segW;
                ctx.fillStyle = sg.hex;
                ctx.fillRect(sx, y + mainH, Math.ceil(segW), stripH);
                ctx.fillStyle =
                  getContrastColor(sg.hex) === "#000000"
                    ? "rgba(15,23,42,0.75)"
                    : "rgba(255,255,255,0.9)";
                ctx.font = `800 ${r(11)}px ${SANS}`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                  sg.label,
                  sx + segW / 2,
                  y + mainH + stripH / 2 + r(0.5)
                );
                ctx.textAlign = "left";
                ctx.textBaseline = "alphabetic";
              });

              // Index badge (Collector Foil Rarity Badge in Holo mode)
              const lightSwatch = getContrastColor(info.hex) === "#000000";
              ctx.font = `900 ${r(11)}px ${MONO}`;
              const idxText = isHolo
                ? `✦ #${String(idx + 1).padStart(2, "0")}`
                : `#${idx + 1}`;
              const idxW = Math.ceil(ctx.measureText(idxText).width + r(12));
              ctx.fillStyle = lightSwatch
                ? "rgba(15,23,42,0.2)"
                : "rgba(2,6,23,0.44)";
              drawCardShape(
                ctx,
                blockX + r(8),
                y + r(8),
                idxW,
                r(20),
                Math.min(r(5), effectiveCornerPx * 0.4),
                cornerStyle
              );
              ctx.fill();
              if (isHolo) {
                ctx.strokeStyle = "rgba(255,255,255,0.6)";
                ctx.lineWidth = Math.max(1, r(1));
                ctx.stroke();
              }
              ctx.fillStyle = lightSwatch ? "#0F172A" : "#FFFFFF";
              ctx.textBaseline = "middle";
              ctx.fillText(idxText, blockX + r(14), y + r(18.5));
              // HEX on the color block
              ctx.font = `800 ${r(11)}px ${MONO}`;
              ctx.textAlign = "right";
              ctx.fillText(
                info.hex,
                blockX + blockW - r(10),
                y + mainH - r(12)
              );
              ctx.textAlign = "left";
              ctx.textBaseline = "alphabetic";

              // Divider between color block & text (Prismatic foil strip in Holo mode)
              ctx.fillStyle = isHolo
                ? createHoloFoilGrad(x, y + L.paintColorH, x + w, y + L.paintColorH, info.hex)
                : palette.border;
              ctx.fillRect(x, y + L.paintColorH, w, Math.max(1, r(isHolo ? 2.2 : 1.5)));

              if (isHolo) {
                // Subtle holographic watermark in bottom-right of paint card
                ctx.save();
                ctx.font = `900 ${r(10)}px ${MONO}`;
                ctx.fillStyle = isLight
                  ? "rgba(99, 102, 241, 0.16)"
                  : "rgba(129, 140, 248, 0.22)";
                ctx.textAlign = "right";
                ctx.fillText("◇ HOLO", x + w - r(10), y + h - r(12));
                ctx.restore();
              }

              // Text area
              const tx = x + r(14);
              const tMaxW = w - r(28);
              const line1 = `${info.brandLabel} ${info.code}`.trim();
              const l1Px = fitFontSize(line1, "900", MONO, r(17), r(12), tMaxW);
              ctx.fillStyle = palette.textPrimary;
              ctx.font = `900 ${l1Px}px ${MONO}`;
              ctx.fillText(
                fitText(line1, tMaxW),
                tx,
                y + L.paintColorH + r(28)
              );

              ctx.fillStyle = palette.textSecondary;
              ctx.font = `700 ${r(13.5)}px ${SANS}`;
              ctx.fillText(
                fitText(info.name, tMaxW),
                tx,
                y + L.paintColorH + r(50)
              );

              const badgeText = info.isCustom
                ? isHolo
                  ? "✦ 自定义调色"
                  : "自定义调色"
                : info.isFineTuned
                ? `${isHolo ? "✦ " : ""}微调 ${info.recipeText || "需加白/黑"}`
                : isHolo
                ? "✦ 原漆直喷"
                : "原漆直喷";
              drawChip(
                tx,
                y + L.paintColorH + r(62),
                badgeText,
                r(22),
                info.isFineTuned || info.isCustom
                  ? palette.tintBg
                  : palette.directBg,
                info.isFineTuned || info.isCustom
                  ? palette.tintText
                  : palette.directText,
                `800 ${r(11)}px ${SANS}`,
                tMaxW
              );

              // Re-stroke card border on top of clipped content so corners stay razor sharp
              drawCardShape(ctx, x, y, w, h, effectiveCornerPx, cornerStyle);
              ctx.strokeStyle = isHolo
                ? createHoloFoilGrad(x, y, x + w, y + h, info.hex)
                : palette.border;
              ctx.lineWidth = r(isHolo ? 2.4 : 2);
              ctx.stroke();
              ctx.restore();
            });
            curY = gridY + L.paintsGridH + L.sectionGap;
          }

          // D. 涂装工序 (workflow pipeline cards)
          if (hasSteps) {
            sectionIdx += 1;
            drawSectionHeader(
              cx,
              curY,
              sectionIdx,
              "涂装工序",
              isHolo
                ? `HOLO WORKFLOW · ${part.steps.length} STEPS · 全息收藏级工序卡`
                : `WORKFLOW · ${part.steps.length} STEPS · 按箭头顺序施工`,
              L.contentW
            );
            const gridY = curY + L.headerH + L.headerGap;
            const findStepNode = (actionText: string, paintID?: string) =>
              part.nodes.find((n) => {
                if (!n.paintCode) return false;
                if (
                  paintID &&
                  paintID.toUpperCase().includes(n.paintCode.toUpperCase())
                )
                  return true;
                if (actionText.includes(n.paintCode)) return true;
                const nm = cleanPaintCardName(n.paintName || "");
                return nm.length >= 2 && actionText.includes(nm);
              });

            part.steps.forEach((step, idx) => {
              const col = idx % L.stepCols;
              const row = Math.floor(idx / L.stepCols);
              const x = cx + col * (L.stepCardW + L.stepArrowGap);
              const y = gridY + row * (L.stepCardH + L.stepRowGap);
              const w = L.stepCardW;
              const h = L.stepCardH;
              const meta = inferStepCategoryMeta(step.actionText || "");
              const { ratio, pressure, nozzle, technique } = parseStepParams(
                step.ratioAndPressure,
                step.nozzle
              );
              const linked = findStepNode(step.actionText || "", step.paintID);
              const stepShadowHex = linked?.hex || meta.color;

              drawCard(x, y, w, h, effectiveCornerPx, stepShadowHex);
              ctx.save();
              drawCardShape(ctx, x, y, w, h, effectiveCornerPx, cornerStyle);
              ctx.clip();

              // Header strip: STEP number + category
              const stripH = r(36);
              if (isHolo) {
                const hdrGrad = ctx.createLinearGradient(x, y, x + w, y + stripH);
                hdrGrad.addColorStop(0, shiftHexL(meta.color, 8));
                hdrGrad.addColorStop(0.55, meta.color);
                hdrGrad.addColorStop(1, shiftHexL(meta.color, -14));
                ctx.fillStyle = hdrGrad;
                ctx.fillRect(x, y, w, stripH);

                // Diagonal metallic foil sheen on step header
                const hdrSheen = ctx.createLinearGradient(x, y, x + w * 0.7, y + stripH);
                hdrSheen.addColorStop(0, "rgba(255,255,255,0.28)");
                hdrSheen.addColorStop(0.5, "rgba(255,255,255,0.05)");
                hdrSheen.addColorStop(1, "rgba(255,255,255,0.18)");
                ctx.fillStyle = hdrSheen;
                ctx.fillRect(x, y, w, stripH);

                ctx.fillStyle = createHoloFoilGrad(x, y + stripH, x + w, y + stripH, meta.color);
                ctx.fillRect(x, y + stripH - r(2), w, r(2));
              } else {
                ctx.fillStyle = meta.color;
                ctx.fillRect(x, y, w, stripH);
                ctx.fillStyle = palette.border;
                ctx.fillRect(x, y + stripH - r(1.5), w, r(1.5));
              }

              ctx.fillStyle = "#FFFFFF";
              ctx.font = `900 ${r(13)}px ${MONO}`;
              ctx.textBaseline = "middle";
              const stepLabel = isHolo
                ? `✦ STEP ${String(idx + 1).padStart(2, "0")}`
                : `STEP ${String(idx + 1).padStart(2, "0")}`;
              ctx.fillText(stepLabel, x + r(14), y + stripH / 2 + r(1));
              const stepLabelW = ctx.measureText(stepLabel).width;
              ctx.font = `800 ${r(12)}px ${SANS}`;
              ctx.globalAlpha = 0.92;
              ctx.textAlign = "right";
              ctx.fillText(
                fitText(meta.label, w - stepLabelW - r(40)),
                x + w - r(14),
                y + stripH / 2 + r(1)
              );
              ctx.textAlign = "left";
              ctx.globalAlpha = 1;
              ctx.textBaseline = "alphabetic";

              // Title (up to 2 lines)
              const bx = x + r(14);
              const bMaxW = w - r(28);
              ctx.fillStyle = palette.textPrimary;
              ctx.font = `900 ${r(16)}px ${SANS}`;
              const titleLines = wrapText(
                step.actionText || `工序 #${idx + 1}`,
                bMaxW,
                2
              );
              titleLines.forEach((ln, li) => {
                ctx.fillText(ln, bx, y + stripH + r(28) + li * r(22));
              });

              // Linked paint chip
              const paintRowY = y + stripH + r(66);
              if (linked) {
                const dotS = r(16);
                ctx.save();
                drawCardShape(
                  ctx,
                  bx,
                  paintRowY + r(4),
                  dotS,
                  dotS,
                  Math.min(r(4), effectiveCornerPx * 0.35),
                  cornerStyle
                );
                ctx.fillStyle = linked.hex;
                ctx.fill();
                ctx.strokeStyle = isHolo
                  ? createHoloFoilGrad(bx, paintRowY, bx + dotS, paintRowY + dotS, linked.hex)
                  : palette.border;
                ctx.lineWidth = r(1.4);
                ctx.stroke();
                ctx.restore();

                ctx.fillStyle = palette.textSecondary;
                ctx.font = `800 ${r(12)}px ${MONO}`;
                ctx.textBaseline = "middle";
                ctx.fillText(
                  fitText(
                    `${localizedBrand(linked.paintBrand, lang)} ${linked.paintCode}`,
                    bMaxW - dotS - r(8)
                  ),
                  bx + dotS + r(8),
                  paintRowY + r(12.5)
                );
                ctx.textBaseline = "alphabetic";
              } else if (technique) {
                ctx.fillStyle = palette.textMuted;
                ctx.font = `700 ${r(12)}px ${SANS}`;
                ctx.fillText(fitText(technique, bMaxW), bx, paintRowY + r(16));
              }

              // Parameter chips (wrap, max 2 rows)
              const chips = [
                nozzle ? `口径 ${nozzle}` : "",
                ratio ? `稀释 ${ratio}` : "",
                pressure ? `气压 ${pressure}` : "",
              ].filter(Boolean);
              const chipH = r(24);
              let chipX = bx;
              let chipY = y + stripH + r(100);
              let chipRow = 0;
              const chipFont = `700 ${r(11)}px ${MONO}`;
              ctx.font = chipFont;
              for (const chip of chips) {
                const cw = Math.min(
                  bMaxW,
                  Math.ceil(ctx.measureText(chip).width + r(14))
                );
                if (chipX + cw > bx + bMaxW && chipX > bx) {
                  chipRow += 1;
                  if (chipRow > 1) break;
                  chipX = bx;
                  chipY += chipH + r(6);
                }
                const used = drawChip(
                  chipX,
                  chipY,
                  chip,
                  chipH,
                  palette.chipBg,
                  palette.chipText,
                  chipFont,
                  bMaxW
                );
                chipX += used + r(6);
              }
              if (chips.length === 0) {
                ctx.fillStyle = palette.textMuted;
                ctx.font = `700 ${r(11.5)}px ${SANS}`;
                ctx.fillText("常规施工", bx, chipY + r(16));
              }

              // Re-stroke card border on top of clipped content
              drawCardShape(ctx, x, y, w, h, effectiveCornerPx, cornerStyle);
              ctx.strokeStyle = isHolo
                ? createHoloFoilGrad(x, y, x + w, y + h, stepShadowHex)
                : palette.border;
              ctx.lineWidth = r(isHolo ? 2.4 : 2);
              ctx.stroke();
              ctx.restore();

              // Connectors
              if (idx < part.steps.length - 1) {
                if (col < L.stepCols - 1) {
                  const ay = y + Math.round(h / 2);
                  drawArrowHead(
                    ctx,
                    x + w + r(6),
                    ay,
                    x + w + L.stepArrowGap - r(6),
                    ay,
                    palette.accent,
                    r(2.6),
                    r(10)
                  );
                } else {
                  const startX = x + Math.round(w / 2);
                  const midY = y + h + Math.round(L.stepRowGap / 2);
                  const targetX = cx + Math.round(L.stepCardW / 2);
                  const nextY = y + h + L.stepRowGap;
                  ctx.save();
                  ctx.strokeStyle = palette.connector;
                  ctx.lineWidth = r(2);
                  ctx.setLineDash([r(6), r(5)]);
                  ctx.beginPath();
                  ctx.moveTo(startX, y + h + r(8));
                  ctx.lineTo(startX, midY);
                  ctx.lineTo(targetX, midY);
                  ctx.stroke();
                  ctx.restore();
                  drawArrowHead(
                    ctx,
                    targetX,
                    midY,
                    targetX,
                    nextY - r(6),
                    palette.accent,
                    r(2.4),
                    r(9)
                  );
                }
              }
            });
            curY = gridY + L.stepsGridH + L.sectionGap;
          }

          // E. 二维码数字名片 (project identity + dual QR)
          if (hasQr) {
            const x = cx;
            const y = curY;
            const w = L.contentW;
            const h = L.qrCardH;
            const qrShadowHex = paintInfos[0]?.hex || palette.accent;
            drawCard(x, y, w, h, effectiveCornerPx, qrShadowHex);

            const qrSize = r(156);
            const captionH = r(26);
            const qrY = y + Math.round((h - qrSize - captionH - r(6)) / 2);
            const qrBoxCorner = Math.min(effectiveCornerPx, r(12));
            const drawQrBox = (
              qx: number,
              img: HTMLImageElement | null,
              caption: string,
              accent: boolean
            ) => {
              recordedQrBoxes.push({ x: qx, y: qrY, w: qrSize, h: qrSize });
              ctx.save();
              if (!isHolo) {
                drawCardShape(
                  ctx,
                  qx + r(2.5),
                  qrY + r(2.5),
                  qrSize,
                  qrSize,
                  qrBoxCorner,
                  cornerStyle
                );
                ctx.fillStyle = accent ? palette.accent : palette.hardShadow;
                ctx.fill();
              }
              drawCardShape(
                ctx,
                qx,
                qrY,
                qrSize,
                qrSize,
                qrBoxCorner,
                cornerStyle
              );
              ctx.fillStyle = "#FFFFFF";
              ctx.fill();
              ctx.strokeStyle = isHolo
                ? createHoloFoilGrad(qx, qrY, qx + qrSize, qrY + qrSize)
                : accent
                ? palette.accent
                : palette.border;
              ctx.lineWidth = r(isHolo ? 2.5 : 2);
              ctx.stroke();
              ctx.restore();
              if (img)
                ctx.drawImage(
                  img,
                  qx + r(7),
                  qrY + r(7),
                  qrSize - r(14),
                  qrSize - r(14)
                );
              ctx.fillStyle = accent ? palette.accent : palette.textSecondary;
              ctx.font = `800 ${r(11.5)}px ${SANS}`;
              ctx.textAlign = "center";
              ctx.fillText(
                fitText(caption, qrSize + r(20)),
                qx + qrSize / 2,
                qrY + qrSize + r(22)
              );
              ctx.textAlign = "left";
            };
            const restoreX = x + w - qrSize - r(24);
            drawQrBox(restoreX, projectQrImg, "工程码 · 导入还原", false);
            let leftLimit = restoreX;
            if (showPromoQr) {
              const promoX = restoreX - qrSize - r(24);
              drawQrBox(promoX, promoQrImg, "扫码打开 GKMixer", true);
              leftLimit = promoX;
            }

            // Left: identity block
            const lx = x + r(26);
            const lMaxW = leftLimit - lx - r(24);
            const logoS = r(56);
            if (logoImg) {
              ctx.save();
              drawCardShape(
                ctx,
                lx,
                y + r(26),
                logoS,
                logoS,
                Math.min(effectiveCornerPx, r(12)),
                cornerStyle
              );
              ctx.clip();
              ctx.drawImage(logoImg, lx, y + r(26), logoS, logoS);
              ctx.restore();
            }
            const nameX = lx + logoS + r(14);
            ctx.fillStyle = palette.accent;
            ctx.font = `900 ${r(11.5)}px ${MONO}`;
            ctx.fillText(
              fitText(
                isHolo
                  ? "✦ GKMIXER · 全息收藏级工程闪卡 · HOLO EDITION"
                  : "GKMIXER · 涂装工程数字名片",
                lMaxW - logoS - r(14)
              ),
              nameX,
              y + r(44)
            );
            ctx.fillStyle = palette.textPrimary;
            const titleText = project.title || "涂装方案";
            const titlePx = fitFontSize(
              titleText,
              "900",
              SANS,
              r(24),
              r(16),
              lMaxW - logoS - r(14)
            );
            ctx.font = `900 ${titlePx}px ${SANS}`;
            ctx.fillText(
              fitText(titleText, lMaxW - logoS - r(14)),
              nameX,
              y + r(76)
            );

            const chipY = y + r(100);
            const partW = drawChip(
              lx,
              chipY,
              `部位 · ${part.partName || "默认总成"}`,
              r(26),
              palette.accentSoft,
              palette.accent,
              `800 ${r(12)}px ${SANS}`,
              Math.max(r(80), lMaxW * 0.6)
            );
            drawChip(
              lx + partW + r(8),
              chipY,
              `${part.nodes.length} 色 · ${part.steps.length} 工序`,
              r(26),
              palette.chipBg,
              palette.chipText,
              `700 ${r(12)}px ${MONO}`,
              Math.max(r(60), lMaxW - partW - r(8))
            );

            ctx.fillStyle = palette.textSecondary;
            ctx.font = `700 ${r(12.5)}px ${SANS}`;
            const guide1 =
              "在 GKMixer 网页端 / iOS 端导入本图，即可 1:1 还原色卡与工序";
            const guide2 = showPromoQr
              ? "左侧二维码：手机相机扫码直接打开 GKMixer 在线工作台"
              : "图片已内嵌工程数据，转发后依然可识别";
            wrapText(guide1, lMaxW, 2).forEach((ln, i) =>
              ctx.fillText(ln, lx, y + r(156) + i * r(20))
            );
            ctx.fillStyle = palette.textMuted;
            ctx.font = `600 ${r(11.5)}px ${SANS}`;
            ctx.fillText(fitText(guide2, lMaxW), lx, y + r(204));
          }
        }

        // In Holo mode, draw a collector-grade prismatic outer border around the entire card
        if (isHolo) {
          ctx.save();
          const borderW = r(6);
          ctx.strokeStyle = createHoloFoilGrad(0, 0, L.totalW, L.totalH);
          ctx.lineWidth = borderW;
          ctx.strokeRect(
            borderW / 2,
            borderW / 2,
            L.totalW - borderW,
            L.totalH - borderW
          );
          ctx.restore();
        }

        latestBaseCanvasRef.current = canvas;
        latestCardRectsRef.current = recordedCards;
        latestQrBoxesRef.current = recordedQrBoxes;

        const rawDataUrl = canvas.toDataURL("image/png");
        const withEmbeddedChunk = await embedPayloadInPngDataUrl(
          rawDataUrl,
          payloadStr
        );
        if (!cancelled) {
          setWasAreaClamped(clamped);
          setPosterDimensions({ w: L.totalW, h: L.totalH });
          setPosterArtCropRect(cropRect);
          setPosterDataUrl(withEmbeddedChunk);
        }
      } catch (err) {
        console.error("Failed to generate share poster:", err);
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    };

    buildPoster();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    project,
    part,
    catalogPaints,
    swatchSettings,
    lang,
    posterTheme,
    stylePreset,
    holoPreset,
    posterLayout,
    qualityMode,
    cornerStyle,
    cornerRadius,
    shadowFollowsPaintColor,
    enableEffectAnimation,
    showPaintsSection,
    showPaintThumbs,
    showStepsFlowchart,
    showQrCard,
    showPromoQr,
    renderRetryCount,
  ]);

  if (!isOpen) return null;

  const buildExportablePngDataUrl = async (): Promise<string> => {
    if (!posterDataUrl) return "";
    if (stylePreset === "holo" && latestBaseCanvasRef.current) {
      const baseCanvas = latestBaseCanvasRef.current;
      const laminated = renderHoloFoilOnCanvas(baseCanvas, {
        preset: holoPreset,
        foilColor: holoFoilColor,
        intensity: holoIntensity,
        scale: holoScale,
        edgeSparkle: holoEdgeSparkle,
        frame: holoFrame,
        glare: holoGlare,
        radius: cornerRadius,
        tiltXDeg: 7.5,
        tiltYDeg: -9.5,
        lightX: 0.34,
        lightY: 0.24,
      });
      if (laminated) {
        // Restore crisp QR code interiors so camera scanners always decode 100% reliably
        const lctx = laminated.getContext("2d");
        if (lctx && latestQrBoxesRef.current.length > 0) {
          for (const box of latestQrBoxesRef.current) {
            lctx.drawImage(
              baseCanvas,
              box.x,
              box.y,
              box.w,
              box.h,
              box.x,
              box.y,
              box.w,
              box.h
            );
          }
        }
        const rawPng = laminated.toDataURL("image/png");
        return qrPayloadStr
          ? await embedPayloadInPngDataUrl(rawPng, qrPayloadStr)
          : rawPng;
      }
    }
    return posterDataUrl;
  };

  const handleDownloadPoster = async () => {
    const finalUrl = await buildExportablePngDataUrl();
    if (!finalUrl) return;
    const filename = `GKMixer-${project.title}-${part.partName}-${stylePreset}-${qualityMode}.png`.replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    const link = document.createElement("a");
    link.href = finalUrl;
    link.download = filename;
    link.click();
  };

  /**
   * 导出带 CSS/WebGL2 特效的 4秒 动态短视频 (.webm / .mp4)
   */
  const handleExportAnimatedVideo = async () => {
    const baseCanvas = latestBaseCanvasRef.current;
    if (!baseCanvas || isRecordingVideo) return;
    if (typeof MediaRecorder === "undefined") {
      handleDownloadPoster();
      return;
    }

    setIsRecordingVideo(true);
    try {
      // Limit video frame dimensions to max 1440px on the longest edge for smooth 30fps hardware encoding
      const maxEdge = 1440;
      const scale = Math.min(1, maxEdge / Math.max(baseCanvas.width, baseCanvas.height));
      const vw = Math.max(2, Math.round((baseCanvas.width * scale) / 2) * 2);
      const vh = Math.max(2, Math.round((baseCanvas.height * scale) / 2) * 2);

      const animCanvas = document.createElement("canvas");
      animCanvas.width = vw;
      animCanvas.height = vh;
      const actx = animCanvas.getContext("2d");
      if (!actx) return;

      // Optional WebGL2 holographic foil animator when stylePreset === "holo"
      const holoAnimator =
        stylePreset === "holo" ? createHoloFoilAnimator(baseCanvas, vw, vh) : null;

      const stream = animCanvas.captureStream(30);
      const mimeCandidates = [
        "video/mp4;codecs=avc1",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const chosenMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = chosenMime
        ? new MediaRecorder(stream, {
            mimeType: chosenMime,
            videoBitsPerSecond: 6_500_000,
          })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const donePromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: chosenMime || "video/webm" }));
        };
      });

      recorder.start();
      const durationMs = 3800;
      const startTime = performance.now();
      const cards = latestCardRectsRef.current;

      await new Promise<void>((resolve) => {
        const renderFrame = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / durationMs);

          if (holoAnimator) {
            const angle = progress * Math.PI * 2;
            const tiltXDeg = Math.sin(angle * 2) * (holoTiltMax || 12) * 0.75;
            const tiltYDeg = Math.cos(angle) * (holoTiltMax || 12) * 0.85;
            const lightX = 0.5 + Math.cos(angle) * 0.34;
            const lightY = 0.5 + Math.sin(angle * 2) * 0.26;
            holoAnimator.compositeTo2D(actx, {
              preset: holoPreset,
              foilColor: holoFoilColor,
              intensity: holoIntensity,
              scale: holoScale,
              edgeSparkle: holoEdgeSparkle,
              frame: holoFrame,
              glare: holoGlare,
              radius: cornerRadius,
              tiltXDeg,
              tiltYDeg,
              lightX,
              lightY,
            });
            for (const box of latestQrBoxesRef.current) {
              actx.drawImage(
                baseCanvas,
                box.x,
                box.y,
                box.w,
                box.h,
                box.x * scale,
                box.y * scale,
                box.w * scale,
                box.h * scale
              );
            }
          } else {
            // 2 full sheen sweeps across the clip
            const phase = (progress * 2) % 1;
            actx.clearRect(0, 0, vw, vh);
            actx.drawImage(baseCanvas, 0, 0, vw, vh);

            // Draw animated diagonal holographic sheen & contour pulse over each card
            for (let i = 0; i < cards.length; i++) {
              const c = cards[i];
              const cx = c.x * scale;
              const cy = c.y * scale;
              const cw = c.w * scale;
              const ch = c.h * scale;
              const cr = c.radius * scale;
              const cardPhase = (phase + i * 0.08) % 1;
              const bandCenter = cx - cw * 0.4 + cardPhase * (cw * 1.8);
              const bandHalf = cw * 0.32;

              actx.save();
              drawCardShape(actx, cx, cy, cw, ch, cr, cornerStyle);
              actx.clip();
              const grad = actx.createLinearGradient(
                bandCenter - bandHalf,
                cy,
                bandCenter + bandHalf,
                cy + ch * 0.5
              );
              grad.addColorStop(0, "rgba(255,255,255,0)");
              grad.addColorStop(0.5, "rgba(255,255,255,0.34)");
              grad.addColorStop(1, "rgba(255,255,255,0)");
              actx.fillStyle = grad;
              actx.fillRect(cx, cy, cw, ch);
              actx.restore();
            }
          }

          if (elapsed < durationMs) {
            requestAnimationFrame(renderFrame);
          } else {
            recorder.stop();
            resolve();
          }
        };
        requestAnimationFrame(renderFrame);
      });

      holoAnimator?.dispose();

      const blob = await donePromise;
      const ext = chosenMime.includes("mp4") ? "mp4" : "webm";
      const filename = `GKMixer-${project.title}-${part.partName}-${stylePreset}-anim.${ext}`.replace(
        /[\\/:*?"<>|]/g,
        "_"
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error("Failed to record animated poster video:", err);
    } finally {
      setIsRecordingVideo(false);
    }
  };

  const handleSharePoster = async () => {
    const finalUrl = await buildExportablePngDataUrl();
    if (!finalUrl) return;
    const filename = `GKMixer-${project.title}-${part.partName}.png`.replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    const shared = await shareExportedImage(finalUrl, filename);
    if (!shared) handleDownloadPoster();
  };

  const handleCopyPayload = () => {
    if (!qrPayloadStr) return;
    navigator.clipboard?.writeText(qrPayloadStr);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const sectionTitle =
    "text-[11px] font-black tracking-wide text-slate-600 dark:text-slate-300 uppercase";
  const segItemClass = (active: boolean) =>
    `bp-segmented-item inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-black transition cursor-pointer ${
      active
        ? "bp-segmented-item-active bg-[var(--accent-color)] text-white shadow-xs"
        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
    }`;

  // Calculate responsive HoloCard display width so it fits both width & height of preview stage while matching posterDimensions aspect ratio
  const posterAspect =
    posterDimensions.w > 0 && posterDimensions.h > 0
      ? posterDimensions.w / posterDimensions.h
      : 0.716;
  const holoCardDisplayWidth = (() => {
    const availW = Math.max(240, previewStageSize.w - 44);
    const availH = Math.max(260, previewStageSize.h - 44);
    const fitByHeightW = availH * posterAspect;
    return Math.round(Math.min(availW, fitByHeightW));
  })();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-2 sm:p-4 animate-fadeIn">
      <div className="bp-modal-shell flex flex-col w-full max-w-[1400px] h-[94dvh] max-h-[940px] rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-[6px_6px_0px_#0F172A] overflow-hidden">
        {/* Header */}
        <div className="bp-modal-header flex items-center justify-between gap-3 px-4 py-3 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="bp-badge inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white border border-slate-900 shrink-0">
              <QrCodeIcon className="h-4 w-4" weight="bold" />
            </span>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                导出涂装名片
              </h3>
              <span className="bp-badge rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums">
                {posterDimensions.w} × {posterDimensions.h}px
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenSwatchEditor && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSwatchEditor();
                }}
                className="bp-btn gk-btn-secondary hidden sm:inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-black text-slate-700 dark:text-slate-100 hover:bg-slate-50 transition cursor-pointer"
                title="返回色卡排版工作台调整扩边与色卡位置"
              >
                <SlidersHorizontalIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
                <span>调整色卡排版</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bp-btn gk-btn-secondary inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
              aria-label="关闭窗口"
            >
              <XIcon className="h-4 w-4" weight="bold" />
            </button>
          </div>
        </div>

        {/* Body: Left style tabs | Center preview | Right compact controls */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 p-3 overflow-y-auto lg:overflow-hidden">
          {/* Left: vertical style tabs */}
          <aside className="lg:w-[164px] shrink-0 flex flex-col min-h-0">
            <div className={`${sectionTitle} px-1 pb-1.5`}>导出风格</div>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto no-scrollbar p-1 pr-1.5 pb-2">
              {POSTER_STYLE_PRESETS.map((preset) => {
                const active = stylePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setStylePreset(preset.id)}
                    className={`flex flex-col justify-center rounded-xl px-3 py-2 text-left transition cursor-pointer shrink-0 w-[148px] lg:w-full border-2 ${
                      active
                        ? "bp-extracted-card bp-extracted-card-active border-[var(--accent-color)] bg-[var(--accent-soft)] shadow-[3px_3px_0px_#0F172A]"
                        : "bp-subcard bp-subcard-interactive border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1.5 w-full">
                      <span
                        className={`font-mono text-xs font-black tracking-wide truncate ${
                          active
                            ? "text-[var(--accent-color)]"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {preset.badge}
                      </span>
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 border border-slate-900 ${
                          active
                            ? "bg-[var(--accent-color)]"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      />
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold leading-snug text-slate-500 dark:text-slate-400 truncate">
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Center: live preview */}
          <section className="bp-subcard-lg engineering-viewport-grid flex-1 min-w-0 min-h-[360px] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bp-dashed-header flex items-center justify-between gap-2 px-3 py-2 shrink-0 bg-white/80 dark:bg-slate-900/80">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex-wrap min-w-0">
                <span
                  className={`bp-dot inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                    isGenerating ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
                  }`}
                />
                <span className="shrink-0">{isGenerating ? "正在渲染…" : "实时预览"}</span>
                <span className="hidden sm:inline-block text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  滚轮缩放 · 按住拖拽平移 · 双击放大
                </span>
                {stylePreset === "holo" && (
                  <span className="bp-badge inline-flex items-center gap-1 rounded bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 dark:text-indigo-200">
                    <SparkleIcon className="h-3 w-3" weight="fill" />
                    3D 全息折射
                  </span>
                )}
                {stylePreset !== "holo" && enableEffectAnimation && (
                  <span className="bp-badge inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                    <SparkleIcon className="h-3 w-3" weight="fill" />
                    动态特效已开启
                  </span>
                )}
                {wasAreaClamped && (
                  <span className="bp-badge rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    已按设备画布上限自动限制尺寸
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => zoomPreviewTo(previewScale - 0.25)}
                    disabled={previewScale <= 0.5}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 cursor-pointer"
                    title="缩小预览"
                    aria-label="缩小预览"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={resetPreviewViewport}
                    className="px-2 h-7 font-mono text-[11px] font-black text-slate-700 dark:text-slate-200 hover:text-[var(--accent-color)] tabular-nums cursor-pointer"
                    title="点击复位 100% 视图"
                  >
                    {Math.round(previewScale * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomPreviewTo(previewScale + 0.25)}
                    disabled={previewScale >= 4.0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 cursor-pointer"
                    title="放大预览"
                    aria-label="放大预览"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const isDefaultView =
                      Math.abs(previewScale - 1) < 0.04 &&
                      Math.hypot(previewPan.x, previewPan.y) < 6;
                    if (isDefaultView) {
                      zoomPreviewTo(2.0);
                    } else {
                      resetPreviewViewport();
                    }
                  }}
                  className="bp-btn gk-btn-secondary inline-flex h-7 items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                >
                  {Math.abs(previewScale - 1) < 0.04 &&
                  Math.hypot(previewPan.x, previewPan.y) < 6 ? (
                    <>
                      <ArrowsOutSimpleIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
                      <span>放大查看</span>
                    </>
                  ) : (
                    <>
                      <ArrowsInSimpleIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
                      <span>复位视图</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <div
              ref={previewStageRef}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.pointerType === "mouse") return;
                panDragRef.current = {
                  active: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  originX: previewPan.x,
                  originY: previewPan.y,
                  pointerId: e.pointerId,
                };
                setIsPanningPreview(true);
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {}
              }}
              onPointerMove={(e) => {
                if (!panDragRef.current.active) return;
                const dx = e.clientX - panDragRef.current.startX;
                const dy = e.clientY - panDragRef.current.startY;
                setPreviewPan({
                  x: Math.round(panDragRef.current.originX + dx),
                  y: Math.round(panDragRef.current.originY + dy),
                });
              }}
              onPointerUp={(e) => {
                if (!panDragRef.current.active) return;
                panDragRef.current.active = false;
                setIsPanningPreview(false);
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
              }}
              onPointerCancel={(e) => {
                if (!panDragRef.current.active) return;
                panDragRef.current.active = false;
                setIsPanningPreview(false);
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
              }}
              onDoubleClick={(e) => {
                const isDefaultView =
                  Math.abs(previewScale - 1) < 0.04 &&
                  Math.hypot(previewPan.x, previewPan.y) < 6;
                if (!isDefaultView) {
                  resetPreviewViewport();
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dx = e.clientX - (rect.left + rect.width / 2);
                  const dy = e.clientY - (rect.top + rect.height / 2);
                  zoomPreviewTo(2.0, { dx, dy });
                }
              }}
              className={`relative flex-1 min-h-0 overflow-hidden p-4 flex items-center justify-center select-none touch-none ${
                isPanningPreview ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              {posterDataUrl ? (
                <div
                  style={{
                    transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0) scale(${previewScale})`,
                    transformOrigin: "center center",
                    transition: isPanningPreview
                      ? "none"
                      : "transform 110ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  className="flex items-center justify-center"
                >
                  {stylePreset === "holo" ? (
                    <div
                      className={`flex items-center justify-center transition-opacity ${
                        isGenerating ? "opacity-60" : "opacity-100"
                      }`}
                    >
                      <HoloCard
                        image={posterDataUrl}
                        alt={`${project.title} - ${part.partName}`}
                        preset={holoPreset}
                        foilColor={holoFoilColor}
                        intensity={holoIntensity}
                        scale={holoScale}
                        edgeSparkle={holoEdgeSparkle}
                        frame={holoFrame}
                        glare={holoGlare}
                        tiltMax={isPanningPreview ? 0 : holoTiltMax}
                        hoverScale={1.02}
                        radius={Math.max(8, Math.min(28, cornerRadius))}
                        width={holoCardDisplayWidth}
                        aspectRatio={posterAspect}
                        idle={holoIdle && !isPanningPreview}
                      />
                    </div>
                  ) : (
                    <div
                      style={{ width: `${holoCardDisplayWidth}px` }}
                      className={`relative inline-block overflow-hidden rounded-xl transition-opacity ${
                        isGenerating ? "opacity-50" : "opacity-100"
                      }`}
                    >
                      <img
                        src={posterDataUrl}
                        alt="Project Share Poster"
                        draggable={false}
                        className="block w-full h-auto rounded-xl shadow-[0_10px_30px_rgba(15,23,42,0.18)] pointer-events-none select-none"
                      />
                      {/* Live <ProjectAnnotatedCanvas readOnly={true} /> mounted directly in the artwork slot for 100% component parity with Project Detail View */}
                      {effectiveArtSrc && (
                        <div
                          className="pointer-events-none absolute overflow-hidden"
                          style={{
                            left: `${posterArtCropRect[0] * 100}%`,
                            top: `${posterArtCropRect[1] * 100}%`,
                            width: `${posterArtCropRect[2] * 100}%`,
                            height: `${posterArtCropRect[3] * 100}%`,
                          }}
                        >
                          <ProjectAnnotatedCanvas
                            imageSrc={effectiveArtSrc}
                            alt={part.partName}
                            colors={partColors}
                            swatchSettings={swatchSettings}
                            readOnly={true}
                            fillWidth={true}
                            roundedClassName="rounded-none"
                          />
                        </div>
                      )}
                      {enableEffectAnimation && (
                        <div
                          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
                          aria-hidden="true"
                        >
                          <div
                            className="absolute inset-0 opacity-60 animate-pulse"
                            style={{
                              background:
                                "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.32) 48%, rgba(239,83,80,0.14) 54%, transparent 78%)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : isGenerating ? (
                <div className="my-auto py-20 text-center space-y-2.5">
                  <div className="h-9 w-9 mx-auto rounded-full border-3 border-accent border-t-transparent animate-spin" />
                  <p className="text-xs text-slate-500 font-bold">
                    正在合成色卡、工序与二维码…
                  </p>
                </div>
              ) : (
                <div className="my-auto py-12 text-center space-y-3">
                  <p className="text-xs font-bold text-rose-500">
                    名片生成失败，请重试
                  </p>
                  <button
                    type="button"
                    onClick={() => setRenderRetryCount((c) => c + 1)}
                    className="bp-btn gk-btn-secondary inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <ArrowsClockwiseIcon className="h-3.5 w-3.5 text-accent" weight="bold" />
                    <span>重新合成渲染</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right: compact controls */}
          <aside className="lg:w-[356px] shrink-0 lg:overflow-y-auto space-y-3 pr-1.5 pb-2">
            {/* 1. Swatch scale sync */}
            <div className="bp-subcard rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={sectionTitle}>画面色卡大小</span>
                <span className="bp-badge rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-black text-accent tabular-nums">
                  {Math.round((swatchSettings.cardScale || 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                aria-label="画面色卡大小"
                min={0.75}
                max={1.6}
                step={0.05}
                value={swatchSettings.cardScale || 1}
                onChange={(e) => updateCardScale(parseFloat(e.target.value))}
                className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
              />
              <p className="text-[10px] text-slate-400 leading-snug">
                与色卡排版工作台的字号比例同步
              </p>
            </div>

            {/* 2. Style parameters: Wireframe vs Holo Foil */}
            {stylePreset === "holo" ? (
              <div className="bp-subcard rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={sectionTitle}>全息闪卡参数</span>
                  <span className="font-mono text-[10px] font-bold text-[var(--accent-color)]">
                    HOLO FOIL
                  </span>
                </div>

                {/* Holo Pattern Preset (8 presets) */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    全息镀膜纹理预设
                  </div>
                  <div className="bp-segmented grid grid-cols-4 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {HOLO_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setHoloPreset(p.id)}
                        className={`${segItemClass(
                          holoPreset === p.id
                        )} px-1.5 py-1.5 text-[11px] whitespace-nowrap`}
                        title={`${p.label} (${p.badge})`}
                      >
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Foil Metal Tint Swatches */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    金属底膜色调
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {HOLO_FOIL_COLORS.map((fc) => {
                      const active =
                        holoFoilColor.toLowerCase() === fc.color.toLowerCase();
                      return (
                        <button
                          key={fc.id}
                          type="button"
                          onClick={() => setHoloFoilColor(fc.color)}
                          className={`inline-flex items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-black whitespace-nowrap transition cursor-pointer ${
                            active
                              ? "border-2 border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 dark:text-white"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-slate-400 shrink-0"
                            style={{ backgroundColor: fc.color }}
                          />
                          <span>{fc.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Light / Dark Theme */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    闪卡底色主题
                  </div>
                  <div className="bp-segmented grid grid-cols-2 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setPosterTheme("light")}
                      className={segItemClass(posterTheme === "light")}
                    >
                      <SunIcon className="h-3.5 w-3.5" weight="bold" />
                      <span>幻彩珠光白</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosterTheme("dark")}
                      className={segItemClass(posterTheme === "dark")}
                    >
                      <MoonIcon className="h-3.5 w-3.5" weight="bold" />
                      <span>黑曜闪卡黑</span>
                    </button>
                  </div>
                </div>

                {/* Spec Panel Position */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    信息栏位置
                  </div>
                  <div className="bp-segmented grid grid-cols-3 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {(
                      [
                        { id: "bottom", label: "下边" },
                        { id: "left", label: "左边" },
                        { id: "right", label: "右边" },
                      ] as Array<{ id: PosterLayoutPosition; label: string }>
                    ).map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setPosterLayout(pos.id)}
                        className={segItemClass(posterLayout === pos.id)}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Holo Intensity Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      全息激光强度 (Intensity)
                    </span>
                    <span className="bp-badge rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                      {Math.round(holoIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="全息激光强度"
                    min={0}
                    max={1}
                    step={0.05}
                    value={holoIntensity}
                    onChange={(e) => setHoloIntensity(parseFloat(e.target.value))}
                    className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                  />
                </div>

                {/* Holo Pattern Scale Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      全息纹理密度 (Scale)
                    </span>
                    <span className="bp-badge rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                      {holoScale.toFixed(1)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="全息纹理密度"
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    value={holoScale}
                    onChange={(e) => setHoloScale(parseFloat(e.target.value))}
                    className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                  />
                </div>

                {/* Edge Sparkle & Frame Width */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        边框碎钻闪光
                      </span>
                      <span className="font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                        {Math.round(holoEdgeSparkle * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="边框碎钻闪光"
                      min={0}
                      max={1}
                      step={0.05}
                      value={holoEdgeSparkle}
                      onChange={(e) =>
                        setHoloEdgeSparkle(parseFloat(e.target.value))
                      }
                      className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        闪卡金属边宽
                      </span>
                      <span className="font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                        {holoFrame.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="闪卡金属边宽"
                      min={0}
                      max={8}
                      step={0.5}
                      value={holoFrame}
                      onChange={(e) => setHoloFrame(parseFloat(e.target.value))}
                      className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Specular Glare & 3D Tilt Max */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        高光反光强度
                      </span>
                      <span className="font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                        {Math.round(holoGlare * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="高光反光强度"
                      min={0}
                      max={1}
                      step={0.05}
                      value={holoGlare}
                      onChange={(e) => setHoloGlare(parseFloat(e.target.value))}
                      className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        3D 悬停倾角
                      </span>
                      <span className="font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                        {holoTiltMax}°
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="3D 悬停倾角"
                      min={0}
                      max={24}
                      step={1}
                      value={holoTiltMax}
                      onChange={(e) =>
                        setHoloTiltMax(parseInt(e.target.value, 10))
                      }
                      className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Inner Card Corner Style & Radius */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    内部色卡与工序框边角
                  </div>
                  <div className="bp-segmented grid grid-cols-2 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setCornerStyle("rounded")}
                      className={segItemClass(cornerStyle === "rounded")}
                    >
                      <span>╭ 圆角弧度</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCornerStyle("chamfer")}
                      className={segItemClass(cornerStyle === "chamfer")}
                    >
                      <span>╱ 机械倒角</span>
                    </button>
                  </div>
                </div>

                {/* Holo Toggles */}
                <div className="space-y-2 pt-0.5">
                  <ToggleRow
                    label="辉光阴影跟随色卡漆色"
                    hint="油漆色卡与工序卡光晕匹配对应油漆色值"
                    checked={shadowFollowsPaintColor}
                    onChange={setShadowFollowsPaintColor}
                  />
                  <ToggleRow
                    label="未悬停全息呼吸 (Idle)"
                    hint="无鼠标悬停时自动轻微呼吸摆动展示折射"
                    checked={holoIdle}
                    onChange={setHoloIdle}
                  />
                </div>
              </div>
            ) : (
              <div className="bp-subcard rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={sectionTitle}>线框风格参数</span>
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    WIREFRAME
                  </span>
                </div>

                {/* Light / Dark Theme */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    名片底色主题
                  </div>
                  <div className="bp-segmented grid grid-cols-2 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setPosterTheme("light")}
                      className={segItemClass(posterTheme === "light")}
                    >
                      <SunIcon className="h-3.5 w-3.5" weight="bold" />
                      <span>浅色</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosterTheme("dark")}
                      className={segItemClass(posterTheme === "dark")}
                    >
                      <MoonIcon className="h-3.5 w-3.5" weight="bold" />
                      <span>深色</span>
                    </button>
                  </div>
                </div>

                {/* Spec Panel Position */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    信息栏位置
                  </div>
                  <div className="bp-segmented grid grid-cols-3 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {(
                      [
                        { id: "bottom", label: "下边" },
                        { id: "left", label: "左边" },
                        { id: "right", label: "右边" },
                      ] as Array<{ id: PosterLayoutPosition; label: string }>
                    ).map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => setPosterLayout(pos.id)}
                        className={segItemClass(posterLayout === pos.id)}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Corner Style: Rounded vs Chamfer */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    卡片边角样式
                  </div>
                  <div className="bp-segmented grid grid-cols-2 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setCornerStyle("rounded")}
                      className={segItemClass(cornerStyle === "rounded")}
                    >
                      <span>╭ 圆角弧度</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCornerStyle("chamfer")}
                      className={segItemClass(cornerStyle === "chamfer")}
                    >
                      <span>╱ 机械倒角</span>
                    </button>
                  </div>
                </div>

                {/* Corner Radius / Chamfer Size Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {cornerStyle === "chamfer" ? "倒角切边大小" : "圆角弧度大小"}
                    </span>
                    <span className="bp-badge rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">
                      {cornerRadius}px
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={cornerStyle === "chamfer" ? "倒角切边大小" : "圆角弧度大小"}
                    min={0}
                    max={28}
                    step={1}
                    value={cornerRadius}
                    onChange={(e) => setCornerRadius(parseInt(e.target.value, 10))}
                    className="bp-range-slider w-full accent-[var(--accent-color)] cursor-pointer"
                  />
                </div>

                {/* Offset Shadow Color Follows Assigned Paint */}
                <div className="space-y-2 pt-0.5">
                  <ToggleRow
                    label="阴影跟随色卡漆色"
                    hint="开启后背后硬阴影匹配指派的油漆色值"
                    checked={shadowFollowsPaintColor}
                    onChange={setShadowFollowsPaintColor}
                  />
                  <ToggleRow
                    label="动态流光扫描特效"
                    hint="开启卡片流光特效，支持导出短视频"
                    checked={enableEffectAnimation}
                    onChange={setEnableEffectAnimation}
                  />
                </div>
              </div>
            )}

            {/* 3. Export quality */}
            <div className="bp-subcard rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
              <span className={sectionTitle}>导出画质</span>
              <div className="bp-segmented grid grid-cols-3 gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setQualityMode(q.id)}
                    className={`${segItemClass(
                      qualityMode === q.id
                    )} flex-col leading-tight py-1.5`}
                  >
                    <span>{q.label}</span>
                    <span className="text-[9px] font-bold opacity-75">{q.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Content visibility */}
            <div className="bp-subcard rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
              <span className={`${sectionTitle} block pb-0.5`}>卡片内容显示</span>
              <ToggleRow
                label="🎨 使用的油漆"
                hint={`${part.nodes.length} 款 · 明暗三阶色卡`}
                checked={showPaintsSection}
                onChange={setShowPaintsSection}
              />
              {showPaintsSection && (
                <ToggleRow
                  label="显示油漆瓶缩略图"
                  checked={showPaintThumbs}
                  onChange={setShowPaintThumbs}
                  sub
                />
              )}
              <ToggleRow
                label="🛠️ 涂装工序"
                hint={`${part.steps.length} 步 · 工作流卡片`}
                checked={showStepsFlowchart}
                onChange={setShowStepsFlowchart}
              />
              <ToggleRow
                label="📱 二维码数字名片"
                hint="工程信息 + 扫码还原"
                checked={showQrCard}
                onChange={setShowQrCard}
              />
              {showQrCard && (
                <ToggleRow
                  label="附带网页宣传二维码"
                  checked={showPromoQr}
                  onChange={setShowPromoQr}
                  sub
                />
              )}
              {!showQrCard && (
                <p className="px-1 pt-1 text-[10px] leading-snug text-slate-400">
                  隐藏二维码后，导出 PNG 仍内嵌工程数据，可在 GKMixer 中直接导入还原。
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="bp-top-divider flex flex-wrap items-center justify-between gap-2 px-4 py-3 shrink-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="bp-btn gk-btn-secondary inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-black text-slate-700 dark:text-slate-100 hover:bg-slate-100 transition cursor-pointer"
            title="复制 gkm1: 工程码字符串"
          >
            {copiedCode ? (
              <>
                <CheckIcon className="h-4 w-4 text-emerald-600" weight="bold" />
                <span className="text-emerald-600">已复制工程码</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-4 w-4" weight="bold" />
                <span>复制 gkm1 工程码</span>
              </>
            )}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {(stylePreset === "holo" || enableEffectAnimation) && (
              <button
                type="button"
                onClick={handleExportAnimatedVideo}
                disabled={!posterDataUrl || isGenerating || isRecordingVideo}
                className="bp-btn gk-btn-secondary inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-950/60 px-3.5 text-xs font-black text-amber-800 dark:text-amber-200 disabled:opacity-40 transition cursor-pointer"
                title="将当前带动态特效的名片录制导出为 4秒 动态视频"
              >
                <FilmStripIcon className="h-4 w-4 text-amber-600" weight="bold" />
                <span>
                  {isRecordingVideo
                    ? "正在录制全息特效视频…"
                    : stylePreset === "holo"
                    ? "导出全息闪卡视频 (4s)"
                    : "导出特效视频 (4s)"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSharePoster}
              disabled={!posterDataUrl || isGenerating}
              className="bp-btn gk-btn-secondary inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-xs font-black text-slate-700 dark:text-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              <ShareNetworkIcon className="h-4 w-4" weight="bold" />
              <span>系统分享</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPoster}
              disabled={!posterDataUrl || isGenerating}
              className="bp-btn gk-btn-primary inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-900 bg-accent px-4 text-xs font-black text-white disabled:opacity-40 transition cursor-pointer"
            >
              <DownloadSimpleIcon className="h-4 w-4" weight="bold" />
              <span>保存 PNG（{posterDimensions.w}px）</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSharePosterModal;
