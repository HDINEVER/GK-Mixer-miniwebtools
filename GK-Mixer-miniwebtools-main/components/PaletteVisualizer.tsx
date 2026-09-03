import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ColorData, Language } from '../types';
import { translations } from '../utils/translations';
import {
  findNearestRAL,
  calculateMixboxInverseRatios,
  getContrastColor,
  MIXBOX_INVERSE_RATIO_THRESHOLD,
} from '../utils/colorUtils';
import { formatDropRatioLine, toDropRatio } from '../utils/dropRatio';
import { colorsToMarkers, exportAnnotatedImage } from '../utils/exportAnnotatedImage';
import ExtractMarkerOverlay from './ExtractMarkerOverlay';

const COLOR_NAMES_8 = {
  en: ['White', 'Black', 'Red', 'Magenta', 'Blue', 'Cyan', 'Yellow', 'Orange'],
  zh: ['白', '黑', '红', '品红', '蓝', '青', '黄', '橙'],
  ja: ['白', '黒', '赤', 'マゼンタ', '青', 'シアン', '黄', 'オレンジ']
};

export const getMixboxRecipeText = (hex: string, lang: Language): string => {
  const ratios = calculateMixboxInverseRatios(hex, 'srgb', true);
  const names = COLOR_NAMES_8[lang];
  const validColors = ratios
    .map((ratio, index) => ({ ratio, name: names[index] }))
    .filter(item => item.ratio > MIXBOX_INVERSE_RATIO_THRESHOLD)
    .sort((a, b) => b.ratio - a.ratio);
  if (validColors.length === 0) return '-';
  const drops = toDropRatio(validColors.map(item => item.ratio));
  return formatDropRatioLine(
    validColors.map((item, index) => ({ name: item.name, drops: drops[index] ?? 0 }))
  );
};

export const getRALInfo = (rgb: { r: number; g: number; b: number }): { number: string; name: string } | null => {
  const ral = findNearestRAL(rgb);
  if (!ral) return null;
  return { number: `RAL ${ral.ral}`, name: ral.name };
};

const SWATCH_CSS = `
  .viz-stage .stripe-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    padding: 8px 6px;
    opacity: 1;
  }
  .viz-stage .stripe-hex {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1px;
  }
  .viz-stage .stripe-recipe {
    font-size: 8px;
    font-weight: 500;
    opacity: 0.85;
    line-height: 1.3;
    max-width: 92px;
    word-wrap: break-word;
  }
  .viz-stage .stripe-ral {
    font-size: 8px;
    font-weight: 600;
    opacity: 0.9;
    padding: 2px 4px;
    background: rgba(0,0,0,0.15);
    border-radius: 3px;
  }
  .viz-stage .viz-callout {
    display: flex;
    overflow: hidden;
    border-radius: 1em;
    background: #fff;
    box-shadow: 0 10px 20px rgba(0,0,0,0.18);
    min-width: 7.5rem;
    max-width: 11.5rem;
  }
  .viz-stage .viz-callout-color {
    flex: 1;
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    letter-spacing: 1px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
  .viz-stage .viz-strip {
    display: flex;
    height: 72px;
    width: 100%;
    border-radius: 1em;
    overflow: hidden;
    box-shadow: 0 10px 20px rgba(0,0,0,0.12);
    background: #fff;
  }
  .viz-stage .viz-strip .color {
    height: 100%;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    letter-spacing: 1px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  }
`;

interface PaletteVisualizerProps {
  sourceImage: string | null;
  colors: ColorData[];
  lang: Language;
  selectedColorId?: string | null;
  onSelectColor?: (id: string) => void;
  onUnassignPaint?: (id: string) => void;
  onMoveLabel?: (id: string, labelNx: number, labelNy: number) => void;
}

const PaletteVisualizer: React.FC<PaletteVisualizerProps> = ({
  sourceImage,
  colors,
  lang,
  selectedColorId,
  onSelectColor,
  onUnassignPaint,
  onMoveLabel,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [imgBox, setImgBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const t = translations[lang];
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const markers = useMemo(() => colorsToMarkers(colors), [colors]);

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
      await exportAnnotatedImage(image, markers);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-[32rem] flex-col">
      <style>{SWATCH_CSS}</style>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-macaron-purple">
          <span className="h-2 w-2 rounded-full bg-macaron-purple" />
          {t.visualizerTitle}
        </h3>
        <button
          type="button"
          onClick={handleExportImage}
          disabled={!sourceImage || isExporting || !markers.some((marker) => marker.paint)}
          className="flex items-center justify-center gap-1 rounded border border-macaron-green/50 bg-macaron-green/20 px-3 py-1.5 text-[10px] font-bold text-macaron-green transition-colors hover:bg-macaron-green hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33A3 3 0 0116.5 19.5H6.75Z" />
          </svg>
          {isExporting ? t.exporting : t.exportAnnotated}
        </button>
      </div>

      <div
        ref={stageRef}
        className="viz-stage relative flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-xl bg-slate-950"
      >
        {!sourceImage ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center font-mono text-[11px] text-slate-500">
            {lang === 'zh' ? '先在左侧放入参考图并取色，再回到这里导出标注图。' : lang === 'ja' ? '左で画像を読み込み、色を採取してから書き出します。' : 'Load a reference on the left and pick colors, then export here.'}
          </div>
        ) : (
          <>
            <div ref={frameRef} className="relative flex min-h-0 flex-1 items-center justify-center">
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
                  disabled={isExporting || !markers.some((marker) => marker.paint)}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm transition-transform hover:bg-slate-900 active:scale-[0.96]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {t.exportAnnotated}
                </button>
              </div>
            </div>
            {colors.length > 0 && (
              <div className="p-3">
                <div className="viz-strip">
                  {colors.slice(0, 8).map((col) => {
                    const ralInfo = getRALInfo(col.rgb);
                    const mixRecipe = getMixboxRecipeText(col.hex, lang);
                    const textColor = getContrastColor(col.hex);
                    const paint = col.assignedPaint;
                    return (
                      <div key={col.id} className="color" style={{ backgroundColor: col.hex }}>
                        <div className="stripe-info" style={{ color: textColor }}>
                          <span className="stripe-hex">{(paint ? `${paint.code}` : col.hex).replace('#', '')}</span>
                          <span className="stripe-recipe">{paint ? `${paint.brand} ${paint.name}` : mixRecipe}</span>
                          {ralInfo && <span className="stripe-ral">{ralInfo.number}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-3 text-center font-mono text-[10px] text-slate-400">
        {lang === 'zh'
          ? '左侧图上取色后，在混色台点「使用」会出现可拖拽色卡。导出 PNG 会把色卡画进原图。'
          : lang === 'ja'
            ? '左で採取した色が画像に重なります。書き出しは元のスウォッチ様式です。'
            : 'Picks from the left image appear as swatch cards on the photo. Export keeps the original card CSS.'}
      </p>
    </div>
  );
};

export default PaletteVisualizer;
