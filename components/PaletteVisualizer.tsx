import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ColorData, Language } from '../types';
import { translations } from '../utils/translations';
import { colorsToMarkers, exportAnnotatedImage } from '../utils/exportAnnotatedImage';
import { DEFAULT_SWATCH_SETTINGS, SwatchSettings } from '../utils/swatchLayout';
import ExtractMarkerOverlay from './ExtractMarkerOverlay';
import SwatchStudioControls from './SwatchStudioControls';

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
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [imgBox, setImgBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const t = translations[lang];
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const markers = useMemo(() => colorsToMarkers(colors), [colors]);
  const assignedCount = useMemo(() => markers.filter((m) => !!m.paint).length, [markers]);

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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                {isWideMode ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                )}
              </svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33A3 3 0 0116.5 19.5H6.75Z" />
            </svg>
            {isExporting ? t.exporting : t.exportAnnotated}
          </button>
        </div>
      </div>

      {/* Main Workspace: Side-by-side split view for preview stage and adjustment controls */}
      <div className="flex flex-1 flex-col lg:flex-row gap-4 min-h-[460px] lg:h-[calc(100vh-14rem)] lg:min-h-[500px] lg:max-h-[720px]">
        {/* Left/Center: Visualizer Preview Canvas Stage */}
        <div
          ref={stageRef}
          className="viz-stage relative flex flex-1 min-w-0 min-h-[380px] lg:min-h-0 flex-col overflow-hidden rounded-xl bg-slate-950 shadow-inner"
        >
          {!sourceImage ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{lang === 'zh' ? '前往取色页面' : lang === 'ja' ? '色抽出へ' : 'Go to Pick Image'}</span>
                </button>
              )}
            </div>
          ) : (
            <div ref={frameRef} className="relative flex min-h-0 flex-1 items-center justify-center p-2">
              <img
                ref={imageRef}
                src={sourceImage}
                alt=""
                crossOrigin={sourceImage.startsWith('http') ? 'anonymous' : undefined}
                onLoad={syncBox}
                className="max-h-full max-w-full object-contain"
                style={{ outline: '1px solid oklch(1 0 0 / 0.1)' }}
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {t.exportAnnotated}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Swatch Studio Adjustment Controls Sidebar */}
        {sourceImage && assignedCount > 0 && onChangeSwatchSettings && onAutoArrangeLR && onAutoArrangeTB && onAlign && onResetPositions && (
          <div className="w-full lg:w-[310px] xl:w-[330px] flex-shrink-0 flex flex-col overflow-y-auto max-h-full pr-0.5">
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
