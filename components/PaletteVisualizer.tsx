import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CatalogPaint, ColorData, Language } from '../types';
import { translations } from '../utils/translations';
import { colorsToMarkers, exportAnnotatedImage, ExportResult } from '../utils/exportAnnotatedImage';
import { DEFAULT_SWATCH_SETTINGS, SwatchSettings } from '../utils/swatchLayout';
import ExtractMarkerOverlay from './ExtractMarkerOverlay';
import SwatchStudioControls from './SwatchStudioControls';
import BrandMatchPanel from './BrandMatchPanel';
import { ExportSuccessModal } from './ExportSuccessModal';
import {
  TagIcon,
  GearIcon,
  CheckIcon,
  DownloadSimpleIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
  ImageSquareIcon,
  PlusIcon,
} from '@phosphor-icons/react';

interface PaletteVisualizerProps {
  sourceImage: string | null;
  colors: ColorData[];
  lang: Language;
  selectedColorId?: string | null;
  swatchSettings?: SwatchSettings;
  onChangeSwatchSettings?: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  onAutoArrangeLR?: () => void;
  onAutoArrangeTB?: () => void;
  onAlign?: (alignment: 'left' | 'right' | 'top' | 'bottom' | 'autoH' | 'autoV') => void;
  onResetPositions?: () => void;
  onSelectColor?: (id: string) => void;
  onUnassignPaint?: (id: string) => void;
  onMoveLabel?: (id: string, labelNx: number, labelNy: number) => void;
  isWideMode?: boolean;
  onToggleWideMode?: () => void;
  onNavigateToExtract?: () => void;
  onAssignCatalogPaint?: (paint: CatalogPaint) => void;
}

const PaletteVisualizer: React.FC<PaletteVisualizerProps> = ({
  sourceImage,
  colors,
  lang,
  selectedColorId,
  swatchSettings = DEFAULT_SWATCH_SETTINGS,
  onChangeSwatchSettings,
  onAutoArrangeLR,
  onAutoArrangeTB,
  onAlign,
  onResetPositions,
  onSelectColor,
  onUnassignPaint,
  onMoveLabel,
  isWideMode = false,
  onToggleWideMode,
  onNavigateToExtract,
  onAssignCatalogPaint,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [imgBox, setImgBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [sidebarTab, setSidebarTab] = useState<'match' | 'layout'>('match');
  const t = translations[lang];
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const markers = useMemo(() => colorsToMarkers(colors), [colors]);
  const assignedCount = useMemo(() => markers.filter((m) => !!m.paint).length, [markers]);
  const activeColor = useMemo(() => {
    if (selectedColorId) {
      const found = colors.find((c) => c.id === selectedColorId);
      if (found) return found;
    }
    return colors.length > 0 ? colors[0] : null;
  }, [colors, selectedColorId]);

  const syncBox = () => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    setImgBox({
      left: image.offsetLeft,
      top: image.offsetTop,
      width: image.offsetWidth,
      height: image.offsetHeight,
    });
  };

  useLayoutEffect(() => {
    syncBox();
  }, [sourceImage, colors.length]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const observer = new ResizeObserver(syncBox);
    observer.observe(image);
    return () => observer.disconnect();
  }, [sourceImage]);

  const handleExportImage = async () => {
    const image = imageRef.current;
    if (!image || !markers.some((marker) => marker.paint)) return;
    setIsExporting(true);
    try {
      const res = await exportAnnotatedImage(image, markers, swatchSettings);
      if (res) {
        setExportResult(res);
        setIsExportModalOpen(true);
      }
    } catch (err) {
      console.error('[Export] Failed to export annotated image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-macaron-purple">
            <span className="h-2 w-2 rounded-full bg-macaron-purple" />
            {t.visualizerTitle}
          </h3>
          {assignedCount > 0 && (
            <span className="rounded-full bg-macaron-purple/10 px-2 py-0.5 text-[10px] font-bold text-macaron-purple">
              {assignedCount} {lang === 'zh' ? '个色卡' : 'swatches'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onToggleWideMode && (
            <button
              type="button"
              onClick={onToggleWideMode}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                isWideMode
                  ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              title={isWideMode ? (lang === 'zh' ? '切换回双栏标准布局' : 'Standard 2-column view') : (lang === 'zh' ? '展开为全宽工作台' : 'Wide canvas studio')}
            >
              {isWideMode ? (
                <ArrowsInSimpleIcon className="h-3.5 w-3.5" weight="bold" />
              ) : (
                <ArrowsOutSimpleIcon className="h-3.5 w-3.5" weight="bold" />
              )}
              <span>
                {isWideMode
                  ? (lang === 'zh' ? '标准双栏' : lang === 'ja' ? '標準表示' : 'Standard View')
                  : (lang === 'zh' ? '宽屏全景' : lang === 'ja' ? 'ワイド表示' : 'Wide Studio')}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportImage}
            disabled={!sourceImage || isExporting || assignedCount === 0}
            title={
              assignedCount === 0
                ? (lang === 'zh' ? '请先在左侧为色卡关联油漆' : 'Assign paint to swatches first')
                : (lang === 'zh' ? '导出并保存色卡标注图到相册' : 'Export and save swatch image')
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-macaron-green/50 bg-macaron-green/20 px-3.5 py-1.5 text-xs font-bold text-macaron-green transition-all hover:bg-macaron-green hover:text-white disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
          >
            <DownloadSimpleIcon className="h-3.5 w-3.5" weight="bold" />
            {isExporting ? t.exporting : t.exportAnnotated}
          </button>
        </div>
      </div>

      {/* Main Workspace: Side-by-side split view for preview stage and adjustment controls */}
      <div className="flex flex-1 flex-col lg:flex-row gap-4 min-h-[460px] lg:h-[calc(100vh-14rem)] lg:min-h-[500px] lg:max-h-[720px]">
        {/* Left/Center: Visualizer Preview Canvas Stage */}
        <div
          ref={stageRef}
          className="viz-stage relative flex flex-1 min-w-0 min-h-[380px] lg:min-h-0 flex-col overflow-hidden rounded-xl bg-slate-950 shadow-inner touch-pan-y select-none"
          style={{ touchAction: 'pan-y' }}
        >
          {!sourceImage ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                <ImageSquareIcon className="w-7 h-7" weight="bold" />
              </div>
              <p className="text-sm font-bold text-slate-300 mb-2">
                {lang === 'zh'
                  ? '未加载参考图片'
                  : lang === 'ja'
                  ? '参考画像がありません'
                  : 'No Reference Image'}
              </p>
              <p className="font-mono text-xs text-slate-500 mb-5 max-w-xs">
                {lang === 'zh'
                  ? '请先在【取色】页面放入参考图并提取颜色，再回到这里调整色卡排列与导出标注图。'
                  : lang === 'ja'
                  ? '【抽出】画面で画像を読み込み、色を採取してからここへ戻って調整・書き出しを行います。'
                  : 'Load a reference in the Pick tab first, then adjust swatches and export here.'}
              </p>
              {onNavigateToExtract && (
                <button
                  type="button"
                  onClick={onNavigateToExtract}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-macaron-pink to-macaron-blue text-white text-xs font-bold shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <PlusIcon className="w-4 h-4" weight="bold" />
                  <span>{lang === 'zh' ? '前往取色页面' : lang === 'ja' ? '色抽出へ' : 'Go to Pick Image'}</span>
                </button>
              )}
            </div>
          ) : (
            <div 
              ref={frameRef} 
              className="relative flex min-h-0 flex-1 items-center justify-center p-2 touch-pan-y select-none"
              style={{ touchAction: 'pan-y' }}
            >
              <img
                ref={imageRef}
                src={sourceImage}
                alt=""
                crossOrigin={sourceImage.startsWith('http') ? 'anonymous' : undefined}
                onLoad={syncBox}
                className="max-h-full max-w-full object-contain pointer-events-none select-none"
                style={{ outline: '1px solid oklch(1 0 0 / 0.1)', userSelect: 'none', WebkitUserSelect: 'none' }}
                draggable={false}
              />
              {imgBox.width > 0 && (
                <div
                  className="pointer-events-none absolute overflow-visible"
                  style={{
                    left: imgBox.left,
                    top: imgBox.top,
                    width: imgBox.width,
                    height: imgBox.height,
                  }}
                >
                  <ExtractMarkerOverlay
                    markers={markers}
                    selectedId={selectedColorId ?? null}
                    viewScale={1}
                    settings={swatchSettings}
                    onSelect={(id) => onSelectColor?.(id)}
                    onRemove={(id) => onUnassignPaint?.(id)}
                    onMoveLabel={onMoveLabel}
                    showRemove={!isExporting}
                  />
                </div>
              )}
              <div className="pointer-events-none absolute right-3 top-3">
                <button
                  type="button"
                  onClick={handleExportImage}
                  disabled={isExporting || assignedCount === 0}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm transition-transform hover:bg-slate-900 active:scale-[0.96] disabled:opacity-40"
                >
                  <DownloadSimpleIcon className="h-3.5 w-3.5" weight="bold" />
                  {t.exportAnnotated}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Dual Tab [ 选配悬浮色卡 | 色卡排版外观 ] */}
        {sourceImage && (
          <div className="w-full lg:w-[350px] xl:w-[390px] flex-shrink-0 flex flex-col lg:overflow-y-auto lg:max-h-full pr-0.5">
            {/* Sidebar Tab Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-3 border border-slate-200/60 dark:border-slate-700/60 shadow-xs flex-shrink-0">
              <button
                type="button"
                onClick={() => setSidebarTab('match')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sidebarTab === 'match'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <TagIcon className="w-3.5 h-3.5" weight="bold" />
                <span>{lang === 'zh' ? '选配悬浮色卡' : lang === 'ja' ? '色カード選択' : 'Assign Paints'}</span>
                {assignedCount > 0 && (
                  <span className="px-1 min-w-[14px] h-3.5 bg-sky-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none">
                    {assignedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('layout')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sidebarTab === 'layout'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <GearIcon className="w-3.5 h-3.5" weight="bold" />
                <span>{lang === 'zh' ? '色卡排版外观' : lang === 'ja' ? 'レイアウト外観' : 'Layout & Style'}</span>
              </button>
            </div>

            {/* Sub-panel 1: 选配模型漆 / 悬浮色卡 */}
            {sidebarTab === 'match' && (
              <div className="flex flex-col gap-3 flex-1">
                {/* Unified Target Sample Points & Active Status Card */}
                {colors.length > 0 ? (
                  <div className="bg-white dark:bg-slate-800/90 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex-shrink-0 flex flex-col gap-2.5">
                    {/* Header: Title + Point Count + Quick Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {lang === 'zh' ? '目标取样点' : lang === 'ja' ? '対象サンプリング点' : 'Sample Point'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                          {colors.length} {lang === 'zh' ? '个点' : 'pts'}
                        </span>
                      </div>
                      {activeColor?.assignedPaint && (
                        <button
                          type="button"
                          onClick={() => onUnassignPaint?.(activeColor.id)}
                          className="text-[11px] text-red-500 hover:text-red-600 dark:text-red-400 font-semibold px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 transition-colors cursor-pointer"
                        >
                          {lang === 'zh' ? '移除此色卡' : 'Remove Swatch'}
                        </button>
                      )}
                    </div>

                    {/* Touch-Friendly Point Switcher Pills */}
                    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 no-scrollbar">
                      {colors.map((c, idx) => {
                        const isSelected = c.id === (activeColor?.id ?? null);
                        const hasPaint = !!c.assignedPaint;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectColor?.(c.id)}
                            className={`flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl text-xs transition-all duration-150 active:scale-95 flex-shrink-0 border cursor-pointer ${
                              isSelected
                                ? 'bg-sky-50 dark:bg-sky-950/80 border-sky-500 text-sky-800 dark:text-sky-200 font-bold ring-2 ring-sky-300/40 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 flex-shrink-0 shadow-xs"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span className="font-mono font-bold">#{idx + 1}</span>
                            {hasPaint && (
                              <span className="w-3.5 h-3.5 bg-emerald-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                                <CheckIcon className="w-2.5 h-2.5" weight="bold" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Point Detail Bar */}
                    {activeColor && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-4 h-4 rounded-md border border-black/15 dark:border-white/20 shadow-xs flex-shrink-0"
                            style={{ backgroundColor: activeColor.hex }}
                          />
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                            {activeColor.hex}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {activeColor.sampleX != null
                              ? `(${Math.round(activeColor.sampleX * 100)}%, ${Math.round(activeColor.sampleY! * 100)}%)`
                              : ''}
                          </span>
                        </div>
                        {activeColor.assignedPaint ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2 py-0.5 rounded-lg truncate max-w-[150px]">
                            <CheckIcon className="w-3 h-3 flex-shrink-0 text-emerald-600 dark:text-emerald-400" weight="bold" />
                            <span className="truncate">{activeColor.assignedPaint.code} {activeColor.assignedPaint.name}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            {lang === 'zh' ? '点击下方漆卡直接关联' : 'Tap any paint card below'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                    {lang === 'zh'
                      ? '尚未从参考图提取颜色。请前往【混色台-拾色】点选图像提取颜色。'
                      : 'No colors extracted yet. Please pick colors on Workbench-Extract first.'}
                  </div>
                )}

                {/* Brand Match Panel Embedded */}
                <div className="flex-1">
                  <BrandMatchPanel
                    hex={activeColor?.hex ?? (colors.length > 0 ? colors[0].hex : null)}
                    lang={lang}
                    disableInternalScroll={true}
                    hasSamplePoint={activeColor ? activeColor.sampleX != null : false}
                    assignedId={activeColor?.assignedPaint?.id}
                    onAssignCatalog={(paint) => {
                      if (onAssignCatalogPaint) {
                        onAssignCatalogPaint(paint);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sub-panel 2: 色卡排版外观 */}
            {sidebarTab === 'layout' && (
              <div className="flex-1 flex flex-col">
                {assignedCount > 0 ? (
                  onChangeSwatchSettings && onAutoArrangeLR && onAutoArrangeTB && onAlign && onResetPositions && (
                    <>
                      <SwatchStudioControls
                        settings={swatchSettings}
                        onChangeSettings={onChangeSwatchSettings}
                        onAutoArrangeLR={onAutoArrangeLR}
                        onAutoArrangeTB={onAutoArrangeTB}
                        onAlign={onAlign}
                        onResetPositions={onResetPositions}
                        lang={lang}
                        assignedCount={assignedCount}
                        variant="sidebar"
                      />
                      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 sticky bottom-0">
                        <button
                          type="button"
                          onClick={handleExportImage}
                          disabled={!sourceImage || isExporting || assignedCount === 0}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-macaron-green py-2.5 px-4 text-xs font-bold text-white shadow-md hover:brightness-105 active:scale-98 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <DownloadSimpleIcon className="h-4 w-4" weight="bold" />
                          <span>
                            {isExporting
                              ? t.exporting
                              : (lang === 'zh' ? '导出色卡标注图 (保存到相册)' : t.exportAnnotated)}
                          </span>
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      {lang === 'zh'
                        ? '尚未为任何取样点选配悬浮色卡。请先在【选配悬浮色卡】标签页中选配至少一款模型漆。'
                        : 'No swatches assigned yet. Please assign at least one paint in the Assign tab first.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSidebarTab('match')}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors"
                    >
                      {lang === 'zh' ? '前往选配模型漆' : 'Go to Assign Paints'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-2.5 text-center font-mono text-[10px] text-slate-400">
        {lang === 'zh'
          ? '右侧可切换连接线种类、粗细、色卡大小及一键自动排版；拖拽画面中色卡可微调位置。'
          : lang === 'ja'
          ? '右パネルで引き出し線の種類、太さ、カードサイズ、自動整列を調整できます。'
          : 'Adjust leader line style, card size, and layout on the right; drag cards to fine-tune.'}
      </p>

      <ExportSuccessModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        result={exportResult}
        lang={lang}
      />
    </div>
  );
};

export default PaletteVisualizer;
