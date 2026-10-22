import React, { useEffect, useRef, useState } from "react";
import { CatalogPaint, ColorData, Language, TonalStep } from "../types";
import { ExtractMarkerOverlay } from "./ExtractMarkerOverlay";
import { SwatchStudioControls } from "./SwatchStudioControls";
import { SwatchSettings } from "../utils/swatchLayout";
import { XIcon, SparkleIcon, DownloadSimpleIcon } from "@phosphor-icons/react";

interface SwatchEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  imageSrc: string;
  colors: ColorData[];
  selectedColor: ColorData | null;
  onSelectColor: (color: ColorData) => void;
  onUpdateColors: (updater: (prev: ColorData[]) => ColorData[]) => void;
  settings: SwatchSettings;
  onUpdateSettings: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  lang: Language;
  onExportImage?: () => void;
  isExporting?: boolean;
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
  settings,
  onUpdateSettings,
  lang,
  onExportImage,
  isExporting,
}) => {
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 600, h: 450 });

  useEffect(() => {
    if (!isOpen) return;
    const el = imgContainerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        setCanvasSize({ w: rect.width, h: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, imageSrc]);

  if (!isOpen) return null;

  const assignedColors = colors.filter(
    (c): c is ColorData & { assignedPaint: CatalogPaint } => !!c.assignedPaint
  );
  const activeAssigned =
    selectedColor && selectedColor.assignedPaint
      ? selectedColor
      : assignedColors[0] || null;

  const hasTonal = !!(activeAssigned?.tonalGradient && activeAssigned.tonalGradient.length > 0);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-md p-0 sm:p-4 animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92dvh] sm:max-h-[88dvh] rounded-t-3xl sm:rounded-3xl bg-slate-50 dark:bg-slate-950 border border-white/30 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Floating Liquid Glass Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full bg-coral shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {onExportImage && (
              <button
                type="button"
                onClick={onExportImage}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition"
              >
                <DownloadSimpleIcon className="h-3.5 w-3.5" />
                <span>{isExporting ? "导出中…" : "导出 PNG"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition"
              title="完成并关闭"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: Interactive Canvas + Controls */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 cols: Interactive Dragging Canvas */}
          <div className="lg:col-span-7 space-y-3 lg:sticky lg:top-0">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-900/95 p-2 sm:p-3 shadow-inner flex items-center justify-center overflow-hidden">
              <div ref={imgContainerRef} className="relative inline-block max-w-full">
                <img
                  src={imageSrc}
                  alt="Swatch Canvas"
                  className="block max-h-[44dvh] lg:max-h-[62dvh] w-auto max-w-full rounded-xl object-contain select-none"
                  draggable={false}
                />
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
              </div>
            </div>

            {/* Tonal Gradient Bar Toggle for Selected Card */}
            {activeAssigned && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs">
                  <SparkleIcon className="h-4 w-4 text-coral shrink-0" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    悬浮色卡明暗三阶色条 (高光 / 主色 / 阴影)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleActiveTonalGradient}
                  className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                    hasTonal
                      ? "bg-coral text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {hasTonal ? "已开启明暗条" : "开启明暗条"}
                </button>
              </div>
            )}
          </div>

          {/* Right 5 cols: SwatchStudioControls */}
          <div className="lg:col-span-5">
            <SwatchStudioControls
              colors={colors}
              selectedColor={activeAssigned || selectedColor}
              onSelectColor={onSelectColor}
              onUpdateColors={onUpdateColors}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              canvasSize={canvasSize}
              lang={lang}
              onExportImage={onExportImage}
              isExporting={isExporting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
