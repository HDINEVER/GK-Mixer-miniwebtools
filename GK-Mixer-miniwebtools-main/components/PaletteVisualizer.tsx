import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CatalogPaint, ColorData, Language } from '../types';
import { translations } from '../utils/translations';
import { colorsToMarkers, exportAnnotatedImage } from '../utils/exportAnnotatedImage';
import { DEFAULT_SWATCH_SETTINGS, SwatchSettings } from '../utils/swatchLayout';
import ExtractMarkerOverlay from './ExtractMarkerOverlay';
import SwatchStudioControls from './SwatchStudioControls';
import BrandMatchPanel from './BrandMatchPanel';
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

  // Guard visualizer canvas stage against viewport scrolling & pull-to-refresh on touch devices
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const preventStageTouch = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    stage.addEventListener('touchmove', preventStageTouch, { passive: false });
    return () => {
      stage.removeEventListener('touchmove', preventStageTouch);
    };
  }, [sourceImage]);

  const handleExportImage = async () => {
    const image = imageRef.current;
    if (!image || !markers.some((marker) => marker.paint)) return;
    setIsExporting(true);
    try {
      await exportAnnotatedImage(image, markers, swatchSettings);
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
            className="flex items-center justify-center gap-1.5 rounded-lg border border-macaron-green/50 bg-macaron-green/20 px-3.5 py-1.5 text-xs font-bold text-macaron-green transition-all hover:bg-macaron-green hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
          className="viz-stage relative flex flex-1 min-w-0 min-h-[380px] lg:min-h-0 flex-col overflow-hidden rounded-xl bg-slate-950 shadow-inner touch-none overscroll-none select-none"
          style={{ touchAction: 'none', overscrollBehavior: 'none' }}
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
              className="relative flex min-h-0 flex-1 items-center justify-center p-2 touch-none overscroll-none select-none"
              style={{ touchAction: 'none', overscrollBehavior: 'none' }}
            >
              <img
                ref={imageRef}
                src={sourceImage}
                alt=""
                crossOrigin={sourceImage.startsWith('http') ? 'anonymous' : undefined}
                onLoad={syncBox}
                className="max-h-full max-w-full object-contain pointer-events-none select-none touch-none"
                style={{ outline: '1px solid oklch(1 0 0 / 0.1)', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
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
          <div className="w-full lg:w-[320px] xl:w-[350px] flex-shrink-0 flex flex-col overflow-y-auto max-h-full pr-0.5">
            {/* Sidebar Tab Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-3 border border-slate-200/60 dark:border-slate-700/60 shadow-xs flex-shrink-0">
              <button
                type="button"
                onClick={() => setSidebarTab('match')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-0.5">
                {/* Sample Points Selector */}
                {colors.length > 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {lang === 'zh' ? '① 选择目标取样点:' : lang === 'ja' ? '① 対象サンプリング点:' : '① Select Sample Point:'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {colors.length} {lang === 'zh' ? '个点' : 'points'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1.5 no-scrollbar">
                      {colors.map((c, idx) => {
                        const isSelected = c.id === (activeColor?.id ?? null);
                        const hasPaint = !!c.assignedPaint;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onSelectColor?.(c.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all flex-shrink-0 border ${
                              isSelected
                                ? 'bg-sky-50 dark:bg-sky-950/80 border-2 border-sky-500 text-sky-800 dark:text-sky-200 font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/15 flex-shrink-0 shadow-xs"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span className="font-mono text-xs font-semibold">#{idx + 1}</span>
                            {hasPaint && (
                              <span className="text-[10px] px-1 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-bold leading-none flex items-center justify-center">
                                <CheckIcon className="w-2.5 h-2.5" weight="bold" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                    {lang === 'zh'
                      ? '尚未从参考图提取颜色。请前往【混色台-拾色】点选图像提取颜色。'
                      : 'No colors extracted yet. Please pick colors on Workbench-Extract first.'}
                  </div>
                )}

                {/* Active Point Card & Status */}
                {activeColor && (
                  <div className="bg-white dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-600 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: activeColor.hex }}
                        />
                        <div>
                          <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                            {activeColor.hex}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {activeColor.sampleX != null
                              ? `${lang === 'zh' ? '画面坐标' : 'Coord'}: (${(activeColor.sampleX * 100).toFixed(0)}%, ${(activeColor.sampleY! * 100).toFixed(0)}%)`
                              : (lang === 'zh' ? '手动色块' : 'Manual swatch')}
                          </div>
                        </div>
                      </div>
                      {activeColor.assignedPaint && (
                        <button
                          type="button"
                          onClick={() => onUnassignPaint?.(activeColor.id)}
                          className="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 font-medium px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 hover:bg-red-100"
                        >
                          {lang === 'zh' ? '移除此色卡' : 'Remove'}
                        </button>
                      )}
                    </div>

                    {activeColor.assignedPaint ? (
                      <div className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-200">
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" weight="bold" />
                          <span>{lang === 'zh' ? '已配成品漆:' : 'Assigned Paint:'}</span>
                          <span className="font-mono">{activeColor.assignedPaint.brand} {activeColor.assignedPaint.code}</span>
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                          {activeColor.assignedPaint.name} ({activeColor.assignedPaint.hex})
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                          {lang === 'zh' ? '可在下方重新选择替换，或切至【色卡排版外观】调整排版' : 'Choose below to replace, or switch to Layout tab'}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                        {lang === 'zh' ? '② 点击下方品牌漆的【使用】按钮，即可为此点生成引出悬浮色卡' : '② Click [Use] on any brand paint below to generate a floating card'}
                      </div>
                    )}
                  </div>
                )}

                {/* Brand Match Panel Embedded */}
                <div className="flex-1 min-h-[300px]">
                  <BrandMatchPanel
                    hex={activeColor?.hex ?? (colors.length > 0 ? colors[0].hex : null)}
                    lang={lang}
                    compact={true}
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
              <div className="flex-1 flex flex-col overflow-y-auto">
                {assignedCount > 0 ? (
                  onChangeSwatchSettings && onAutoArrangeLR && onAutoArrangeTB && onAlign && onResetPositions && (
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
    </div>
  );
};

export default PaletteVisualizer;
