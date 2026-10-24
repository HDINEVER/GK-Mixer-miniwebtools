import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  PaletteIcon,
  SparkleIcon,
  DropIcon,
  PlusIcon,
  CheckIcon,
  CheckCircleIcon,
  WarningIcon,
  XCircleIcon,
  SunIcon,
  MoonIcon,
  ClipboardTextIcon,
  ScalesIcon,
} from '@phosphor-icons/react';
import { ColorData, PaintBrand, RALColor, Language, ColorSpace, MixerResultCache, MixingMode, CatalogPaint } from '../types';
import { findNearestRAL, hexToRgb, rgbToCmyk, mixboxBlend, mixboxMultiBlend, calculateMixboxRatios, calculateMixboxInverseRatios, calculateProfessionalRecipe, BASE_MIXING_COLORS, EXTENDED_MIXING_COLORS, FULL_MIXING_COLORS, getMixingPigmentInfo, PROFESSIONAL_RATIO_THRESHOLD, MIXBOX_INVERSE_RATIO_THRESHOLD } from '../utils/colorUtils';
import BrandMatchPanel from './BrandMatchPanel';
import { translations } from '../utils/translations';
import { formatDropRatioLine, toDropRatio } from '../utils/dropRatio';
import DropRatioBar from './DropRatioBar';
import * as mixbox from '../utils/mixbox';



const recipeLabelToHex = (label: string): string => {
  if (label.includes('品红') || /magenta/i.test(label)) return '#FF00FF';
  if (label.includes('青') || /cyan/i.test(label)) return '#00FFFF';
  if (label.includes('橙') || /orange/i.test(label)) return '#FF8000';
  if (label.includes('绿') || /green/i.test(label)) return '#00FF00';
  if (label.includes('紫') || /purple|violet/i.test(label)) return '#8000FF';
  if (label.includes('白') || /white/i.test(label)) return '#FFFFFF';
  if (label.includes('黑') || /black/i.test(label)) return '#000000';
  if (label.includes('红') || /red/i.test(label)) return '#FF0000';
  if (label.includes('蓝') || /blue/i.test(label)) return '#0000FF';
  if (label.includes('黄') || /yellow/i.test(label)) return '#FFFF00';
  return '#808080';
};

// Helper: RGB to HSB conversion
const rgbToHsb = (r: number, g: number, b: number): { h: number; s: number; b: number } => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  
  const s = max === 0 ? 0 : Math.round((delta / max) * 100);
  const brightness = Math.round(max * 100);
  
  return { h, s, b: brightness };
};

// Helper: Calculate hue accuracy between two colors
const calculateHueAccuracy = (targetHex: string, mixedHex: string): { accuracy: number; hueDiff: number; status: 'excellent' | 'good' | 'fair' | 'poor' } => {
  const targetRgb = hexToRgb(targetHex);
  const mixedRgb = hexToRgb(mixedHex);
  
  if (!targetRgb || !mixedRgb) return { accuracy: 0, hueDiff: 0, status: 'poor' };
  
  const targetHsb = rgbToHsb(targetRgb.r, targetRgb.g, targetRgb.b);
  const mixedHsb = rgbToHsb(mixedRgb.r, mixedRgb.g, mixedRgb.b);
  
  // Calculate hue difference (considering circular nature, 0-360°)
  let hueDiff = Math.abs(targetHsb.h - mixedHsb.h);
  if (hueDiff > 180) hueDiff = 360 - hueDiff;
  
  // Calculate accuracy (0-100%)
  const accuracy = Math.max(0, 100 - (hueDiff / 30) * 100); // 30° difference = 0% accuracy
  
  // Determine status
  let status: 'excellent' | 'good' | 'fair' | 'poor';
  if (accuracy >= 95) status = 'excellent';
  else if (accuracy >= 85) status = 'good';
  else if (accuracy >= 70) status = 'fair';
  else status = 'poor';
  
  return { accuracy, hueDiff, status };
};

declare var anime: any;

interface MixerResultProps {
  color: ColorData | null;
  lang: Language;
  colorSpace?: ColorSpace;
  onAddColor?: (hex: string) => void;
  cache?: MixerResultCache;
  onCacheUpdate?: (cache: MixerResultCache) => void;
  onAssignCatalogPaint?: (paint: CatalogPaint) => void;
  onNavigateToExtract?: () => void;
  forcedMode?: MixingMode;
}

interface Layer {
    color: string;
    heightPercent: number;
    volume: number;
    label: string;
    bottleBadge: string;
    displayCode: string;
    fullName: string;
    role: 'base' | 'primary' | 'cmy' | 'secondary';
    roleBadge: string;
    propertyHint: string;
    textColor: string;
    isBase?: boolean;
}

const PIGMENT_SHORT_NAME: Record<string, Record<Language, string>> = {
  '#FFFFFF': { zh: '光泽白', en: 'White', ja: '白' },
  '#000000': { zh: '光泽黑', en: 'Black', ja: '黒' },
  '#FF0000': { zh: '光泽红', en: 'Red', ja: '赤' },
  '#FF00FF': { zh: '色源品红', en: 'Magenta', ja: 'マゼンタ' },
  '#0000FF': { zh: '光泽蓝', en: 'Blue', ja: '青' },
  '#00FFFF': { zh: '色源青', en: 'Cyan', ja: 'シアン' },
  '#FFFF00': { zh: '色源黄', en: 'Source Yellow', ja: 'ソースイエロー' },
  '#FF8000': { zh: '色源橙', en: 'Orange', ja: 'オレンジ' },
  '#00FF00': { zh: '色源绿', en: 'Green', ja: 'グリーン' },
  '#8000FF': { zh: '色源紫', en: 'Purple', ja: 'バイオレット' },
};

const shortLayerName = (layer: Layer, lang: Language): string =>
  layer.fullName || PIGMENT_SHORT_NAME[layer.color.toUpperCase()]?.[lang] || layer.label;

const MixerResult: React.FC<MixerResultProps> = ({ color, lang, colorSpace: colorSpaceProp, onAddColor, cache, onCacheUpdate, onAssignCatalogPaint, onNavigateToExtract, forcedMode }) => {
  const colorSpace: ColorSpace =
    colorSpaceProp === 'display-p3' || colorSpaceProp === 'adobe-rgb' ? colorSpaceProp : 'srgb';
  const [ralMatch, setRalMatch] = useState<RALColor | null>(null);
  // Use cache values if available, otherwise use defaults
  const [bottleVolume, setBottleVolume] = useState<number>(cache?.bottleVolume ?? 20);
  const [mixingMode, setMixingMode] = useState<MixingMode>(forcedMode ?? cache?.mixingMode ?? 'mixbox');
  const [useSecondaryColors, setUseSecondaryColors] = useState<boolean>(cache?.useSecondaryColors ?? true);

  const handleSetMixingMode = (mode: MixingMode) => {
    setMixingMode(mode);
    onCacheUpdate?.({ ...cache, mixingMode: mode, bottleVolume, useSecondaryColors });
  };

  const handleToggleSecondaryColors = () => {
    const next = !useSecondaryColors;
    setUseSecondaryColors(next);
    onCacheUpdate?.({ ...cache, mixingMode, bottleVolume, useSecondaryColors: next });
  };
  const [selectedBasePaint, setSelectedBasePaint] = useState<PaintBrand | null>(null);
  const [professionalRecipe, setProfessionalRecipe] = useState<ReturnType<typeof calculateProfessionalRecipe> | null>(null);
  const [addedToPalette, setAddedToPalette] = useState(false);
  const [dropMultiplier, setDropMultiplier] = useState(1);
  
  useEffect(() => {
    if (forcedMode && forcedMode !== mixingMode) {
      setMixingMode(forcedMode);
    }
  }, [forcedMode]);
  
  const t = translations[lang];
  const bottleRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (color) {
      setProfessionalRecipe(null);
      setAddedToPalette(false); // Reset added state when color changes
      setDropMultiplier(1);
      
      const ral = findNearestRAL(color.rgb);
      setRalMatch(ral);
      
      // Don't auto-select base paint, only provide recommendations
      setSelectedBasePaint(null);

      // Generate professional recipe
      const profRecipe = calculateProfessionalRecipe(color.hex, {
        useSecondaryColors,
        includeFullSecondaryPalette: true,
      });
      setProfessionalRecipe(profRecipe);
    }
  }, [color, lang, mixingMode, useSecondaryColors]);

  const handleBasePaintToggle = (paint: PaintBrand) => {
      if (selectedBasePaint?.id === paint.id) {
          setSelectedBasePaint(null); // Deselect
      } else {
          setSelectedBasePaint(paint); // Select
      }
  };

  // Calculate Mixing Layers
  const mixLayers = useMemo(() => {
      if (!color) return [];

      const layers: Layer[] = [];
      const baseColors = FULL_MIXING_COLORS; // 10-color palette (includes Orange, Green, Purple secondary sources)
      const isPureColorSourceMode = mixingMode === 'professional';
      const solveOpts = {
        useSecondaryColors,
        includeFullSecondaryPalette: true,
        pureColorSourceOnly: isPureColorSourceMode,
      };
      
      if (selectedBasePaint) {
        // --- BASE PAINT MODE ---
        const baseRgb = hexToRgb(selectedBasePaint.hex);
        const ratios = calculateMixboxInverseRatios(color.hex, colorSpace, true, solveOpts);
        const visibleThreshold = MIXBOX_INVERSE_RATIO_THRESHOLD;
        
        // Find which base color index matches our selected paint best
        let basePaintIndex = 0;
        let minDist = Infinity;
        
        baseColors.forEach((baseColor, index) => {
          const baseColorRgb = hexToRgb(baseColor.hex);
          const dist = Math.sqrt(
            Math.pow(baseColorRgb.r - baseRgb.r, 2) +
            Math.pow(baseColorRgb.g - baseRgb.g, 2) +
            Math.pow(baseColorRgb.b - baseRgb.b, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            basePaintIndex = index;
          }
        });
        
        let basePart = ratios[basePaintIndex] || 50;
        const otherRatios = ratios.map((r, i) => i === basePaintIndex ? 0 : r);
        const totalOther = otherRatios.reduce((a, b) => a + b, 0);
        const totalParts = basePart + totalOther;
        
        const getVol = (part: number) => (part / totalParts) * bottleVolume;
        const getH = (part: number) => (part / totalParts) * 100;

        // Base Layer
        layers.push({
            color: selectedBasePaint.hex,
            heightPercent: getH(basePart),
            volume: getVol(basePart),
            label: selectedBasePaint.code,
            bottleBadge: `${selectedBasePaint.code} ${selectedBasePaint.name.split('/')[0].trim()}`,
            displayCode: selectedBasePaint.code,
            fullName: selectedBasePaint.name.split('/')[0].trim(),
            role: 'base',
            roleBadge: lang === 'zh' ? '底漆' : lang === 'ja' ? '下地' : 'Base',
            propertyHint: selectedBasePaint.brand,
            textColor: selectedBasePaint.name.includes('白') || selectedBasePaint.name.includes('White') ? '#000' : '#fff',
            isBase: true
        });

        // Add other base colors if needed
        otherRatios.forEach((ratio, index) => {
          if (ratio > visibleThreshold) {
            const baseColor = baseColors[index];
            const info = getMixingPigmentInfo(baseColor.hex, lang, baseColor.code, isPureColorSourceMode);
            layers.push({
              color: baseColor.hex,
              heightPercent: getH(ratio),
              volume: getVol(ratio),
              label: info.displayCode,
              bottleBadge: `${info.displayCode} ${info.shortName}`,
              displayCode: info.displayCode,
              fullName: info.fullName,
              role: info.role,
              roleBadge: info.roleBadge,
              propertyHint: info.propertyHint,
              textColor: baseColor.hex === '#FFFFFF' || baseColor.hex === '#FFFF00' ? '#000' : '#fff',
              isBase: false
            });
          }
        });

      } else {
        // --- MIXING MODE:
        // - 'mixbox' (普通 Mixbox): 带红/蓝/黄普通实色 (003/004/005) + 黑白 + CMY/间色
        // - 'professional' (HSB 纯色源): 不带红/蓝/黄实色，仅用黑白 (001/002) + CMY色源 (033/034/035) + 间色 (015/036/037)
        const weights = calculateMixboxInverseRatios(color.hex, colorSpace, true, solveOpts);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        
        if (totalWeight < 0.1) {
          layers.push({
            color: '#808080',
            heightPercent: 100,
            volume: bottleVolume,
            label: 'Gray',
            bottleBadge: 'Gray',
            displayCode: 'Gray',
            fullName: 'Gray',
            role: 'base',
            roleBadge: lang === 'zh' ? '底漆' : 'Base',
            propertyHint: '',
            textColor: '#fff',
            isBase: true
          });
        } else {
          const getVol = (weight: number) => (weight / totalWeight) * bottleVolume;
          const getH = (weight: number) => (weight / totalWeight) * 100;
          
          weights.forEach((weight, index) => {
            if (weight > MIXBOX_INVERSE_RATIO_THRESHOLD && index < baseColors.length) {
              const baseColor = baseColors[index];
              const info = getMixingPigmentInfo(baseColor.hex, lang, baseColor.code, isPureColorSourceMode);
              const isLightText = baseColor.hex === '#FFFFFF' || baseColor.hex === '#FFFF00';
              
              layers.push({
                color: baseColor.hex,
                heightPercent: getH(weight),
                volume: getVol(weight),
                label: info.displayCode,
                bottleBadge: `${info.displayCode} ${info.shortName}`,
                displayCode: info.displayCode,
                fullName: info.fullName,
                role: info.role,
                roleBadge: info.roleBadge,
                propertyHint: info.propertyHint,
                textColor: isLightText ? '#000' : '#fff',
                isBase: index < 2
              });
            }
          });
        }
      }

      return layers.reverse();
  }, [color, selectedBasePaint, bottleVolume, mixingMode, colorSpace, useSecondaryColors, lang]);

  const legendLayers = useMemo(() => mixLayers.slice().reverse(), [mixLayers]);

  const dropParts = useMemo(() => {
    const counts = toDropRatio(legendLayers.map(layer => layer.volume));
    return legendLayers.map((layer, index) => ({
      color: layer.color,
      name: shortLayerName(layer, lang),
      drops: counts[index] ?? 0,
    }));
  }, [legendLayers, lang]);

  useEffect(() => {
    if (bottleRef.current && color) {
      const animeInstance = typeof anime === 'undefined' ? null : anime;
      if (animeInstance) {
        // Stop existing animations
        animeInstance.remove(bottleRef.current.children);
        
        // Animate height from 0 or current
        animeInstance({
          targets: bottleRef.current.children,
          height: (el: HTMLElement) => el.dataset.targetHeight,
          opacity: [0, 1],
          duration: 800,
          easing: 'easeOutElastic(1, .8)',
          delay: animeInstance.stagger(50)
        });
      } else {
        Array.from(bottleRef.current.children).forEach((child) => {
          const el = child as HTMLElement;
          if (el.dataset.targetHeight) el.style.height = el.dataset.targetHeight;
          el.style.opacity = '1';
        });
      }
    }
  }, [mixLayers]);

  if (!color) {
    return (
      <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-14 h-14 rounded-2xl bg-accent/12 flex items-center justify-center text-accent mb-4 shadow-sm">
          <DropIcon className="w-7 h-7" weight="bold" />
        </div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          {t.noColor}
        </p>
        <p className="text-xs text-slate-400 mb-5 max-w-xs">
          {lang === 'zh'
            ? '请先在取色页面上传参考图并选取颜色，混色台将自动计算真实颜料配方与品牌色号。'
            : lang === 'ja'
            ? 'まずは抽出画面で画像を読み込んで色を選択してください。'
            : 'Please pick a color from the extraction page to calculate mixing recipes.'}
        </p>
        {onNavigateToExtract && (
          <button
            type="button"
            onClick={onNavigateToExtract}
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" weight="bold" />
            <span>{lang === 'zh' ? '前往取色页面' : lang === 'ja' ? '色抽出へ' : 'Go to Pick Color'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bp-subcard-lg bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm p-4 md:p-6 overflow-hidden transition-colors duration-300">
      {/* Mixing Mode Selector: Hidden when forcedMode is active (mode is selected via top tabs/desktop bar) */}
      {!forcedMode && (
        <div className="mb-5 space-y-1.5">
          <div className="bp-subcard flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-100/90 dark:bg-slate-800/80 p-2 sm:p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 min-w-0 max-w-full">
            <div className="flex items-center gap-1.5 pl-1 sm:pl-2 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
              <ScalesIcon className="w-4 h-4 text-accent shrink-0" weight="bold" />
              <span>{lang === 'zh' ? '混色分色方案' : lang === 'ja' ? '混色モード' : 'Mixing Scheme'}</span>
            </div>
            
            <div className="bp-segmented grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto min-w-0 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-xs border border-slate-200/50 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleSetMixingMode('mixbox')}
                className={`bp-segmented-item flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-150 whitespace-nowrap min-w-0 ${
                  mixingMode === 'mixbox'
                    ? 'bp-segmented-item-active bg-accent text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="方案一：无全套色源，使用黑白 + 红/黄/蓝常规实色主漆调配"
              >
                <PaletteIcon className="w-3.5 h-3.5 shrink-0" weight="bold" />
                <span className="sm:hidden truncate">{lang === 'zh' ? 'Mixbox (常规实色)' : 'Mixbox'}</span>
                <span className="hidden sm:inline">{lang === 'zh' ? 'Mixbox (含红黄蓝实色)' : 'Mixbox (Solid+CMY)'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetMixingMode('professional')}
                className={`bp-segmented-item flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-150 whitespace-nowrap min-w-0 ${
                  mixingMode === 'professional'
                    ? 'bp-segmented-item-active bg-accent text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="方案二：备齐 CMY 全套色源，去掉红黄蓝实色，纯色源减色调配"
              >
                <SparkleIcon className="w-3.5 h-3.5 shrink-0" weight="bold" />
                <span className="sm:hidden truncate">{lang === 'zh' ? 'HSB (全套色源)' : 'HSB (CMY)'}</span>
                <span className="hidden sm:inline">{lang === 'zh' ? 'HSB (纯色源·无实色)' : 'HSB (Pure CMY)'}</span>
              </button>
            </div>
          </div>
          <div className="px-1 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-1">
            <span>
              {lang === 'zh'
                ? '🎯 颜色分解适合【高达 / GK 喷涂自调色玩家】，提供「有无全套色源漆」双方案'
                : '🎯 Designed for Gundam/GK airbrush self-mixing (two schemes based on CMY source paint availability)'}
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {lang === 'zh' ? '⚠️ 笔涂玩家仅供参考' : '⚠️ Brush painters: reference only'}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-6 w-full max-w-full min-w-0 items-start">
        
        {/* Left: Bottle & Calculator */}
        <div className="min-w-0 w-full flex flex-col items-center pr-1.5 pb-1.5">
             <div className="w-full flex justify-between items-center mb-2.5">
                 <h3 className="text-xs font-bold text-accent tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-accent rounded-full"></span>
                    {t.mixingBottle}
                </h3>
             </div>

             {/* Volume Buttons (iOS/Konsta Segmented Pill Bar) */}
             <div className="w-full mb-2.5">
                <div className="bp-segmented p-1 bg-slate-200/60 dark:bg-slate-800/80 rounded-xl flex items-center gap-1 shadow-inner overflow-x-auto no-scrollbar w-full max-w-full">
                    {[10, 20, 30, 40, 50, 60].map(v => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setBottleVolume(v)}
                            className={`bp-segmented-item min-h-[30px] sm:min-h-[32px] px-2 sm:px-2.5 py-0.5 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-all duration-150 active:scale-[0.95] flex items-center justify-center flex-1 min-w-[2.25rem] cursor-pointer whitespace-nowrap ${
                                bottleVolume === v
                                    ? 'bp-segmented-item-active bg-accent text-white shadow-sm ring-1 ring-white/20'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            {v}ml
                        </button>
                    ))}
                </div>
             </div>

             {/* Intermediate / Secondary Translucent Color Sources Toggle (启用间色色源开关) */}
             <div className="w-full mb-3">
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                   <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                         <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                            {lang === 'zh'
                              ? '启用间色色源 (橙 / 绿 / 紫)'
                              : lang === 'ja'
                              ? '中間色ソースを有効化 (橙・緑・紫)'
                              : 'Use Secondary Color Sources (O / G / P)'}
                         </span>
                         <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-700">
                            <span className="w-2 h-2 rounded-full bg-[#FF8000]" title="色源橙 015" />
                            <span className="w-2 h-2 rounded-full bg-[#00FF00]" title="色源绿 036" />
                            <span className="w-2 h-2 rounded-full bg-[#8000FF]" title="色源紫 037" />
                         </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                         {mixingMode === 'professional'
                           ? useSecondaryColors
                             ? lang === 'zh'
                               ? 'HSB纯色源（无红黄蓝实色）：黑白(001/002) + CMY(033青/034品红/035黄) + 间色(015橙/036绿/037紫)'
                               : 'Pure Color Source (No Solid R/B/Y): Base B/W + CMY (033/034/035) + Secondary (015/036/037)'
                             : lang === 'zh'
                               ? 'HSB纯色源（已关间色）：仅使用黑白底漆(001/002) + CMY三原色源(033青/034品红/035黄)'
                               : 'Pure Color Source: Base B/W (001/002) + CMY (033/034/035) only'
                           : useSecondaryColors
                             ? lang === 'zh'
                               ? 'Mixbox模式（含红黄蓝实色）：黑白(001/002) + 实色(003红/004蓝/005黄) + CMY/间色色源'
                               : 'Mixbox (With Solid R/B/Y): Base B/W + Solid R/B/Y (003/004/005) + CMY & Secondary'
                             : lang === 'zh'
                               ? 'Mixbox模式（已关间色）：使用黑白(001/002) + 实色(003红/004蓝/005黄) + CMY色源(033青/034品红)'
                               : 'Mixbox: Base B/W + Solid R/B/Y (003/004/005) + CMY (033/034)'}
                      </p>
                   </div>
                   <button
                      type="button"
                      role="switch"
                      aria-checked={useSecondaryColors}
                      onClick={handleToggleSecondaryColors}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        useSecondaryColors ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                   >
                      <span
                         className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                           useSecondaryColors ? 'translate-x-5' : 'translate-x-0'
                         }`}
                      />
                   </button>
                </div>
             </div>

             {/* Drop Ratio Formula Card (几比几比几配方卡) */}
             <div className="w-full mb-3">
                <DropRatioBar
                   parts={dropParts}
                   lang={lang}
                   multiplier={dropMultiplier}
                   onMultiplierChange={setDropMultiplier}
                />
             </div>

             <div className="bp-subcard-lg flex flex-col sm:flex-row gap-4 items-end w-full justify-center bg-slate-50 dark:bg-slate-800/30 p-3.5 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden min-h-[260px]">
                
                {/* Bottle Graphic */}
                <div className="relative mx-auto sm:mx-0 flex-shrink-0">
                    {/* Bottle Neck */}
                    <div className="w-12 sm:w-14 h-3 sm:h-3.5 bg-slate-200 dark:bg-slate-600 mx-auto rounded-t-sm border-x border-t border-slate-300 dark:border-slate-500 opacity-50"></div>
                    
                    {/* Bottle Body */}
                    <div className="relative w-24 sm:w-28 h-52 sm:h-56 border-2 border-slate-400 dark:border-slate-500 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm overflow-hidden z-10">
                        
                        {/* Ticks */}
                        <div className="absolute right-0 top-0 h-full w-full pointer-events-none z-20 flex flex-col justify-end pb-0">
                             {[...Array(11)].map((_, i) => (
                                 <div key={i} className="w-full flex justify-end items-center pr-1 border-t border-slate-300/30 dark:border-slate-500/30 h-[10%] relative">
                                     <span className="text-[8px] font-mono text-slate-400 mr-0.5">{i * 10}%</span>
                                     <div className="w-1.5 h-px bg-slate-400"></div>
                                 </div>
                             ))}
                        </div>

                        {/* Liquid Container */}
                        <div ref={bottleRef} className="absolute bottom-0 left-0 w-full h-full flex flex-col-reverse">
                            {mixLayers.map((layer, idx) => (
                                <div 
                                    key={idx}
                                    data-target-height={`${layer.heightPercent}%`}
                                    className="w-full transition-all flex items-center justify-center relative group"
                                    style={{ 
                                        backgroundColor: layer.color,
                                        height: '0%', // Start at 0 for anime.js
                                        minHeight: layer.heightPercent > 0 ? '1px' : '0' 
                                    }}
                                >
                                    {layer.heightPercent > 6 && (
                                        <span 
                                            className="text-[9px] font-bold font-mono opacity-85 drop-shadow-md truncate px-1"
                                            style={{ color: layer.textColor }}
                                        >
                                            {layer.bottleBadge}
                                        </span>
                                    )}
                                    {/* Hover Tooltip */}
                                    <div className="absolute left-full ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-30 pointer-events-none shadow-lg">
                                        {layer.roleBadge} · {layer.displayCode} {layer.fullName}: {layer.volume.toFixed(1)}ml ({Math.round(layer.heightPercent)}%)
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Reflection overlay */}
                    <div className="absolute top-3 left-1.5 w-1.5 h-44 bg-white opacity-20 rounded-full blur-[1px] z-20 pointer-events-none"></div>
                </div>

                {/* Legend / List */}
                <div className="w-full sm:flex-1 min-w-0 h-auto sm:max-h-[19rem] overflow-y-auto space-y-2 pr-1.5 custom-scrollbar">
                     <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-2">
                        <span>{t.totalVolume}: {bottleVolume}ml</span>
                        <span className="text-accent">{selectedBasePaint ? 'BASE MODE' : 'PURE MODE'}</span>
                     </div>
                     
                     {/* 色相准确度验证（已按需求移除上方冗余的「配方还原色 + 母液小字 + 添加到色板」行） */}
                     {mixLayers.length > 0 && (() => {
                         if (!color) return null;
                         const targetRgb = hexToRgb(color.hex);
                         if (!targetRgb) return null;
                         const targetHsb = rgbToHsb(targetRgb.r, targetRgb.g, targetRgb.b);
                         if (targetHsb.s < 15) {
                             return (
                                 <div className="mb-2 px-2 py-1 rounded text-[10px] flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700">
                                     <span className="text-slate-400 dark:text-slate-500 font-medium">
                                         {lang === 'zh' ? '低饱和度 - 无需色相验证' : lang === 'ja' ? '低彩度 - 色相検証不要' : 'Low Saturation - No Hue Check'}
                                     </span>
                                 </div>
                             );
                         }
                         const fullMixedHex = mixboxMultiBlend(
                             mixLayers.map(layer => ({ hex: layer.color, weight: layer.volume }))
                         );
                         const hueVerification = calculateHueAccuracy(color.hex, fullMixedHex);
                         const statusConfig: Record<string, { icon: React.ReactNode; text: string; color: string; bgColor: string }> = {
                             excellent: {
                                 icon: <CheckCircleIcon className="w-3.5 h-3.5" weight="fill" />,
                                 text: lang === 'zh' ? '色相极准' : lang === 'ja' ? '色相精確' : 'Hue Excellent',
                                 color: 'text-green-600 dark:text-green-400',
                                 bgColor: 'bg-green-50 dark:bg-green-900/20'
                             },
                             good: {
                                 icon: <CheckCircleIcon className="w-3.5 h-3.5" weight="bold" />,
                                 text: lang === 'zh' ? '色相良好' : lang === 'ja' ? '色相良好' : 'Hue Good',
                                 color: 'text-blue-600 dark:text-blue-400',
                                 bgColor: 'bg-blue-50 dark:bg-blue-900/20'
                             },
                             fair: {
                                 icon: <WarningIcon className="w-3.5 h-3.5" weight="bold" />,
                                 text: lang === 'zh' ? '色相偏移' : lang === 'ja' ? '色相ずれ' : 'Hue Shift',
                                 color: 'text-yellow-600 dark:text-yellow-400',
                                 bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
                             },
                             poor: {
                                 icon: <XCircleIcon className="w-3.5 h-3.5" weight="bold" />,
                                 text: lang === 'zh' ? '色相偏差' : lang === 'ja' ? '色相偏差' : 'Hue Poor',
                                 color: 'text-red-600 dark:text-red-400',
                                 bgColor: 'bg-red-50 dark:bg-red-900/20'
                             }
                         };
                         const config = statusConfig[hueVerification.status];
                         return (
                             <div className={`mb-2 px-2.5 py-1.5 rounded-lg text-[10px] flex items-center justify-between ${config.bgColor}`}>
                                 <span className={`flex items-center gap-1 font-medium ${config.color}`}>
                                     {config.icon}
                                     {config.text}
                                 </span>
                                 <span className={`font-mono ${config.color} opacity-80`}>
                                     {hueVerification.accuracy.toFixed(0)}% (Δ{hueVerification.hueDiff.toFixed(0)}°)
                                 </span>
                             </div>
                         );
                     })()}
                     
                     {legendLayers.map((layer, i) => {
                         const rolePillClass =
                           layer.role === 'base'
                             ? 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                             : layer.role === 'cmy'
                             ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300'
                             : layer.role === 'secondary'
                             ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                             : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';

                         return (
                           <div
                             key={i}
                             className="flex justify-between items-center text-xs group p-1.5 hover:bg-white dark:hover:bg-slate-700/70 rounded-lg border border-transparent hover:border-slate-200/70 dark:hover:border-slate-600/60 transition-colors"
                           >
                             <div className="flex items-center gap-2 min-w-0">
                               <div
                                 className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 shadow-xs shrink-0"
                                 style={{ backgroundColor: layer.color }}
                               />
                               <div className="min-w-0 flex flex-col">
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                   <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${rolePillClass}`}>
                                     {layer.roleBadge}
                                   </span>
                                   <span className="text-slate-700 dark:text-slate-200 font-mono font-bold">
                                     {layer.displayCode}
                                   </span>
                                   <span className="text-slate-700 dark:text-slate-200 font-semibold truncate">
                                     {layer.fullName}
                                   </span>
                                 </div>
                                 {layer.propertyHint && (
                                   <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                     {layer.propertyHint}
                                   </span>
                                 )}
                               </div>
                             </div>
                             <span className="font-bold font-mono text-slate-700 dark:text-slate-200 shrink-0 ml-2">
                               {dropParts[i]?.drops
                                 ? `${dropParts[i].drops * dropMultiplier}${t.dropUnit} · `
                                 : ''}
                               {layer.volume.toFixed(1)}ml
                             </span>
                           </div>
                         );
                     })}
                 </div>
              </div>

              {/* Compact Side-by-Side Cards: RAL Standard + Simplified HSB/LAB Analysis (Eliminates Left Column Bottom Void) */}
              {(ralMatch || professionalRecipe) && (
                <div className="w-full mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                  {/* 1. Compact RAL Color Match Card */}
                  {ralMatch && (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-[11px] font-bold text-orange-500 tracking-wider">
                          {t.ralStandard || 'RAL 工业标准色'}
                        </h3>
                        <span className="bp-badge text-[9px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-bold">
                          {t.industryStandard || '工业标准色系统'}
                        </span>
                      </div>
                      <div className="bp-subcard-lg flex-1 flex items-center gap-3 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-700 p-2.5 rounded-lg border border-orange-200 dark:border-orange-900/30 shadow-xs">
                        <div
                          className="bp-swatch w-11 h-11 rounded-lg border-2 border-white dark:border-slate-600 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: ralMatch.hex }}
                        />
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="font-mono text-sm font-black text-orange-600 dark:text-orange-400 truncate">
                            RAL {ralMatch.ral}
                          </div>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate mt-0.5">
                            {ralMatch.name}
                          </div>
                          <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                            <span>LRV: {ralMatch.lrv.toFixed(1)}%</span>
                            <span>HEX: {ralMatch.hex}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Compact HSB + LAB Analysis Card */}
                  {professionalRecipe && (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-[11px] font-bold text-macaron-green tracking-wider">
                          {lang === 'zh' ? '专业色彩分析' : lang === 'ja' ? '色彩パラメータ分析' : 'Color Analysis'}
                        </h3>
                        <div className="flex items-center gap-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-0.5 ${
                              professionalRecipe.strategy === 'high-brightness'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : professionalRecipe.strategy === 'mid-brightness'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-slate-700 text-white dark:bg-slate-600'
                            }`}
                          >
                            {professionalRecipe.strategy === 'high-brightness' && (
                              <>
                                <SunIcon className="w-2.5 h-2.5" />
                                <span>高明度</span>
                              </>
                            )}
                            {professionalRecipe.strategy === 'mid-brightness' && (
                              <>
                                <PaletteIcon className="w-2.5 h-2.5" />
                                <span>中明度</span>
                              </>
                            )}
                            {professionalRecipe.strategy === 'low-brightness' && (
                              <>
                                <MoonIcon className="w-2.5 h-2.5" />
                                <span>低明度</span>
                              </>
                            )}
                          </span>
                          <span className="bp-badge text-[9px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                            HSB+LAB
                          </span>
                        </div>
                      </div>

                      <div className="bp-subcard-lg flex-1 grid grid-cols-2 gap-2 font-mono text-[10px] text-slate-700 dark:text-slate-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/30 shadow-xs">
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-extrabold">
                            HSB 分析
                          </div>
                          <div className="truncate">
                            H: {professionalRecipe.hsb.h}° (
                            {professionalRecipe.hsb.h >= 0 && professionalRecipe.hsb.h < 60
                              ? '红-橙'
                              : professionalRecipe.hsb.h < 120
                              ? '黄-绿'
                              : professionalRecipe.hsb.h < 180
                              ? '绿-青'
                              : professionalRecipe.hsb.h < 240
                              ? '青-蓝'
                              : professionalRecipe.hsb.h < 300
                              ? '蓝-紫'
                              : '紫-红'}
                            )
                          </div>
                          <div>
                            S: {professionalRecipe.hsb.s}% · B: {professionalRecipe.hsb.b}%
                          </div>
                        </div>

                        <div className="space-y-0.5 border-l border-purple-200/60 dark:border-slate-600/60 pl-2">
                          <div className="text-[10px] text-pink-600 dark:text-pink-400 font-extrabold">
                            LAB 分析
                          </div>
                          <div>L*: {professionalRecipe.lab.l.toFixed(1)}</div>
                          <div>
                            a*: {professionalRecipe.lab.a.toFixed(1)} · b*: {professionalRecipe.lab.b.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
         </div>

         {/* Right: Selection & Brand Matches */}
         <div className="min-w-0 w-full flex flex-col gap-5 pr-1.5 pb-1.5">
             <BrandMatchPanel
               hex={color.hex}
               lang={lang}
               selectable
               selectedId={selectedBasePaint?.id}
               assignedId={color.assignedPaint?.id}
               hasSamplePoint={typeof color.sampleX === "number" && typeof color.sampleY === "number"}
               onSelect={handleBasePaintToggle}
               onAssignCatalog={onAssignCatalogPaint}
             />
         </div>
      </div>
    </div>
  );
};

export default MixerResult;