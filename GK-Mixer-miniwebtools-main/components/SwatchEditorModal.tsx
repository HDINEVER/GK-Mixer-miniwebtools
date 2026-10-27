import React, { useEffect, useMemo, useRef, useState } from "react";
import { CatalogPaint, ColorData, Language, TonalStep } from "../types";
import { ExtractMarkerOverlay } from "./ExtractMarkerOverlay";
import { SwatchStudioControls } from "./SwatchStudioControls";
import {
  buildExtendedMarginCanvasAndColors,
  buildFreeExpandCanvasAndColors,
  CanvasMarginRecord,
  ExpandCropState,
  getCanvasMarginRecord,
  inspectOrSampleImageMargins,
  MarginExtendMode,
  SwatchSettings,
} from "../utils/swatchLayout";
import {
  XIcon,
  SparkleIcon,
  FolderPlusIcon,
  ArrowCounterClockwiseIcon,
  ScissorsIcon,
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
  latestState: ExpandCropState;
  origW: number;
  origH: number;
  availW: number;
  availH: number;
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
  onSaveToProject,
}) => {
  const stageViewportRef = useRef<HTMLDivElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);

  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 600, h: 450 });
  const [stageViewportSize, setStageViewportSize] = useState<{ w: number; h: number }>({ w: 680, h: 480 });
  const [activeTool, setActiveTool] = useState<"none" | "expand">("expand");

  // Margin & 8-Handle Out-of-Bounds Expand State
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
  const [blankCustomColor, setBlankCustomColor] = useState<string | null>(null);
  const [isSymmetricExpand, setIsSymmetricExpand] = useState<boolean>(true);
  const [liveDragState, setLiveDragState] = useState<{
    handle: HandleId;
    state: ExpandCropState;
    hudText: string;
    availW: number;
    availH: number;
  } | null>(null);
  const handleDragRef = useRef<ActiveHandleDrag | null>(null);
  const [isProcessingCanvas, setIsProcessingCanvas] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [naturalImgSize, setNaturalImgSize] = useState<{ w: number; h: number } | null>(null);

  // Sync margin record when imageSrc changes
  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const existing = getCanvasMarginRecord(imageSrc);
    if (existing) {
      setMarginRecord(existing);
      if (existing.expandState) {
        setExpandState({
          ...existing.expandState,
          leftPx: Math.max(0, existing.expandState.leftPx),
          rightPx: Math.max(0, existing.expandState.rightPx),
          topPx: Math.max(0, existing.expandState.topPx),
          bottomPx: Math.max(0, existing.expandState.bottomPx),
        });
      }
      setBlankCustomColor(existing.customColor ?? null);
      return;
    }
    inspectOrSampleImageMargins(imageSrc).then((rec) => {
      if (cancelled || !rec) return;
      setMarginRecord(rec);
      if (rec.expandState) {
        setExpandState({
          ...rec.expandState,
          leftPx: Math.max(0, rec.expandState.leftPx),
          rightPx: Math.max(0, rec.expandState.rightPx),
          topPx: Math.max(0, rec.expandState.topPx),
          bottomPx: Math.max(0, rec.expandState.bottomPx),
        });
      }
      setBlankCustomColor(rec.customColor ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  useEffect(() => {
    if (!isOpen) return;
    const vp = stageViewportRef.current;
    const update = () => {
      if (vp) {
        const vRect = vp.getBoundingClientRect();
        if (vRect.width > 20 && vRect.height > 20) {
          setStageViewportSize({ w: vRect.width, h: vRect.height });
        }
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (vp) ro.observe(vp);
    return () => ro.disconnect();
  }, [isOpen, imageSrc]);

  const showQuickToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 2200);
  };

  const assignedColors = useMemo(
    () => (colors || []).filter((c): c is ColorData & { assignedPaint: CatalogPaint } => !!c.assignedPaint),
    [colors]
  );
  const activeAssigned =
    selectedColor && selectedColor.assignedPaint
      ? selectedColor
      : assignedColors[0] || null;

  const hasTonal = !!(activeAssigned?.tonalGradient && activeAssigned.tonalGradient.length > 0);

  const origW = marginRecord?.origWidth || naturalImgSize?.w || 1000;
  const origH = marginRecord?.origHeight || naturalImgSize?.h || 800;
  const activeExpand = liveDragState ? liveDragState.state : expandState;
  const totalStageW = Math.max(64, origW + activeExpand.leftPx + activeExpand.rightPx);
  const totalStageH = Math.max(64, origH + activeExpand.topPx + activeExpand.bottomPx);
  const resolvedBlankHex =
    blankCustomColor || marginRecord?.sampledEdgeColors?.overall || expandState.fillColor || "#F1F5F9";

  // Unified stage geometry for BOTH live drag and committed state so releasing the mouse never snaps back
  const stageDisplayBox = useMemo(() => {
    const cur = liveDragState ? liveDragState.state : expandState;
    const nextW = Math.max(64, origW + cur.leftPx + cur.rightPx);
    const nextH = Math.max(64, origH + cur.topPx + cur.bottomPx);
    const availW = liveDragState
      ? liveDragState.availW
      : Math.max(240, stageViewportSize.w - 40);
    const cssMaxH =
      typeof window !== "undefined"
        ? window.innerHeight * (window.innerWidth >= 1024 ? 0.54 : 0.42)
        : 460;
    const availH = liveDragState
      ? liveDragState.availH
      : Math.max(220, Math.min(cssMaxH, stageViewportSize.h - 36));
    const fitScale = Math.min(availW / nextW, availH / nextH);
    return {
      stageScreenW: Math.max(80, Math.round(nextW * fitScale)),
      stageScreenH: Math.max(80, Math.round(nextH * fitScale)),
      origLeftScreen: Math.round(cur.leftPx * fitScale),
      origTopScreen: Math.round(cur.topPx * fitScale),
      origScreenW: Math.max(40, Math.round(origW * fitScale)),
      origScreenH: Math.max(40, Math.round(origH * fitScale)),
      availW,
      availH,
    };
  }, [liveDragState, expandState, origW, origH, stageViewportSize]);

  useEffect(() => {
    if (stageDisplayBox.stageScreenW > 10 && stageDisplayBox.stageScreenH > 10) {
      setCanvasSize({
        w: stageDisplayBox.stageScreenW,
        h: stageDisplayBox.stageScreenH,
      });
    }
  }, [stageDisplayBox.stageScreenW, stageDisplayBox.stageScreenH]);

  const innerFrameStyle = useMemo(() => {
    const cur = liveDragState ? liveDragState.state : expandState;
    const nextW = Math.max(64, origW + cur.leftPx + cur.rightPx);
    const nextH = Math.max(64, origH + cur.topPx + cur.bottomPx);
    return {
      left: `${Math.max(0, Math.min(100, (cur.leftPx / nextW) * 100))}%`,
      top: `${Math.max(0, Math.min(100, (cur.topPx / nextH) * 100))}%`,
      width: `${Math.max(5, Math.min(100, (origW / nextW) * 100))}%`,
      height: `${Math.max(5, Math.min(100, (origH / nextH) * 100))}%`,
    };
  }, [liveDragState, expandState, origW, origH]);

  const commitFreeExpandRef = useRef<
    (nextState: ExpandCropState, customColorOverride?: string | null, autoArrange?: boolean) => Promise<void>
  >(async () => {});
  const isSymmetricExpandRef = useRef(isSymmetricExpand);
  isSymmetricExpandRef.current = isSymmetricExpand;
  const resolvedBlankHexRef = useRef(resolvedBlankHex);
  resolvedBlankHexRef.current = resolvedBlankHex;
  const blankCustomColorRef = useRef(blankCustomColor);
  blankCustomColorRef.current = blankCustomColor;

  // Global window pointermove / pointerup so dragging handles outside the box never drops or snaps back
  useEffect(() => {
    if (!isOpen) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const drag = handleDragRef.current;
      if (!drag) return;
      e.preventDefault();

      const dxPx = Math.round((e.clientX - drag.startClientX) * drag.pxPerScreenPx);
      const dyPx = Math.round((e.clientY - drag.startClientY) * drag.pxPerScreenPx);
      const symmetric = e.altKey || isSymmetricExpandRef.current;

      const maxExpandX = Math.round(drag.origW * 1.5);
      const maxExpandY = Math.round(drag.origH * 1.5);
      const clampX = (v: number) => Math.max(0, Math.min(maxExpandX, v));
      const clampY = (v: number) => Math.max(0, Math.min(maxExpandY, v));

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
        fillColor: resolvedBlankHexRef.current,
      };

      drag.latestState = nextState;

      const nextStageW = Math.max(64, drag.origW + leftPx + rightPx);
      const nextStageH = Math.max(64, drag.origH + topPx + bottomPx);

      const parts: string[] = [];
      if (h.includes("w") || (symmetric && h.includes("e"))) parts.push(`← 左扩 +${leftPx}px`);
      if (h.includes("e") || (symmetric && h.includes("w"))) parts.push(`右扩 → +${rightPx}px`);
      if (h.includes("n") || (symmetric && h.includes("s"))) parts.push(`↑ 上扩 +${topPx}px`);
      if (h.includes("s") || (symmetric && h.includes("n"))) parts.push(`↓ 下扩 +${bottomPx}px`);

      setLiveDragState({
        handle: h,
        state: nextState,
        hudText: `${parts.join(" · ")} · 总画布 ${nextStageW} × ${nextStageH}`,
        availW: drag.availW,
        availH: drag.availH,
      });
    };

    const onWindowPointerUp = async () => {
      const drag = handleDragRef.current;
      if (!drag) return;
      handleDragRef.current = null;

      const committed = drag.latestState;
      const changed =
        committed.leftPx !== drag.initialState.leftPx ||
        committed.rightPx !== drag.initialState.rightPx ||
        committed.topPx !== drag.initialState.topPx ||
        committed.bottomPx !== drag.initialState.bottomPx;

      setExpandState(committed);
      setLiveDragState(null);

      if (changed) {
        await commitFreeExpandRef.current(committed, blankCustomColorRef.current, true);
      }
    };

    window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
    };
  }, [isOpen]);

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

  const handleToggleTool = (tool: "expand") => {
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
        blankCustomColor,
        settings.cardScale,
        settings.cardBaseWidth,
        "solid"
      );
      setMarginRecord(res.record);
      if (res.record.expandState) {
        setExpandState(res.record.expandState);
      }
      onUpdateImageAndColors(res.imageSrc, res.colors);
      showQuickToast(
        mode === "none"
          ? "已恢复原图尺寸"
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
    customColorOverride?: string | null,
    autoArrange = true
  ) => {
    if (!imageSrc || !onUpdateImageAndColors || isProcessingCanvas) return;
    setIsProcessingCanvas(true);
    try {
      const safeState: ExpandCropState = {
        ...nextState,
        leftPx: Math.max(0, Math.round(nextState.leftPx)),
        rightPx: Math.max(0, Math.round(nextState.rightPx)),
        topPx: Math.max(0, Math.round(nextState.topPx)),
        bottomPx: Math.max(0, Math.round(nextState.bottomPx)),
      };
      const isZero =
        safeState.leftPx === 0 &&
        safeState.rightPx === 0 &&
        safeState.topPx === 0 &&
        safeState.bottomPx === 0;
      const effectiveColor =
        customColorOverride !== undefined ? customColorOverride : blankCustomColor;
      const res = await buildFreeExpandCanvasAndColors(
        imageSrc,
        colors,
        safeState,
        settings.cardScale,
        settings.cardBaseWidth,
        isZero ? "none" : "custom",
        effectiveColor,
        autoArrange
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
  commitFreeExpandRef.current = handleCommitFreeExpand;

  const handleChangeBlankColor = async (nextColor: string | null) => {
    setBlankCustomColor(nextColor);
    const nextFillHex =
      nextColor || marginRecord?.sampledEdgeColors?.overall || "#F1F5F9";

    const hasMargin =
      expandState.leftPx > 0 ||
      expandState.rightPx > 0 ||
      expandState.topPx > 0 ||
      expandState.bottomPx > 0;

    const defaultSidePx = Math.max(80, Math.round(origW * 0.28));
    const updatedExpand: ExpandCropState = hasMargin
      ? {
          ...expandState,
          fillMode: "solid",
          fillColor: nextFillHex,
        }
      : {
          leftPx: defaultSidePx,
          rightPx: defaultSidePx,
          topPx: 0,
          bottomPx: 0,
          fillMode: "solid",
          fillColor: nextFillHex,
        };

    setExpandState(updatedExpand);
    if (!hasMargin) {
      setActiveTool("expand");
    }
    await handleCommitFreeExpand(updatedExpand, nextColor, !hasMargin);
  };

  // 8-Handle Pointer Down (move & up are handled on window so dragging never drops or snaps back)
  const startHandleDrag = (e: React.PointerEvent<HTMLDivElement>, handle: HandleId) => {
    if (isProcessingCanvas) return;
    e.preventDefault();
    e.stopPropagation();

    const startScreenW = Math.max(80, stageDisplayBox.stageScreenW);
    const availW = stageDisplayBox.availW;
    const availH = stageDisplayBox.availH;

    const safeInitial: ExpandCropState = {
      ...expandState,
      leftPx: Math.max(0, expandState.leftPx),
      rightPx: Math.max(0, expandState.rightPx),
      topPx: Math.max(0, expandState.topPx),
      bottomPx: Math.max(0, expandState.bottomPx),
      fillMode: "solid",
      fillColor: resolvedBlankHex,
    };

    const curStageW = Math.max(64, origW + safeInitial.leftPx + safeInitial.rightPx);
    const pxPerScreenPx = curStageW / startScreenW;

    handleDragRef.current = {
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      pxPerScreenPx,
      initialState: safeInitial,
      latestState: safeInitial,
      origW,
      origH,
      availW,
      availH,
    };
  };

  const handleDefinitions: Array<{
    id: HandleId;
    posClass: string;
    cursorClass: string;
    isCorner: boolean;
  }> = [
    { id: "nw", posClass: "-top-2.5 -left-2.5", cursorClass: "cursor-nwse-resize", isCorner: true },
    { id: "n", posClass: "-top-2.5 left-1/2 -translate-x-1/2", cursorClass: "cursor-ns-resize", isCorner: false },
    { id: "ne", posClass: "-top-2.5 -right-2.5", cursorClass: "cursor-nesw-resize", isCorner: true },
    { id: "e", posClass: "top-1/2 -right-2.5 -translate-y-1/2", cursorClass: "cursor-ew-resize", isCorner: false },
    { id: "se", posClass: "-bottom-2.5 -right-2.5", cursorClass: "cursor-nwse-resize", isCorner: true },
    { id: "s", posClass: "-bottom-2.5 left-1/2 -translate-x-1/2", cursorClass: "cursor-ns-resize", isCorner: false },
    { id: "sw", posClass: "-bottom-2.5 -left-2.5", cursorClass: "cursor-nesw-resize", isCorner: true },
    { id: "w", posClass: "top-1/2 -left-2.5 -translate-y-1/2", cursorClass: "cursor-ew-resize", isCorner: false },
  ];

  const isExpandedMargin =
    expandState.leftPx > 0 ||
    expandState.rightPx > 0 ||
    expandState.topPx > 0 ||
    expandState.bottomPx > 0 ||
    (marginRecord && marginRecord.mode !== "none");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-md p-0 sm:p-4 animate-fadeIn">
      <div className="bp-modal-shell relative flex flex-col w-full max-w-6xl max-h-[94dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-3xl bg-slate-50 dark:bg-slate-950 border border-white/30 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="bp-modal-header flex items-center justify-between px-4 sm:px-6 py-3 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="bp-dot h-2.5 w-2.5 rounded-full bg-[var(--accent-color)] shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
              <span className="tech-prefix">[SWATCH STUDIO]</span>
              {title}
            </h2>
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
          {/* Left 7 cols: Interactive Out-of-Bounds Expand Canvas Stage */}
          <div className="lg:col-span-7 space-y-2.5 lg:sticky lg:top-0 pr-1 pb-1">
            {/* Streamlined Top Bar: Outer Dimension Expansion + Blank Area Color (Orig / White / Black / Custom) */}
            {onUpdateImageAndColors && (
              <div className="bp-subcard rounded-2xl border border-slate-200/85 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleToggleTool("expand")}
                    className={`bp-btn inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                      activeTool === "expand"
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-xs"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)]"
                    }`}
                    title="开启四周 8 手柄自由拖拽扩边，向外拉出留白区域"
                  >
                    <ScissorsIcon className="h-3.5 w-3.5 shrink-0" weight="bold" />
                    <span>✂️ 自由拖拽扩边</span>
                  </button>

                  {activeTool === "expand" && (
                    <button
                      type="button"
                      onClick={() => setIsSymmetricExpand((v) => !v)}
                      className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                        isSymmetricExpand
                          ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                      title="开启后拖动单侧手柄时，左右或上下两侧同步等距向外放大"
                    >
                      <ArrowsOutLineHorizontalIcon className="h-3 w-3" weight="bold" />
                      <span>对称联动</span>
                    </button>
                  )}

                  {isExpandedMargin && (
                    <button
                      type="button"
                      disabled={isProcessingCanvas}
                      onClick={() => handleQuickMarginPreset("none")}
                      className="bp-btn inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer"
                    >
                      <ArrowCounterClockwiseIcon className="h-3 w-3 shrink-0" weight="bold" />
                      <span>恢复原图</span>
                    </button>
                  )}
                </div>

                {/* Blank Area Color Quick Selector: Original Edge Color / White / Black / Custom */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 mr-0.5">空白区域颜色:</span>
                  <button
                    type="button"
                    disabled={isProcessingCanvas}
                    onClick={() => handleChangeBlankColor(null)}
                    className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      blankCustomColor === null
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                    title="自动贴合原图四边背景色"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/20 shrink-0"
                      style={{
                        backgroundColor: marginRecord?.sampledEdgeColors?.overall || "#F1F5F9",
                      }}
                    />
                    <span>原图色</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingCanvas}
                    onClick={() => handleChangeBlankColor("#FFFFFF")}
                    className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      blankCustomColor?.toUpperCase() === "#FFFFFF"
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                    title="纯白背景 (#FFFFFF)"
                  >
                    <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white shrink-0" />
                    <span>白</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingCanvas}
                    onClick={() => handleChangeBlankColor("#111827")}
                    className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      blankCustomColor?.toUpperCase() === "#111827"
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                    title="纯黑背景 (#111827)"
                  >
                    <span className="h-2.5 w-2.5 rounded-full border border-slate-600 bg-[#111827] shrink-0" />
                    <span>黑</span>
                  </button>
                  <label
                    className="relative flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer shadow-2xs"
                    title="自定义空白区颜色"
                  >
                    <input
                      type="color"
                      value={resolvedBlankHex}
                      onChange={(e) => handleChangeBlankColor(e.target.value.toUpperCase())}
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
                </div>
              </div>
            )}

            {/* Main Interactive Canvas Stage with 8-Handle Outward Expand */}
            <div
              ref={stageViewportRef}
              className="bp-canvas-stage relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-900/95 p-3 sm:p-5 shadow-inner flex items-center justify-center overflow-hidden min-h-[300px] sm:min-h-[380px]"
            >
              {/* Live Dimension Ruler HUD or Status Toast */}
              {(liveDragState || statusToast || activeTool === "expand") && (
                <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/85 px-3 py-1 font-mono text-[11px] font-extrabold text-white shadow-lg backdrop-blur-md whitespace-nowrap">
                  {liveDragState ? (
                    <span className="text-sky-300">{liveDragState.hudText}</span>
                  ) : statusToast ? (
                    <span className="text-emerald-300">{statusToast}</span>
                  ) : (
                    <span>
                      ✂️ 拖动四周手柄自由调节留白尺寸 · 总画布 {totalStageW} × {totalStageH}
                    </span>
                  )}
                </div>
              )}

              {/* Unified Stage Wrapper: Always uses exact stageDisplayBox so releasing handle never snaps back */}
              <div
                ref={imgContainerRef}
                style={{
                  width: stageDisplayBox.stageScreenW,
                  height: stageDisplayBox.stageScreenH,
                  backgroundColor: resolvedBlankHex,
                }}
                className="relative rounded-xl"
              >
                {liveDragState || isProcessingCanvas ? (
                  /* Live Drag / Processing Preview: Outer Blank Stage + Original Image Positioned Inside */
                  <div className="relative w-full h-full rounded-xl overflow-hidden border-2 border-sky-400">
                    <img
                      src={marginRecord?.originalImageSrc || imageSrc}
                      alt="Original Preview"
                      style={{
                        position: "absolute",
                        left: stageDisplayBox.origLeftScreen,
                        top: stageDisplayBox.origTopScreen,
                        width: stageDisplayBox.origScreenW,
                        height: stageDisplayBox.origScreenH,
                      }}
                      className="block select-none pointer-events-none border border-dashed border-amber-300/80"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <img
                      ref={imgElRef}
                      src={imageSrc}
                      alt="Swatch Canvas"
                      onLoad={(e) => {
                        const nw = e.currentTarget.naturalWidth;
                        const nh = e.currentTarget.naturalHeight;
                        if (nw > 0 && nh > 0 && !marginRecord) {
                          setNaturalImgSize({ w: nw, h: nh });
                        }
                      }}
                      className="bp-swatch block w-full h-full object-contain rounded-xl select-none"
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
                      interactive={true}
                      allowDrag={true}
                    />

                    {/* Rule-of-Thirds Grid & Original Image Boundary when [✂️ 自由拖拽扩边] is active */}
                    {activeTool === "expand" && (
                      <div className="pointer-events-none absolute inset-0 z-20 rounded-xl border-2 border-sky-400/90 shadow-[0_0_0_1px_rgba(15,23,42,0.5)]">
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-sky-300/35" />
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-sky-300/35" />
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-sky-300/35" />
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-sky-300/35" />

                        {isExpandedMargin && (
                          <div
                            style={innerFrameStyle}
                            className="absolute border border-dashed border-amber-300/80 bg-amber-400/5"
                          >
                            <span className="absolute left-1.5 top-1 rounded bg-slate-950/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                              原图 {origW}×{origH}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 8 Engineering Drag Handles around the outer stage boundary */}
                {activeTool === "expand" &&
                  handleDefinitions.map((h) => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => startHandleDrag(e, h.id)}
                      className={`absolute z-30 ${h.posClass} ${h.cursorClass} flex items-center justify-center touch-none select-none group`}
                      style={{ width: 28, height: 28 }}
                      title="拖动自由调节外部留白区域尺寸"
                    >
                      <span
                        className={`block rounded-xs border-2 border-slate-950 bg-white shadow-md transition-transform group-hover:scale-125 ${
                          liveDragState?.handle === h.id ? "scale-125 bg-sky-400" : ""
                        } ${h.isCorner ? "h-3.5 w-3.5" : "h-3 w-3"}`}
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
              blankCustomColor={blankCustomColor}
              onChangeBlankColor={handleChangeBlankColor}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
