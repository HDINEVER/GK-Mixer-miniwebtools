import React, { useEffect, useMemo, useRef, useState } from "react";
import { CatalogPaint, ColorData, Language, TonalStep } from "../types";
import { ExtractMarkerOverlay } from "./ExtractMarkerOverlay";
import { SwatchStudioControls } from "./SwatchStudioControls";
import {
  applyBucketFillOnStage,
  buildExtendedMarginCanvasAndColors,
  buildFreeExpandCanvasAndColors,
  CanvasMarginRecord,
  ExpandCropState,
  ExpandFillMode,
  getCanvasMarginRecord,
  inspectOrSampleImageMargins,
  MarginExtendMode,
  sampleStagePixelHex,
  SwatchSettings,
  undoBucketFillOnStage,
} from "../utils/swatchLayout";
import {
  ensureCanvasExpandEngineReady,
  getExpandEngineDriverName,
} from "../services/canvasExpandEngine";
import {
  XIcon,
  SparkleIcon,
  FolderPlusIcon,
  ColumnsIcon,
  RowsIcon,
  ArrowCounterClockwiseIcon,
  EyedropperIcon,
  ScissorsIcon,
  PaintBucketIcon,
  ArrowsOutLineHorizontalIcon,
} from "@phosphor-icons/react";

interface SwatchEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  imageSrc: string;
  colors: ColorData[];
  selectedColor: ColorData | null;
  onSelectColor: (color: ColorData) => void;
  onUpdateColors: (updater: (prev: ColorData[]) => ColorData[]) => void;
  onUpdateImageAndColors?: (newImageSrc: string, nextColors: ColorData[]) => void;
  settings: SwatchSettings;
  onUpdateSettings: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  lang: Language;
  onExportImage?: () => void;
  isExporting?: boolean;
  onSaveToProject?: () => void;
}

type HandleId = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

interface ActiveHandleDrag {
  handle: HandleId;
  startClientX: number;
  startClientY: number;
  pxPerScreenPx: number;
  initialState: ExpandCropState;
  origW: number;
  origH: number;
}

function generateDefaultTonalSteps(hex: string): TonalStep[] {
  const clean = hex.replace("#", "").trim();
  const num = parseInt(clean, 16);
  const r = Number.isNaN(num) ? 100 : (num >> 16) & 255;
  const g = Number.isNaN(num) ? 120 : (num >> 8) & 255;
  const b = Number.isNaN(num) ? 150 : num & 255;

  const adjust = (factor: number) => {
    const nr = Math.min(255, Math.max(0, Math.round(r + (factor > 0 ? (255 - r) * factor : r * factor))));
    const ng = Math.min(255, Math.max(0, Math.round(g + (factor > 0 ? (255 - g) * factor : g * factor))));
    const nb = Math.min(255, Math.max(0, Math.round(b + (factor > 0 ? (255 - b) * factor : b * factor))));
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb
      .toString(16)
      .padStart(2, "0")}`.toUpperCase();
  };

  return [
    { id: "hl", hex: adjust(0.32), label: "高光", role: "highlight" },
    { id: "base", hex: `#${clean.toUpperCase()}`, label: "主色", role: "base" },
    { id: "sh", hex: adjust(-0.32), label: "阴影", role: "shadow" },
  ];
}

export const SwatchEditorModal: React.FC<SwatchEditorModalProps> = ({
  isOpen,
  onClose,
  title = "色卡排版与样式工作台",
  imageSrc,
  colors,
  selectedColor,
  onSelectColor,
  onUpdateColors,
  onUpdateImageAndColors,
  settings,
  onUpdateSettings,
  lang,
  onExportImage,
  isExporting,
  onSaveToProject,
}) => {
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);

  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 600, h: 450 });
  const [stageViewportSize, setStageViewportSize] = useState<{ w: number; h: number }>({ w: 680, h: 480 });
  const [activeTool, setActiveTool] = useState<"none" | "expand" | "bucket">("none");
  const [engineDriver, setEngineDriver] = useState<"rust-wasm" | "ts-typedarray">(() =>
    getExpandEngineDriverName()
  );

  // Margin & 8-Handle Out-of-Bounds Crop State
  const [marginRecord, setMarginRecord] = useState<CanvasMarginRecord | null>(() =>
    imageSrc ? getCanvasMarginRecord(imageSrc) || null : null
  );
  const [expandState, setExpandState] = useState<ExpandCropState>({
    leftPx: 0,
    rightPx: 0,
    topPx: 0,
    bottomPx: 0,
    fillMode: "solid",
    fillColor: "#F1F5F9",
  });
  const [isSymmetricExpand, setIsSymmetricExpand] = useState<boolean>(false);
  const [liveDragState, setLiveDragState] = useState<{
    handle: HandleId;
    state: ExpandCropState;
    hudText: string;
  } | null>(null);
  const handleDragRef = useRef<ActiveHandleDrag | null>(null);
  const [isProcessingCanvas, setIsProcessingCanvas] = useState<boolean>(false);

  // Bucket Fill Tool State
  const [bucketColor, setBucketColor] = useState<string>("#F8FAFC");
  const [bucketTolerance, setBucketTolerance] = useState<number>(32);
  const [connectOriginalBg, setConnectOriginalBg] = useState<boolean>(true);
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(false);
  const [bucketToast, setBucketToast] = useState<string | null>(null);

  useEffect(() => {
    ensureCanvasExpandEngineReady().then((driver) => setEngineDriver(driver));
  }, []);

  // Sync margin record when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const existing = getCanvasMarginRecord(imageSrc);
    if (existing) {
      setMarginRecord(existing);
      if (existing.expandState) {
        setExpandState(existing.expandState);
      }
      if (existing.customColor) {
        setBucketColor(existing.customColor);
      } else if (existing.sampledEdgeColors?.overall) {
        setBucketColor(existing.sampledEdgeColors.overall);
      }
      return;
    }
    inspectOrSampleImageMargins(imageSrc).then((rec) => {
      if (cancelled || !rec) return;
      setMarginRecord(rec);
      if (rec.expandState) {
        setExpandState(rec.expandState);
      }
      if (rec.sampledEdgeColors?.overall) {
        setBucketColor(rec.sampledEdgeColors.overall);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  useEffect(() => {
    if (!isOpen) return;
    const el = imgContainerRef.current;
    const vp = stageViewportRef.current;
    const update = () => {
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) {
          setCanvasSize({ w: rect.width, h: rect.height });
        }
      }
      if (vp) {
        const vRect = vp.getBoundingClientRect();
        if (vRect.width > 20 && vRect.height > 20) {
          setStageViewportSize({ w: vRect.width, h: vRect.height });
        }
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (el) ro.observe(el);
    if (vp) ro.observe(vp);
    return () => ro.disconnect();
  }, [isOpen, imageSrc]);

  const showQuickToast = (msg: string) => {
    setBucketToast(msg);
    window.setTimeout(() => {
      setBucketToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const assignedColors = useMemo(
    () => colors.filter((c): c is ColorData & { assignedPaint: CatalogPaint } => !!c.assignedPaint),
    [colors]
  );
  const activeAssigned =
    selectedColor && selectedColor.assignedPaint
      ? selectedColor
      : assignedColors[0] || null;

  const hasTonal = !!(activeAssigned?.tonalGradient && activeAssigned.tonalGradient.length > 0);
  const undoCount = marginRecord?.bucketUndoStack?.length || 0;

  const origW = marginRecord?.origWidth || 1000;
  const origH = marginRecord?.origHeight || 800;
  const activeExpand = liveDragState ? liveDragState.state : expandState;
  const totalStageW = Math.max(64, origW + activeExpand.leftPx + activeExpand.rightPx);
  const totalStageH = Math.max(64, origH + activeExpand.topPx + activeExpand.bottomPx);

  // Compute live preview padding & auto-fit scale during 8-handle drag so pulled-out margin is 100% visible
  const liveDragVisuals = useMemo(() => {
    if (!liveDragState) {
      return {
        padLeft: 0,
        padRight: 0,
        padTop: 0,
        padBottom: 0,
        autoFitScale: 1,
      };
    }
    const baseState = expandState;
    const curState = liveDragState.state;
    const curStageW = Math.max(64, origW + baseState.leftPx + baseState.rightPx);
    const curStageH = Math.max(64, origH + baseState.topPx + baseState.bottomPx);
    const screenPerStagePxX = canvasSize.w / curStageW;
    const screenPerStagePxY = canvasSize.h / curStageH;

    const dLeftScreen = Math.max(0, (curState.leftPx - baseState.leftPx) * screenPerStagePxX);
    const dRightScreen = Math.max(0, (curState.rightPx - baseState.rightPx) * screenPerStagePxX);
    const dTopScreen = Math.max(0, (curState.topPx - baseState.topPx) * screenPerStagePxY);
    const dBotScreen = Math.max(0, (curState.bottomPx - baseState.bottomPx) * screenPerStagePxY);

    const expandedScreenW = canvasSize.w + dLeftScreen + dRightScreen;
    const expandedScreenH = canvasSize.h + dTopScreen + dBotScreen;
    const availW = Math.max(240, stageViewportSize.w - 44);
    const availH = Math.max(220, stageViewportSize.h - 44);
    const autoFitScale = Math.min(
      1,
      availW / Math.max(1, expandedScreenW),
      availH / Math.max(1, expandedScreenH)
    );

    return {
      padLeft: Math.round(dLeftScreen),
      padRight: Math.round(dRightScreen),
      padTop: Math.round(dTopScreen),
      padBottom: Math.round(dBotScreen),
      autoFitScale,
    };
  }, [liveDragState, expandState, origW, origH, canvasSize.w, canvasSize.h, stageViewportSize.w, stageViewportSize.h]);

  if (!isOpen) return null;

  const toggleActiveTonalGradient = () => {
    if (!activeAssigned) return;
    const baseHex = activeAssigned.assignedPaint?.hex || activeAssigned.hex;
    onUpdateColors((prev) =>
      prev.map((c) => {
        if (c.id !== activeAssigned.id) return c;
        if (c.tonalGradient && c.tonalGradient.length > 0) {
          return { ...c, tonalGradient: undefined };
        }
        return { ...c, tonalGradient: generateDefaultTonalSteps(baseHex) };
      })
    );
  };

  const handleToggleTool = (tool: "expand" | "bucket") => {
    setIsEyedropperActive(false);
    setActiveTool((prev) => (prev === tool ? "none" : tool));
  };

  const handleQuickMarginPreset = async (mode: MarginExtendMode) => {
    if (!imageSrc || !onUpdateImageAndColors || isProcessingCanvas) return;
    setIsProcessingCanvas(true);
    try {
      const res = await buildExtendedMarginCanvasAndColors(
        imageSrc,
        colors,
        mode,
        marginRecord?.ratio || 0.36,
        marginRecord?.customColor ?? null,
        settings.cardScale,
        settings.cardBaseWidth,
        expandState.fillMode
      );
      setMarginRecord(res.record);
      if (res.record.expandState) {
        setExpandState(res.record.expandState);
      }
      onUpdateImageAndColors(res.imageSrc, res.colors);
      showQuickToast(
        mode === "none"
          ? "已恢复原图尺寸与原始背景"
          : mode === "leftRight"
          ? "已左右扩边并将色卡排入留白区"
          : "已上下扩边并将色卡排入留白区"
      );
    } catch (err) {
      console.error("[SwatchEditorModal] Quick margin preset failed:", err);
    } finally {
      setIsProcessingCanvas(false);
    }
  };

  const handleCommitFreeExpand = async (
    nextState: ExpandCropState,
    customColorOverride?: string | null
  ) => {
    if (!imageSrc || !onUpdateImageAndColors || isProcessingCanvas) return;
    setIsProcessingCanvas(true);
    try {
      const isZero =
        nextState.leftPx === 0 &&
        nextState.rightPx === 0 &&
        nextState.topPx === 0 &&
        nextState.bottomPx === 0;
      const res = await buildFreeExpandCanvasAndColors(
        imageSrc,
        colors,
        nextState,
        settings.cardScale,
        settings.cardBaseWidth,
        isZero ? "none" : "custom",
        customColorOverride,
        true
      );
      setMarginRecord(res.record);
      if (res.record.expandState) {
        setExpandState(res.record.expandState);
      }
      onUpdateImageAndColors(res.imageSrc, res.colors);
    } catch (err) {
      console.error("[SwatchEditorModal] Free expand commit failed:", err);
    } finally {
      setIsProcessingCanvas(false);
    }
  };

  // 8-Handle Pointer Down / Move / Up
  const startHandleDrag = (e: React.PointerEvent<HTMLDivElement>, handle: HandleId) => {
    if (isProcessingCanvas) return;
    e.preventDefault();
    e.stopPropagation();

    const curStageW = Math.max(64, origW + expandState.leftPx + expandState.rightPx);
    const pxPerScreenPx = curStageW / Math.max(100, canvasSize.w);

    handleDragRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pxPerScreenPx,
      initialState: { ...expandState },
      origW,
      origH,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const moveHandleDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = handleDragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();

    const dxPx = Math.round((e.clientX - drag.startClientX) * drag.pxPerScreenPx);
    const dyPx = Math.round((e.clientY - drag.startClientY) * drag.pxPerScreenPx);
    const symmetric = e.altKey || isSymmetricExpand;

    const minCropX = -Math.round(drag.origW * 0.35);
    const maxExpandX = Math.round(drag.origW * 1.15);
    const minCropY = -Math.round(drag.origH * 0.35);
    const maxExpandY = Math.round(drag.origH * 1.15);
    const clampX = (v: number) => Math.max(minCropX, Math.min(maxExpandX, v));
    const clampY = (v: number) => Math.max(minCropY, Math.min(maxExpandY, v));

    let { leftPx, rightPx, topPx, bottomPx } = drag.initialState;
    const h = drag.handle;

    if (h.includes("w")) {
      leftPx = clampX(drag.initialState.leftPx - dxPx);
      if (symmetric) {
        rightPx = clampX(drag.initialState.rightPx - dxPx);
      }
    }
    if (h.includes("e")) {
      rightPx = clampX(drag.initialState.rightPx + dxPx);
      if (symmetric) {
        leftPx = clampX(drag.initialState.leftPx + dxPx);
      }
    }
    if (h.includes("n")) {
      topPx = clampY(drag.initialState.topPx - dyPx);
      if (symmetric) {
        bottomPx = clampY(drag.initialState.bottomPx - dyPx);
      }
    }
    if (h.includes("s")) {
      bottomPx = clampY(drag.initialState.bottomPx + dyPx);
      if (symmetric) {
        topPx = clampY(drag.initialState.topPx + dyPx);
      }
    }

    const nextState: ExpandCropState = {
      ...drag.initialState,
      leftPx,
      rightPx,
      topPx,
      bottomPx,
    };

    const nextStageW = Math.max(64, drag.origW + leftPx + rightPx);
    const nextStageH = Math.max(64, drag.origH + topPx + bottomPx);
    const fmtSide = (label: string, val: number) =>
      `${label} ${val >= 0 ? `+${val}` : val}px`;

    const parts: string[] = [];
    if (h.includes("w") || symmetric) parts.push(fmtSide("← 左扩", leftPx));
    if (h.includes("e") || symmetric) parts.push(fmtSide("右扩 →", rightPx));
    if (h.includes("n") || symmetric) parts.push(fmtSide("↑ 上扩", topPx));
    if (h.includes("s") || symmetric) parts.push(fmtSide("↓ 下扩", bottomPx));

    setLiveDragState({
      handle: h,
      state: nextState,
      hudText: `${parts.join(" · ")} · 总画布 ${nextStageW} × ${nextStageH}`,
    });
  };

  const endHandleDrag = async (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = handleDragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    handleDragRef.current = null;

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const committed = liveDragState?.state;
    setLiveDragState(null);
    if (!committed) return;

    const changed =
      committed.leftPx !== expandState.leftPx ||
      committed.rightPx !== expandState.rightPx ||
      committed.topPx !== expandState.topPx ||
      committed.bottomPx !== expandState.bottomPx;

    if (changed) {
      setExpandState(committed);
      await handleCommitFreeExpand(committed);
    }
  };

  // Canvas Click Handler for Bucket Fill (`🪣`) & Eyedropper (`💧`)
  const handleStageCanvasPointerDown = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== "bucket" || isProcessingCanvas) return;
    const imgEl = imgElRef.current;
    if (!imgEl || !imageSrc || !onUpdateImageAndColors) return;

    const rect = imgEl.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    e.preventDefault();
    e.stopPropagation();

    // Eyedropper mode: sample pixel color into bucket
    if (isEyedropperActive) {
      const sampled = sampleStagePixelHex(imgEl, nx, ny);
      setBucketColor(sampled);
      setIsEyedropperActive(false);
      showQuickToast(`💧 已吸取背景色 ${sampled}`);
      return;
    }

    // Bucket Fill mode: run Scanline Flood Fill + 1.5px Edge Feathering
    setIsProcessingCanvas(true);
    try {
      const res = await applyBucketFillOnStage(
        imageSrc,
        nx,
        ny,
        bucketColor,
        bucketTolerance,
        connectOriginalBg
      );
      setMarginRecord(res.record);
      if (res.record.expandState) {
        setExpandState(res.record.expandState);
      }
      onUpdateImageAndColors(res.imageSrc, colors);
      showQuickToast(`🪣 已填色 (${bucketColor}) · 可随时点击「撤销填色」回退`);
    } catch (err) {
      console.error("[SwatchEditorModal] Bucket fill failed:", err);
    } finally {
      setIsProcessingCanvas(false);
    }
  };

  const handleUndoBucketFill = () => {
    if (!imageSrc || !onUpdateImageAndColors) return;
    const undone = undoBucketFillOnStage(imageSrc);
    if (!undone) return;
    setMarginRecord(undone.record);
    if (undone.record.expandState) {
      setExpandState(undone.record.expandState);
    }
    onUpdateImageAndColors(undone.imageSrc, colors);
    showQuickToast("↶ 已撤销上一步油漆桶填色");
  };

  const handleDefinitions: Array<{
    id: HandleId;
    posClass: string;
    cursorClass: string;
    isCorner: boolean;
  }> = [
    { id: "nw", posClass: "-top-2 -left-2", cursorClass: "cursor-nwse-resize", isCorner: true },
    { id: "n", posClass: "-top-2 left-1/2 -translate-x-1/2", cursorClass: "cursor-ns-resize", isCorner: false },
    { id: "ne", posClass: "-top-2 -right-2", cursorClass: "cursor-nesw-resize", isCorner: true },
    { id: "e", posClass: "top-1/2 -right-2 -translate-y-1/2", cursorClass: "cursor-ew-resize", isCorner: false },
    { id: "se", posClass: "-bottom-2 -right-2", cursorClass: "cursor-nwse-resize", isCorner: true },
    { id: "s", posClass: "-bottom-2 left-1/2 -translate-x-1/2", cursorClass: "cursor-ns-resize", isCorner: false },
    { id: "sw", posClass: "-bottom-2 -left-2", cursorClass: "cursor-nesw-resize", isCorner: true },
    { id: "w", posClass: "top-1/2 -left-2 -translate-y-1/2", cursorClass: "cursor-ew-resize", isCorner: false },
  ];

  const innerFrameStyle = useMemo(() => {
    if (!marginRecord) return { left: "0%", top: "0%", width: "100%", height: "100%" };
    return {
      left: `${Math.max(0, Math.min(100, marginRecord.innerLeftNx * 100))}%`,
      top: `${Math.max(0, Math.min(100, marginRecord.innerTopNy * 100))}%`,
      width: `${Math.max(5, Math.min(100, marginRecord.innerWidthNw * 100))}%`,
      height: `${Math.max(5, Math.min(100, marginRecord.innerHeightNh * 100))}%`,
    };
  }, [marginRecord]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-md p-0 sm:p-4 animate-fadeIn">
      <div className="bp-modal-shell relative flex flex-col w-full max-w-6xl max-h-[94dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-3xl bg-slate-50 dark:bg-slate-950 border border-white/30 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Floating Liquid Glass Header */}
        <div className="bp-modal-header flex items-center justify-between px-4 sm:px-6 py-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="bp-dot h-2.5 w-2.5 rounded-full bg-[var(--accent-color)] shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
              <span className="tech-prefix">[SWATCH STUDIO]</span>
              {title}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {engineDriver === "rust-wasm" ? "⚡ Rust Wasm 内核" : "⚡ Wasm/Canvas 双驱合成"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onSaveToProject && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSaveToProject();
                }}
                className="bp-pill-active inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-color)] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 transition-colors cursor-pointer"
                title="存入涂装项目库，可继续添加涂装工序、制作扫码导入二维码名片及打包工程文件"
              >
                <FolderPlusIcon className="h-3.5 w-3.5" weight="bold" />
                <span>存入涂装库</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="bp-btn flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors cursor-pointer"
              title="完成并关闭"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: Interactive Canvas + Controls */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left 7 cols: Interactive Out-of-Bounds Crop & Bucket Fill Canvas Stage */}
          <div className="lg:col-span-7 space-y-2.5 lg:sticky lg:top-0 pr-1 pb-1">
            {/* Stage Top Engineering Toolbar: [✂️ 自由扩边/裁切] + [🪣 油漆桶填色] + Quick Presets */}
            {onUpdateImageAndColors && (
              <div className="bp-subcard rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggleTool("expand")}
                      className={`bp-btn inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                        activeTool === "expand"
                          ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)]"
                      }`}
                      title="开启仿 Photoshop 8 手柄自由越界扩边与裁切模式"
                    >
                      <ScissorsIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                      <span>✂️ 自由扩边/裁切</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleTool("bucket")}
                      className={`bp-btn inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                        activeTool === "bucket"
                          ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)]"
                      }`}
                      title="开启油漆桶工具，一键将外扩留白区与原图背景刷成统一纯色"
                    >
                      <PaintBucketIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                      <span>🪣 油漆桶填色</span>
                    </button>

                    {undoCount > 0 && (
                      <button
                        type="button"
                        onClick={handleUndoBucketFill}
                        className="bp-btn inline-flex items-center gap-1 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-800 dark:text-amber-200 hover:bg-amber-100 transition cursor-pointer"
                        title="撤销上一步油漆桶填色"
                      >
                        <ArrowCounterClockwiseIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                        <span>↶ 撤销填色 ({undoCount})</span>
                      </button>
                    )}
                  </div>

                  {/* Quick Matrix Presets: [左右加宽] [上下加高] [恢复原图] */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isProcessingCanvas}
                      onClick={() => handleQuickMarginPreset("leftRight")}
                      className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        marginRecord?.mode === "leftRight"
                          ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[var(--accent-color)]"
                      }`}
                      title="快捷左右等距加宽留白并将色卡排入两侧留白区"
                    >
                      <ColumnsIcon className="h-3 w-3 shrink-0" weight="bold" />
                      <span>左右加宽</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingCanvas}
                      onClick={() => handleQuickMarginPreset("topBottom")}
                      className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        marginRecord?.mode === "topBottom"
                          ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[var(--accent-color)]"
                      }`}
                      title="快捷上下等距加高留白并将色卡排入上下留白区"
                    >
                      <RowsIcon className="h-3 w-3 shrink-0" weight="bold" />
                      <span>上下加高</span>
                    </button>
                    <button
                      type="button"
                      disabled={
                        isProcessingCanvas ||
                        (marginRecord?.mode === "none" && undoCount === 0)
                      }
                      onClick={() => handleQuickMarginPreset("none")}
                      className="bp-btn inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-slate-400 disabled:opacity-40 transition cursor-pointer"
                      title="恢复原始未扩边图片与初始色卡位置"
                    >
                      <ArrowCounterClockwiseIcon className="h-3 w-3 shrink-0" weight="bold" />
                      <span>恢复原图</span>
                    </button>
                  </div>
                </div>

                {/* Sub-bar A: 8-Handle Out-of-Bounds Expand Options */}
                {activeTool === "expand" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-slate-400 mr-0.5">像素填充:</span>
                      {(
                        [
                          { id: "solid" as const, label: "🎨 纯色填充" },
                          { id: "edge-clamp" as const, label: "↔️ 边缘像素拉伸" },
                          { id: "ambient-blur" as const, label: "🌫️ 高斯环境模糊" },
                        ]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isProcessingCanvas}
                          onClick={async () => {
                            const next: ExpandCropState = {
                              ...expandState,
                              leftPx:
                                expandState.leftPx === 0 &&
                                expandState.rightPx === 0 &&
                                expandState.topPx === 0 &&
                                expandState.bottomPx === 0
                                  ? Math.round(origW * 0.32)
                                  : expandState.leftPx,
                              rightPx:
                                expandState.leftPx === 0 &&
                                expandState.rightPx === 0 &&
                                expandState.topPx === 0 &&
                                expandState.bottomPx === 0
                                  ? Math.round(origW * 0.32)
                                  : expandState.rightPx,
                              fillMode: m.id,
                            };
                            setExpandState(next);
                            await handleCommitFreeExpand(next);
                          }}
                          className={`bp-btn rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                            expandState.fillMode === m.id
                              ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsSymmetricExpand((v) => !v)}
                        className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                          isSymmetricExpand
                            ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        }`}
                        title="开启后（或按住 Alt/Option 键）拖动单侧手柄将对称同步向外拉出留白"
                      >
                        <ArrowsOutLineHorizontalIcon className="h-3 w-3" weight="bold" />
                        <span>对称扩边 (Alt)</span>
                      </button>

                      <span className="font-mono text-[10px] font-bold text-slate-400">
                        {totalStageW}×{totalStageH}px
                      </span>
                    </div>
                  </div>
                )}

                {/* Sub-bar B: Bucket Fill Tool Controls */}
                {activeTool === "bucket" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-500 dark:text-slate-400">填色:</span>
                      {[
                        {
                          hex: marginRecord?.sampledEdgeColors?.overall || "#F1F5F9",
                          label: "✨原图色",
                        },
                        { hex: "#FFFFFF", label: "纯白" },
                        { hex: "#F1F5F9", label: "浅灰" },
                        { hex: "#1E293B", label: "深灰" },
                        { hex: "#0F172A", label: "暗黑" },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setBucketColor(preset.hex.toUpperCase());
                            setIsEyedropperActive(false);
                          }}
                          className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                            bucketColor.toUpperCase() === preset.hex.toUpperCase() && !isEyedropperActive
                              ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-full border border-black/20 shrink-0"
                            style={{ backgroundColor: preset.hex }}
                          />
                          <span>{preset.label}</span>
                        </button>
                      ))}

                      <label
                        className="relative flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer shadow-2xs"
                        title="自定义油漆桶填充颜色"
                      >
                        <input
                          type="color"
                          value={bucketColor}
                          onChange={(e) => {
                            setBucketColor(e.target.value.toUpperCase());
                            setIsEyedropperActive(false);
                          }}
                          className="absolute inset-0 h-8 w-8 -left-1 -top-1 cursor-pointer opacity-0"
                        />
                        <span
                          className="h-full w-full"
                          style={{
                            background:
                              "conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)",
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsEyedropperActive((v) => !v)}
                        className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-extrabold transition cursor-pointer ${
                          isEyedropperActive
                            ? "bp-pill-active border-amber-500 bg-amber-500 text-white"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        }`}
                        title="点击画面任意位置吸取背景颜色"
                      >
                        <EyedropperIcon className="h-3 w-3" weight="bold" />
                        <span>💧 吸管</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">
                          容差 {bucketTolerance}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={80}
                          step={2}
                          value={bucketTolerance}
                          onChange={(e) => setBucketTolerance(parseInt(e.target.value, 10))}
                          className="w-20 accent-[var(--accent-color)] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                          title="泛洪填色容差 (0 ~ 80)：数值越大越容易一次性刷平渐变或杂乱背景"
                        />
                      </div>

                      <label
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="开启后点击留白区或原图背景时，自动跨边界刷平留白区与相连的原图背景"
                      >
                        <input
                          type="checkbox"
                          checked={connectOriginalBg}
                          onChange={(e) => setConnectOriginalBg(e.target.checked)}
                          className="rounded border-slate-300 text-[var(--accent-color)]"
                        />
                        <span>连通原图背景</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Interactive Canvas Stage with Auto-Fit Viewport & 8-Handle Overlay */}
            <div
              ref={stageViewportRef}
              className="bp-canvas-stage relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-900/95 p-3 sm:p-5 shadow-inner flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[380px]"
            >
              {/* Live Dimension Ruler HUD or Bucket Toast */}
              {(liveDragState || bucketToast || activeTool !== "none") && (
                <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/85 px-3 py-1 font-mono text-[11px] font-extrabold text-white shadow-lg backdrop-blur-md whitespace-nowrap">
                  {liveDragState ? (
                    <span className="text-sky-300">{liveDragState.hudText}</span>
                  ) : bucketToast ? (
                    <span className="text-emerald-300">{bucketToast}</span>
                  ) : activeTool === "expand" ? (
                    <span>
                      ✂️ 拖拽四周 8 个手柄向外拉出留白 (按住 Alt 对称扩边) · 总画布 {totalStageW} × {totalStageH}
                    </span>
                  ) : (
                    <span>
                      {isEyedropperActive
                        ? "💧 请点击画面吸取目标背景颜色"
                        : `🪣 点击留白区或原图背景一键填色 (${bucketColor} · 容差 ${bucketTolerance})`}
                    </span>
                  )}
                </div>
              )}

              {/* Auto-Fitting Stage Wrapper */}
              <div
                style={{
                  paddingLeft: liveDragVisuals.padLeft,
                  paddingRight: liveDragVisuals.padRight,
                  paddingTop: liveDragVisuals.padTop,
                  paddingBottom: liveDragVisuals.padBottom,
                  backgroundColor: liveDragState
                    ? activeExpand.fillColor || marginRecord?.sampledEdgeColors?.overall || "#F1F5F9"
                    : undefined,
                  transform:
                    liveDragVisuals.autoFitScale < 0.999
                      ? `scale(${liveDragVisuals.autoFitScale.toFixed(4)})`
                      : undefined,
                  transformOrigin: "center center",
                  transition: liveDragState ? "none" : "transform 180ms ease-out",
                }}
                className={`relative inline-block max-w-full rounded-xl ${
                  activeTool === "bucket"
                    ? isEyedropperActive
                      ? "cursor-crosshair"
                      : "cursor-pointer"
                    : ""
                }`}
                onPointerDown={handleStageCanvasPointerDown}
              >
                <div ref={imgContainerRef} className="relative inline-block max-w-full">
                  <img
                    ref={imgElRef}
                    src={imageSrc}
                    alt="Swatch Canvas"
                    onLoad={() => {
                      const el = imgContainerRef.current;
                      if (!el) return;
                      const rect = el.getBoundingClientRect();
                      if (rect.width > 10 && rect.height > 10) {
                        setCanvasSize({ w: rect.width, h: rect.height });
                      }
                    }}
                    className="bp-swatch block max-h-[44dvh] lg:max-h-[58dvh] w-auto h-auto max-w-full rounded-xl select-none"
                    draggable={false}
                  />

                  {/* Swatch Cards & Leader Lines Overlay */}
                  <ExtractMarkerOverlay
                    colors={colors}
                    selectedId={activeAssigned?.id || selectedColor?.id || null}
                    onSelect={onSelectColor}
                    onUpdatePosition={(id, nx, ny) => {
                      onUpdateColors((prev) =>
                        prev.map((c) => (c.id === id ? { ...c, labelNx: nx, labelNy: ny } : c))
                      );
                    }}
                    settings={settings}
                    interactive={activeTool !== "bucket"}
                    allowDrag={activeTool !== "bucket"}
                  />

                  {/* Rule-of-Thirds Grid & Original Image Boundary when [✂️ 自由扩边/裁切] is active */}
                  {activeTool === "expand" && (
                    <div className="pointer-events-none absolute inset-0 z-20 rounded-xl border-2 border-sky-400/90 shadow-[0_0_0_1px_rgba(15,23,42,0.5)]">
                      {/* Rule-of-Thirds Grid Lines */}
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-sky-300/35" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-sky-300/35" />
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-sky-300/35" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-sky-300/35" />

                      {/* Inner Original Image Boundary Box (when margin is expanded) */}
                      {marginRecord && marginRecord.mode !== "none" && (
                        <div
                          style={innerFrameStyle}
                          className="absolute border border-dashed border-amber-300/80 bg-amber-400/5"
                        >
                          <span className="absolute left-1.5 top-1 rounded bg-slate-950/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                            原图边界 {origW}×{origH}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 8 Engineering Drag Handles around the outer stage boundary */}
                {activeTool === "expand" &&
                  handleDefinitions.map((h) => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => startHandleDrag(e, h.id)}
                      onPointerMove={moveHandleDrag}
                      onPointerUp={endHandleDrag}
                      onPointerCancel={endHandleDrag}
                      className={`absolute z-30 ${h.posClass} ${h.cursorClass} flex items-center justify-center touch-none select-none group`}
                      style={{ width: 24, height: 24 }}
                      title="向外拖动拉出留白像素，向内拖动裁切；按住 Alt 键两侧对称联动"
                    >
                      <span
                        className={`block rounded-xs border-2 border-slate-950 bg-white shadow-md transition-transform group-hover:scale-125 group-active:scale-125 group-active:bg-sky-400 ${
                          h.isCorner ? "h-3.5 w-3.5" : "h-3 w-3"
                        }`}
                      />
                    </div>
                  ))}
              </div>
            </div>

            {/* Tonal Gradient Bar Toggle for Selected Card */}
            {activeAssigned && (
              <div className="bp-subcard flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs">
                  <SparkleIcon className="h-4 w-4 text-[var(--accent-color)] shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    悬浮色卡明暗三阶色条 (高光 / 主色 / 阴影)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleActiveTonalGradient}
                  className={`rounded-full px-3 py-1 text-xs font-extrabold transition-colors cursor-pointer ${
                    hasTonal
                      ? "bp-pill-active bg-[var(--accent-color)] text-white shadow-xs"
                      : "bp-pill bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {hasTonal ? "已开启明暗条" : "开启明暗条"}
                </button>
              </div>
            )}

            {onSaveToProject && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSaveToProject();
                }}
                className="bp-pill-active w-full flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-color)] hover:opacity-95 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm transition cursor-pointer"
              >
                <FolderPlusIcon className="h-4 w-4 shrink-0" weight="bold" />
                <span>存入涂装库（添加工序 / 生成二维码名片 / 导出工程）➔</span>
              </button>
            )}
          </div>

          {/* Right 5 cols: SwatchStudioControls */}
          <div className="lg:col-span-5 pr-1 pb-1">
            <SwatchStudioControls
              imageSrc={imageSrc}
              onUpdateImageAndColors={onUpdateImageAndColors}
              colors={colors}
              selectedColor={activeAssigned || selectedColor}
              onSelectColor={onSelectColor}
              onUpdateColors={onUpdateColors}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              canvasSize={canvasSize}
              lang={lang}
              activeCanvasTool={activeTool}
              onToggleCanvasTool={handleToggleTool}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
