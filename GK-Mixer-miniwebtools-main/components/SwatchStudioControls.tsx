import React, { useEffect, useRef, useState } from "react";
import { CatalogPaint, ColorData, Language } from "../types";
import { translations } from "../utils/translations";
import {
  alignMarkers,
  arrangeCardsIntoMarginZone,
  autoArrangeLeftRight,
  autoArrangeTopBottom,
  buildExtendedMarginCanvasAndColors,
  buildFreeExpandCanvasAndColors,
  ExpandFillMode,
  ExtractLeaderLineStyle,
  getCanvasMarginRecord,
  getCanvasScale,
  getCardBaseDimensions,
  inspectOrSampleImageMargins,
  MarginExtendMode,
  resetMarkerPositions,
  SampledEdgeColors,
  SwatchSettings,
} from "../utils/swatchLayout";
import { localizedBrand } from "../utils/paintCatalog";
import {
  SparkleIcon,
  ArrowLeftIcon,
  ArrowsHorizontalIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowsVerticalIcon,
  ArrowDownIcon,
  ArrowCounterClockwiseIcon,
  CardsIcon,
  ColumnsIcon,
  RowsIcon,
  CaretDownIcon,
  FrameCornersIcon,
} from "@phosphor-icons/react";

export interface SwatchStudioControlsProps {
  settings: SwatchSettings;
  onChangeSettings?: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  onUpdateSettings?: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  onAutoArrangeLR?: () => void;
  onAutoArrangeTB?: () => void;
  onAlign?: (alignment: "left" | "right" | "top" | "bottom" | "autoH" | "autoV") => void;
  onResetPositions?: () => void;
  lang: Language;
  assignedCount?: number;
  className?: string;
  isCompact?: boolean;
  variant?: "toolbar" | "sidebar";
  // Optional direct colors control (used in SwatchEditorModal)
  imageSrc?: string;
  onUpdateImageAndColors?: (newImageSrc: string, nextColors: ColorData[]) => void;
  colors?: ColorData[];
  selectedColor?: ColorData | null;
  onSelectColor?: (color: ColorData) => void;
  onUpdateColors?: (updater: (prev: ColorData[]) => ColorData[]) => void;
  canvasSize?: { w: number; h: number };
  onExportImage?: () => void;
  isExporting?: boolean;
  activeCanvasTool?: "none" | "expand";
  onToggleCanvasTool?: (tool: "expand") => void;
  blankCustomColor?: string | null;
  onChangeBlankColor?: (nextColor: string | null) => void;
}

export const SwatchStudioControls: React.FC<SwatchStudioControlsProps> = ({
  settings,
  onChangeSettings,
  onUpdateSettings,
  onAutoArrangeLR,
  onAutoArrangeTB,
  onAlign,
  onResetPositions,
  lang,
  assignedCount: assignedCountProp,
  className = "",
  isCompact = false,
  variant = "toolbar",
  imageSrc,
  onUpdateImageAndColors,
  colors,
  selectedColor,
  onSelectColor,
  onUpdateColors,
  canvasSize = { w: 600, h: 450 },
  onExportImage,
  isExporting,
  activeCanvasTool = "none",
  onToggleCanvasTool,
  blankCustomColor,
  onChangeBlankColor,
}) => {
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);
  const existingMarginRecord = imageSrc ? getCanvasMarginRecord(imageSrc) : undefined;
  const [marginMode, setMarginMode] = useState<MarginExtendMode>(
    existingMarginRecord?.mode || "none"
  );
  const [marginRatio, setMarginRatio] = useState<number>(
    existingMarginRecord?.ratio || 0.36
  );
  const [marginCustomColor, setMarginCustomColor] = useState<string | null>(
    blankCustomColor !== undefined ? blankCustomColor : existingMarginRecord?.customColor ?? null
  );
  const [marginFillMode, setMarginFillMode] = useState<ExpandFillMode>(
    existingMarginRecord?.expandState?.fillMode || "solid"
  );
  const [sampledEdgeColors, setSampledEdgeColors] = useState<SampledEdgeColors | null>(
    existingMarginRecord?.sampledEdgeColors ?? null
  );
  const [isApplyingMargin, setIsApplyingMargin] = useState<boolean>(false);

  useEffect(() => {
    if (blankCustomColor !== undefined) {
      setMarginCustomColor(blankCustomColor);
    }
  }, [blankCustomColor]);

  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    const rec = getCanvasMarginRecord(imageSrc);
    if (rec) {
      setMarginMode(rec.mode);
      setMarginRatio(rec.ratio);
      if (blankCustomColor === undefined) {
        setMarginCustomColor(rec.customColor);
      }
      setMarginFillMode(rec.expandState?.fillMode || "solid");
      setSampledEdgeColors(rec.sampledEdgeColors);
      return;
    }
    inspectOrSampleImageMargins(imageSrc).then((sampledRec) => {
      if (cancelled || !sampledRec) return;
      setMarginMode(sampledRec.mode);
      setMarginRatio(sampledRec.ratio);
      if (blankCustomColor === undefined) {
        setMarginCustomColor(sampledRec.customColor);
      }
      setMarginFillMode(sampledRec.expandState?.fillMode || "solid");
      setSampledEdgeColors(sampledRec.sampledEdgeColors);
    });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, blankCustomColor]);

  const handleApplyMarginExtension = async (
    nextMode: MarginExtendMode,
    nextRatio: number = marginRatio,
    nextCustomColor: string | null = marginCustomColor,
    nextFillMode: ExpandFillMode = "solid"
  ) => {
    if (!imageSrc || !colors || !onUpdateImageAndColors || isApplyingMargin) return;
    setIsApplyingMargin(true);
    setMarginMode(nextMode);
    setMarginRatio(nextRatio);
    setMarginCustomColor(nextCustomColor);
    setMarginFillMode(nextFillMode);
    try {
      const res = await buildExtendedMarginCanvasAndColors(
        imageSrc,
        colors,
        nextMode,
        nextRatio,
        nextCustomColor,
        settings.cardScale,
        settings.cardBaseWidth,
        nextFillMode
      );
      setSampledEdgeColors(res.record.sampledEdgeColors);
      onUpdateImageAndColors(res.imageSrc, res.colors);
    } catch (err) {
      console.error("[SwatchStudioControls] Margin extension failed:", err);
    } finally {
      setIsApplyingMargin(false);
    }
  };

  const handleSelectBlankColor = async (nextColor: string | null) => {
    setMarginCustomColor(nextColor);
    if (onChangeBlankColor) {
      onChangeBlankColor(nextColor);
      return;
    }
    if (!imageSrc || !colors || !onUpdateImageAndColors || isApplyingMargin) return;
    const rec = getCanvasMarginRecord(imageSrc);
    const hasExpanded =
      rec &&
      rec.mode !== "none" &&
      rec.expandState &&
      (rec.expandState.leftPx > 0 ||
        rec.expandState.rightPx > 0 ||
        rec.expandState.topPx > 0 ||
        rec.expandState.bottomPx > 0);
    if (!hasExpanded) {
      await handleApplyMarginExtension("leftRight", marginRatio, nextColor, "solid");
      return;
    }

    setIsApplyingMargin(true);
    try {
      const res = await buildFreeExpandCanvasAndColors(
        imageSrc,
        colors,
        {
          ...rec.expandState!,
          fillMode: "solid",
          fillColor: nextColor || rec.sampledEdgeColors.overall,
        },
        settings.cardScale,
        settings.cardBaseWidth,
        rec.mode,
        nextColor,
        false
      );
      setSampledEdgeColors(res.record.sampledEdgeColors);
      onUpdateImageAndColors(res.imageSrc, res.colors);
    } catch (err) {
      console.error("[SwatchStudioControls] Update blank color failed:", err);
    } finally {
      setIsApplyingMargin(false);
    }
  };
  const t = translations[lang] || translations.zh;
  const updateSettings = onChangeSettings || onUpdateSettings || (() => {});

  const assignedColors = (colors || []).filter(
    (c): c is ColorData & { sampleX: number; sampleY: number; assignedPaint: CatalogPaint } =>
      Number.isFinite(c.sampleX) && Number.isFinite(c.sampleY) && !!c.assignedPaint
  );

  const assignedCount = assignedCountProp ?? assignedColors.length;
  const activeAssigned =
    selectedColor && selectedColor.assignedPaint
      ? selectedColor
      : assignedColors[0] || null;

  const { w: cw, h: ch } = canvasSize;
  const { baseW, baseH } = getCardBaseDimensions(settings.cardBaseWidth);
  const s = getCanvasScale(cw, ch, baseW);
  const effectiveScale = activeAssigned
    ? activeAssigned.labelScale ?? settings.cardScale
    : settings.cardScale;
  const cardWNorm = cw > 0 ? (baseW * s * effectiveScale) / cw : 0.2;
  const cardHNorm = ch > 0 ? (baseH * s * effectiveScale) / ch : 0.1;
  const maxX = Math.max(0.01, 1 - cardWNorm);
  const maxY = Math.max(0.01, 1 - cardHNorm);

  const curNx =
    activeAssigned && typeof activeAssigned.labelNx === "number"
      ? activeAssigned.labelNx
      : activeAssigned && typeof activeAssigned.sampleX === "number"
      ? activeAssigned.sampleX > 0.55
        ? Math.max(0.01, activeAssigned.sampleX - cardWNorm - 0.03)
        : Math.min(maxX, activeAssigned.sampleX + 0.03)
      : 0.1;

  const curNy =
    activeAssigned && typeof activeAssigned.labelNy === "number"
      ? activeAssigned.labelNy
      : activeAssigned && typeof activeAssigned.sampleY === "number"
      ? Math.min(maxY, Math.max(0.01, activeAssigned.sampleY - cardHNorm / 2))
      : 0.1;

  const triggerAutoArrangeLR = () => {
    if (onAutoArrangeLR) {
      onAutoArrangeLR();
      return;
    }
    if (!onUpdateColors) return;
    const rec = imageSrc ? getCanvasMarginRecord(imageSrc) : undefined;
    if (rec && (rec.mode !== "none" || rec.innerLeftNx > 0.05 || rec.innerWidthNw < 0.94)) {
      const arranged = arrangeCardsIntoMarginZone(
        assignedColors,
        rec,
        cw,
        ch,
        settings.cardScale,
        settings.cardBaseWidth,
        "leftRight"
      );
      onUpdateColors((prev) =>
        prev.map((c) =>
          arranged[c.id] ? { ...c, labelNx: arranged[c.id].nx, labelNy: arranged[c.id].ny } : c
        )
      );
      return;
    }
    const markers = assignedColors.map((c) => ({
      id: c.id,
      nx: c.sampleX,
      ny: c.sampleY,
      paint: c.assignedPaint,
    }));
    const arranged = autoArrangeLeftRight(
      markers,
      cw,
      ch,
      settings.cardScale,
      12,
      settings.cardBaseWidth
    );
    onUpdateColors((prev) =>
      prev.map((c) =>
        arranged[c.id] ? { ...c, labelNx: arranged[c.id].nx, labelNy: arranged[c.id].ny } : c
      )
    );
  };

  const triggerAutoArrangeTB = () => {
    if (onAutoArrangeTB) {
      onAutoArrangeTB();
      return;
    }
    if (!onUpdateColors) return;
    const rec = imageSrc ? getCanvasMarginRecord(imageSrc) : undefined;
    if (rec && (rec.mode !== "none" || rec.innerTopNy > 0.05 || rec.innerHeightNh < 0.94)) {
      const arranged = arrangeCardsIntoMarginZone(
        assignedColors,
        rec,
        cw,
        ch,
        settings.cardScale,
        settings.cardBaseWidth,
        "topBottom"
      );
      onUpdateColors((prev) =>
        prev.map((c) =>
          arranged[c.id] ? { ...c, labelNx: arranged[c.id].nx, labelNy: arranged[c.id].ny } : c
        )
      );
      return;
    }
    const markers = assignedColors.map((c) => ({
      id: c.id,
      nx: c.sampleX,
      ny: c.sampleY,
      paint: c.assignedPaint,
    }));
    const arranged = autoArrangeTopBottom(
      markers,
      cw,
      ch,
      settings.cardScale,
      12,
      settings.cardBaseWidth
    );
    onUpdateColors((prev) =>
      prev.map((c) =>
        arranged[c.id] ? { ...c, labelNx: arranged[c.id].nx, labelNy: arranged[c.id].ny } : c
      )
    );
  };

  const triggerAlign = (alignment: "left" | "right" | "top" | "bottom" | "autoH" | "autoV") => {
    if (onAlign) {
      onAlign(alignment);
      return;
    }
    if (!onUpdateColors) return;
    const markers = assignedColors.map((c) => ({
      id: c.id,
      nx: c.sampleX,
      ny: c.sampleY,
      labelNx: c.labelNx,
      labelNy: c.labelNy,
      paint: c.assignedPaint,
    }));
    const targetId = applyToAll ? undefined : activeAssigned?.id;
    const aligned = alignMarkers(
      markers,
      alignment,
      cw,
      ch,
      settings.cardScale,
      targetId,
      12,
      settings.cardBaseWidth
    );
    onUpdateColors((prev) =>
      prev.map((c) =>
        aligned[c.id] ? { ...c, labelNx: aligned[c.id].nx, labelNy: aligned[c.id].ny } : c
      )
    );
  };

  const triggerReset = () => {
    if (onResetPositions) {
      onResetPositions();
      return;
    }
    if (!onUpdateColors) return;
    const markers = assignedColors.map((c) => ({
      id: c.id,
      nx: c.sampleX,
      ny: c.sampleY,
    }));
    const targetId = applyToAll ? undefined : activeAssigned?.id;
    const reset = resetMarkerPositions(
      markers,
      cw,
      ch,
      settings.cardScale,
      targetId,
      settings.cardBaseWidth
    );
    onUpdateColors((prev) =>
      prev.map((c) =>
        reset[c.id]
          ? {
              ...c,
              labelNx: reset[c.id].nx,
              labelNy: reset[c.id].ny,
              labelScale: applyToAll ? undefined : c.id === activeAssigned?.id ? undefined : c.labelScale,
            }
          : c
      )
    );
  };

  const sliderRafRef = useRef<number | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (sliderRafRef.current !== null) {
        cancelAnimationFrame(sliderRafRef.current);
      }
    };
  }, []);

  const scheduleSliderUpdate = (fn: () => void) => {
    pendingActionRef.current = fn;
    if (sliderRafRef.current === null) {
      sliderRafRef.current = requestAnimationFrame(() => {
        sliderRafRef.current = null;
        pendingActionRef.current?.();
      });
    }
  };

  const handleScaleChange = (newScale: number) => {
    const clamped = Math.min(1.6, Math.max(0.6, newScale));
    const targetId = activeAssigned?.id;
    scheduleSliderUpdate(() => {
      if (applyToAll || !targetId || !onUpdateColors) {
        updateSettings((prev) => ({ ...prev, cardScale: clamped }));
        if (onUpdateColors) {
          onUpdateColors((prev) => prev.map((c) => ({ ...c, labelScale: undefined })));
        }
      } else {
        onUpdateColors((prev) =>
          prev.map((c) => (c.id === targetId ? { ...c, labelScale: clamped } : c))
        );
      }
    });
  };

  const handlePosChange = (axis: "x" | "y", val: number) => {
    if (!activeAssigned || !onUpdateColors) return;
    const targetId = activeAssigned.id;
    const clampedVal = axis === "x" ? Math.min(Math.max(0, val), maxX) : Math.min(Math.max(0, val), maxY);
    scheduleSliderUpdate(() => {
      onUpdateColors((prev) =>
        prev.map((c) => {
          if (c.id !== targetId) return c;
          return {
            ...c,
            labelNx: axis === "x" ? clampedVal : c.labelNx ?? curNx,
            labelNy: axis === "y" ? clampedVal : c.labelNy ?? curNy,
          };
        })
      );
    });
  };

  const lineStyles: Array<{
    id: ExtractLeaderLineStyle;
    title: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "stepped",
      title: t.lineStepped || "折线",
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 15h6v-10h8" strokeLinecap="round" strokeLinejoin="miter" />
        </svg>
      ),
    },
    {
      id: "roundedStepped",
      title: t.lineRoundedStepped || "圆角",
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 15h4a2 2 0 0 0 2-2V7a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: "straight",
      title: t.lineStraight || "直线",
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="16" x2="17" y2="4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "curved",
      title: t.lineCurved || "曲线",
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 15 C 9 15, 11 5, 17 5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className={`bp-subcard-lg flex flex-col rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 space-y-3.5 ${className}`}
    >
      {/* Header */}
      <div className="bp-dashed-header flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="bp-swatch flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-color)] text-white shadow-sm">
            <CardsIcon className="h-3.5 w-3.5" weight="bold" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {t.swatchStudio || "色卡制作与排版"}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {assignedCount} {lang === "zh" ? "个色卡" : "cards"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {colors && onUpdateColors && (
            <div className="bp-segmented inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setApplyToAll(false)}
                className={`bp-segmented-item rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                  !applyToAll
                    ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                当前
              </button>
              <button
                type="button"
                onClick={() => setApplyToAll(true)}
                className={`bp-segmented-item rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                  applyToAll
                    ? "bp-segmented-item-active bg-[var(--accent-color)] text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                全部
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={triggerReset}
            className="bp-btn flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="重置色卡至采样点附近位置"
          >
            <ArrowCounterClockwiseIcon className="h-3 w-3" weight="bold" />
            <span>{t.resetLayout || "重置"}</span>
          </button>

          {variant === "toolbar" && isCompact && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <CaretDownIcon
                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Assigned Paint Cards Selector (when colors provided) */}
      {assignedColors.length > 0 && onSelectColor && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pr-1">
          {assignedColors.map((item, idx) => {
            const isSelected = activeAssigned?.id === item.id;
            const p = item.assignedPaint;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectColor(item)}
                className={`bp-subcard bp-subcard-interactive flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left transition-colors shrink-0 border cursor-pointer ${
                  isSelected
                    ? "bp-subcard-active border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 dark:text-white ring-1 ring-[var(--accent-color)]/40 shadow-2xs"
                    : "border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                <span
                  className="bp-swatch h-3.5 w-3.5 rounded border border-black/15 shrink-0"
                  style={{ backgroundColor: p.hex }}
                />
                <div className="min-w-0 max-w-[115px]">
                  <div className="truncate font-mono text-[10px] font-extrabold leading-tight">
                    #{idx + 1} {localizedBrand(p.brand, lang)} {p.code}
                  </div>
                  <div className="truncate text-[9px] text-slate-400 leading-tight">{p.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isExpanded && (
        <div className="space-y-3.5">
          {/* Simplified Outer Dimension Expansion & Blank Area Color Setting */}
          {imageSrc && onUpdateImageAndColors && (
            <div className="bp-subcard rounded-xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FrameCornersIcon className="h-3.5 w-3.5 text-[var(--accent-color)] shrink-0" weight="bold" />
                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate">
                    图片外部尺寸拓展（防遮挡模型）
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onToggleCanvasTool && (
                    <button
                      type="button"
                      onClick={() => onToggleCanvasTool("expand")}
                      className={`bp-btn flex items-center justify-center gap-1 rounded-lg border py-1 px-2 text-[10px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                        activeCanvasTool === "expand"
                          ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-xs"
                          : "border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)]"
                      }`}
                      title="开启画布边缘手柄，向四周自由拖拽放大留白区域"
                    >
                      <span>✂️ 自由拖拽扩边</span>
                    </button>
                  )}
                  {marginMode !== "none" && (
                    <button
                      type="button"
                      disabled={isApplyingMargin}
                      onClick={() => handleApplyMarginExtension("none")}
                      className="bp-btn flex items-center justify-center gap-1 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 px-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:border-slate-400 transition cursor-pointer whitespace-nowrap"
                    >
                      <ArrowCounterClockwiseIcon className="h-3 w-3 shrink-0" weight="bold" />
                      <span>恢复原图</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Blank Area Color Setting (Auto Original / White / Black / Custom) */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  空白区域颜色:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isApplyingMargin}
                    onClick={() => handleSelectBlankColor(null)}
                    className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      marginCustomColor === null
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                    }`}
                    title="自动采样并匹配原图边缘背景色"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: sampledEdgeColors?.overall || "#F1F5F9" }}
                    />
                    <span>原图色</span>
                  </button>
                  <button
                    type="button"
                    disabled={isApplyingMargin}
                    onClick={() => handleSelectBlankColor("#FFFFFF")}
                    className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      marginCustomColor?.toUpperCase() === "#FFFFFF"
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                    }`}
                    title="纯白留白背景 (#FFFFFF)"
                  >
                    <span className="h-3 w-3 rounded-full border border-slate-300 bg-white shrink-0" />
                    <span>白色</span>
                  </button>
                  <button
                    type="button"
                    disabled={isApplyingMargin}
                    onClick={() => handleSelectBlankColor("#111827")}
                    className={`bp-btn inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                      marginCustomColor?.toUpperCase() === "#111827"
                        ? "bp-pill-active border-[var(--accent-color)] bg-[var(--accent-color)] text-white"
                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                    }`}
                    title="纯黑留白背景 (#111827)"
                  >
                    <span className="h-3 w-3 rounded-full border border-slate-600 bg-[#111827] shrink-0" />
                    <span>黑色</span>
                  </button>
                  <label
                    className="relative flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer shadow-2xs"
                    title="自定义留白背景色"
                  >
                    <input
                      type="color"
                      value={marginCustomColor || sampledEdgeColors?.overall || "#FFFFFF"}
                      onChange={(e) => handleSelectBlankColor(e.target.value.toUpperCase())}
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
            </div>
          )}

          {/* 1-Click Auto Arrange */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lang === "zh" ? "一键智能排版" : "Smart Layout"}
            </div>
            <div className="grid grid-cols-2 gap-2 pr-1">
              <button
                type="button"
                onClick={triggerAutoArrangeLR}
                className="bp-btn flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
              >
                <ColumnsIcon className="h-3.5 w-3.5 text-[var(--accent-color)]" weight="bold" />
                <span>{t.autoArrangeLR || "左右分列"}</span>
              </button>
              <button
                type="button"
                onClick={triggerAutoArrangeTB}
                className="bp-btn flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
              >
                <RowsIcon className="h-3.5 w-3.5 text-[var(--accent-color)]" weight="bold" />
                <span>{t.autoArrangeTB || "上下分行"}</span>
              </button>
            </div>
          </div>

          {/* 6 Quick Alignment Pills */}
          <div className="grid grid-cols-6 gap-1 pr-1">
            <button
              type="button"
              onClick={() => triggerAlign("left")}
              className="bp-btn flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
            >
              <ArrowLeftIcon className="h-3 w-3" />
              <span>靠左</span>
            </button>
            <button
              type="button"
              onClick={() => triggerAlign("autoH")}
              className="bp-btn flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
            >
              <ArrowsHorizontalIcon className="h-3 w-3" />
              <span>自适应H</span>
            </button>
            <button
              type="button"
              onClick={() => triggerAlign("right")}
              className="bp-btn flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
            >
              <ArrowRightIcon className="h-3 w-3" />
              <span>靠右</span>
            </button>
            <button
              type="button"
              onClick={() => triggerAlign("top")}
              className="bp-btn flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
            >
              <ArrowUpIcon className="h-3 w-3" />
              <span>靠顶</span>
            </button>
            <button
              type="button"
              onClick={() => triggerAlign("autoV")}
              className="bp-btn flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
            >
              <ArrowsVerticalIcon className="h-3 w-3" />
              <span>自适应V</span>
            </button>
            <button
              type="button"
              onClick={() => triggerAlign("bottom")}
              className="bp-btn flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors cursor-pointer"
            >
              <ArrowDownIcon className="h-3 w-3" />
              <span>靠底</span>
            </button>
          </div>

          {/* Card Scale, Locked Aspect Ratio Base Width, and X/Y Sliders */}
          <div className="bp-subcard space-y-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 p-3 border border-slate-200/60 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  {t.cardSize || "色卡缩放"}
                </span>
                <span className="font-mono font-bold text-[var(--accent-color)]">
                  {Math.round(effectiveScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.02}
                value={effectiveScale}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                className="bp-range-slider w-full accent-[var(--accent-color)] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  卡片宽度 (锁定等比)
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                  {settings.cardBaseWidth || 160}px
                </span>
              </div>
              <input
                type="range"
                min={120}
                max={220}
                step={4}
                value={settings.cardBaseWidth || 160}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    cardBaseWidth: parseInt(e.target.value, 10),
                  }))
                }
                className="bp-range-slider w-full accent-[var(--accent-color)] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {activeAssigned && onUpdateColors && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">水平位置 (X)</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                      {Math.round((curNx / maxX) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxX}
                    step={0.005}
                    value={Math.min(curNx, maxX)}
                    onChange={(e) => handlePosChange("x", parseFloat(e.target.value))}
                    className="bp-range-slider w-full accent-[var(--accent-color)] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600 dark:text-slate-300">垂直位置 (Y)</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                      {Math.round((curNy / maxY) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxY}
                    step={0.005}
                    value={Math.min(curNy, maxY)}
                    onChange={(e) => handlePosChange("y", parseFloat(e.target.value))}
                    className="bp-range-slider w-full accent-[var(--accent-color)] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>

          {/* Leader Line Style & Width */}
          <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="bp-segmented grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {lineStyles.map((item) => {
                const active = settings.lineStyle === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateSettings((prev) => ({ ...prev, lineStyle: item.id }))}
                    className={`bp-segmented-item flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
                      active
                        ? "bp-segmented-item-active bg-white dark:bg-slate-900 text-[var(--accent-color)] shadow-xs"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  {t.lineWidth || "连接线粗细"}
                </span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                  {settings.lineWidth.toFixed(1)}px
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={settings.lineWidth}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    lineWidth: parseFloat(e.target.value),
                  }))
                }
                className="bp-range-slider w-full accent-[var(--accent-color)] h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 pr-1">
              <label className="bp-subcard flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lineMatchPaintColor}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      lineMatchPaintColor: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.lineMatchColor || "线条跟随油漆色"}
                </span>
              </label>

              <label className="bp-subcard flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.cardGlassEffect}
                  onChange={(e) =>
                    updateSettings((prev) => ({
                      ...prev,
                      cardGlassEffect: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-[var(--accent-color)] focus:ring-[var(--accent-color)]"
                />
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <SparkleIcon className="w-3.5 h-3.5 text-[var(--accent-color)]" weight="fill" />
                  <span>{t.cardGlass || "液态玻璃效果"}</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwatchStudioControls;
