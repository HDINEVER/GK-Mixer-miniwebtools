import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ColorData, PaintBrand, RALColor, Language, ColorSpace } from '../types';
import { generatePaintRecipe } from '../services/geminiService';
import { findNearestPaints, findNearestRAL, hexToRgb, rgbToCmyk, mixboxBlend, calculateMixboxRatios, calculateProfessionalRecipe, BASE_MIXING_COLORS } from '../utils/colorUtils';
import { translations } from '../utils/translations';
import * as mixbox from '../utils/mixbox';

// Mixing Mode Types (simplified to 2 modes)
type MixingMode = 'mixbox' | 'professional';

declare var anime: any;

// Helper: Calculate relative luminance (perceived brightness)
// Uses ITU-R BT.709 coefficients for perceptual brightness
const getLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  // sRGB to linear conversion
  const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  // Perceptual luminance (0.0 - 1.0)
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
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

interface MixerResultProps {
  color: ColorData | null;
  lang: Language;
  colorSpace?: ColorSpace;
}

interface Layer {
    color: string;
    heightPercent: number;
    volume: number;
    label: string;
    textColor: string;
    isBase?: boolean;
}

const MixerResult: React.FC<MixerResultProps> = ({ color, lang, colorSpace = 'srgb' }) => {
  const [recipe, setRecipe] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [nearest, setNearest] = useState<PaintBrand[]>([]);
  const [ralMatch, setRalMatch] = useState<RALColor | null>(null);
  const [bottleVolume, setBottleVolume] = useState<number>(20); // Default to 20ml
  const [selectedBasePaint, setSelectedBasePaint] = useState<PaintBrand | null>(null);
  const [mixingMode, setMixingMode] = useState<MixingMode>('mixbox');
  const [professionalRecipe, setProfessionalRecipe] = useState<ReturnType<typeof calculateProfessionalRecipe> | null>(null);
  
  const t = translations[lang];
  const bottleRef = useRef<HTMLDivElement>(null);
  const cmykRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Update CMYK Bars Animation
  useEffect(() => {
    if (color && cmykRefs.current.length === 4) {
        anime({
            targets: cmykRefs.current,
            width: (el: HTMLElement) => el.dataset.width,
            duration: 1000,
            easing: 'easeOutQuart',
            delay: anime.stagger(100)
        });
    }
  }, [color]);

  useEffect(() => {
    if (color) {
      setLoading(true);
      setRecipe('');
      setProfessionalRecipe(null);
      
      const found = findNearestPaints(color.hex);
      setNearest(found);
      
      // Find nearest RAL color
      const ral = findNearestRAL(color.rgb);
      setRalMatch(ral);
      
      // Don't auto-select base paint, only provide recommendations
      setSelectedBasePaint(null);

      // Generate AI recipe for non-professional modes
      if (mixingMode !== 'professional') {
        generatePaintRecipe(color, lang).then(res => {
          setRecipe(res);
          setLoading(false);
        });
      } else {
        // Generate professional recipe
        const profRecipe = calculateProfessionalRecipe(color.hex);
        setProfessionalRecipe(profRecipe);
        setLoading(false);
      }
    }
  }, [color, lang, mixingMode]);

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
      const baseColors = BASE_MIXING_COLORS; // Always use BASE_MIXING_COLORS
      
      if (selectedBasePaint) {
        // --- BASE PAINT MODE ---
        // Use Mixbox to calculate how to mix from selected base paint to target
        
        const baseRgb = hexToRgb(selectedBasePaint.hex);
        const ratios = calculateMixboxRatios(color.hex, colorSpace);
        
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
            textColor: selectedBasePaint.name.includes('白') || selectedBasePaint.name.includes('White') ? '#000' : '#fff',
            isBase: true
        });

        // Add other base colors if needed
        otherRatios.forEach((ratio, index) => {
          if (ratio > 1) {
            const baseColor = baseColors[index];
            layers.push({
              color: baseColor.hex,
              heightPercent: getH(ratio),
              volume: getVol(ratio),
              label: baseColor.code,
              textColor: baseColor.hex === '#FFFFFF' ? '#000' : '#fff',
              isBase: false
            });
          }
        });

      } else {
        // --- PURE MIXING MODE (No Base Paint Selected) ---
        
        if (mixingMode === 'professional') {
          // Professional mode uses HSB analysis
          const recipe = calculateProfessionalRecipe(color.hex);
          setProfessionalRecipe(recipe);
          
          // Use ratios from professional recipe
          const totalWeight = recipe.ratios.reduce((sum, r) => sum + r.percentage, 0);
          
          recipe.ratios.forEach(item => {
            const weight = item.percentage;
            if (weight > 1) {
              // Parse color from label
              let hex = '#808080';
              if (item.color.includes('白') || item.color.includes('White')) hex = '#FFFFFF';
              else if (item.color.includes('黑') || item.color.includes('Black')) hex = '#000000';
              else if (item.color.includes('红') || item.color.includes('Red')) hex = '#FF0000';
              else if (item.color.includes('蓝') || item.color.includes('Blue')) hex = '#0000FF';
              else if (item.color.includes('黄') || item.color.includes('Yellow')) hex = '#FFFF00';
              
              layers.push({
                color: hex,
                heightPercent: (weight / totalWeight) * 100,
                volume: (weight / totalWeight) * bottleVolume,
                label: item.color.match(/\d+/)?.[0] || item.color.split(' ')[0],
                textColor: hex === '#FFFFFF' ? '#000' : '#fff',
                isBase: hex === '#FFFFFF' || hex === '#000000'
              });
            }
          });
          
        } else {
          // Mixbox, CMY-Pigment, CMY-Solid modes use Mixbox inverse algorithm
          const weights = calculateMixboxRatios(color.hex, colorSpace);
          const totalWeight = weights.reduce((a, b) => a + b, 0);
          
          if (totalWeight < 0.1) {
            layers.push({
              color: '#808080',
              heightPercent: 100,
              volume: bottleVolume,
              label: 'Gray',
              textColor: '#fff',
              isBase: true
            });
          } else {
            const getVol = (weight: number) => (weight / totalWeight) * bottleVolume;
            const getH = (weight: number) => (weight / totalWeight) * 100;
            
            weights.forEach((weight, index) => {
              if (weight > 1 && index < baseColors.length) {
                const baseColor = baseColors[index];
                const isWhite = baseColor.hex === '#FFFFFF';
                
                layers.push({
                  color: baseColor.hex,
                  heightPercent: getH(weight),
                  volume: getVol(weight),
                  label: baseColor.code,
                  textColor: isWhite ? '#000' : '#fff',
                  isBase: index < 2
                });
              }
            });
          }
        }
      }

      return layers.reverse();
  }, [color, selectedBasePaint, bottleVolume, mixingMode]);

  useEffect(() => {
    if (bottleRef.current && color) {
       // Stop existing animations
       anime.remove(bottleRef.current.children);
       
       // Animate height from 0 or current
       anime({
         targets: bottleRef.current.children,
         height: (el: HTMLElement) => el.dataset.targetHeight,
         opacity: [0, 1],
         duration: 800,
         easing: 'easeOutElastic(1, .8)',
         delay: anime.stagger(50)
       });
    }
  }, [mixLayers]);

  if (!color) {
    return (
      <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 font-mono text-sm border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl p-10">
        {t.noColor}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-macaron-blue/30 dark:border-slate-700 shadow-sm p-3 md:p-5 overflow-hidden transition-colors duration-300">
      
      {/* Top Section: Color Info & CMYK Dashboard */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 border-b border-slate-100 dark:border-slate-800 pb-4 md:pb-6 mb-4 md:mb-6">
        {/* Swatch & Hex */}
        <div className="flex items-center gap-4 min-w-[200px]">
            <div 
                className="w-20 h-20 rounded-2xl shadow-inner border-2 border-slate-100 dark:border-slate-700"
                style={{ backgroundColor: color.hex }}
            />
            <div>
                <div className="text-3xl font-bold text-slate-700 dark:text-slate-200 font-mono tracking-tighter">{color.hex}</div>
                <div className="text-xs font-mono text-slate-400 mt-1">
                    RGB: {color.rgb.r}, {color.rgb.g}, {color.rgb.b}
                </div>
                {selectedBasePaint && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-[10px]">
                        <div className="text-slate-500 dark:text-slate-400 mb-1">Mixbox Preview:</div>
                        <div 
                            className="w-12 h-8 rounded border border-slate-300 dark:border-slate-600 shadow-sm"
                            style={{ backgroundColor: mixboxBlend(selectedBasePaint.hex, color.hex, 0.5) }}
                            title="50% base + 50% target (Physical blend)"
                        />
                    </div>
                )}
            </div>
        </div>

        {/* CMYK Bars */}
        <div className="flex-1 grid grid-cols-1 gap-2">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
              <span>{lang === 'zh' ? '色源分解' : lang === 'ja' ? '色源分解' : 'Color Source Decomposition'}</span>
              <span className="opacity-60">| CMYK (印刷四色)</span>
            </div>
            {(() => {
                // 计算底漆需求：使用亮度算法
                const luminance = getLuminance(color.rgb);
                const primerPercent = Math.round(Math.max(0, (0.5 - luminance) * 100));
                
                return [
                    { l: 'C', v: color.cmyk.c, hex: '#00B7EB', name: lang === 'zh' ? '印刷青' : lang === 'ja' ? 'シアン' : 'Cyan' },
                    { l: 'M', v: color.cmyk.m, hex: '#FF0090', name: lang === 'zh' ? '印刷品红' : lang === 'ja' ? 'マゼンタ' : 'Magenta' },
                    { l: 'Y', v: color.cmyk.y, hex: '#FFEF00', name: lang === 'zh' ? '印刷黄' : lang === 'ja' ? 'イエロー' : 'Yellow' },
                    { l: 'K', v: primerPercent, hex: '#808080', name: lang === 'zh' ? '底漆' : lang === 'ja' ? 'プライマー' : 'Primer' }
                ].map((item, i) => (
                    <div key={item.l} className="flex items-center gap-3">
                        <span className="font-mono font-bold w-4 text-slate-700 dark:text-slate-300" title={item.name}>{item.l}</span>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                ref={el => cmykRefs.current[i] = el}
                                data-width={`${item.v}%`}
                                className="h-full rounded-full opacity-80"
                                style={{ 
                                    width: '0%', 
                                    backgroundColor: item.hex
                                }} 
                            />
                        </div>
                        <span className="font-mono text-xs w-8 text-right text-slate-400">{item.v}%</span>
                    </div>
                ));
            })()}
        </div>
      </div>

      {/* Mixing Mode Selector */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 md:pb-6 mb-4 md:mb-6">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
          {lang === 'zh' ? '混色算法' : lang === 'ja' ? '混色アルゴリズム' : 'Mixing Algorithm'}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMixingMode('mixbox')}
            className={`px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
              mixingMode === 'mixbox'
                ? 'border-macaron-blue bg-macaron-blue/10 text-macaron-blue dark:bg-macaron-blue/20'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-macaron-blue/50'
            }`}
          >
            <div className="font-bold mb-1">🎨 Mixbox</div>
            <div className="text-xs opacity-70">
              {lang === 'zh' ? '物理混色算法' : lang === 'ja' ? '物理混色' : 'Physical Mixing'}
            </div>
          </button>
          
          <button
            onClick={() => setMixingMode('professional')}
            className={`px-4 py-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
              mixingMode === 'professional'
                ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-purple-500/50'
            }`}
          >
            <div className="font-bold mb-1">✨ Professional</div>
            <div className="text-xs opacity-70">
              {lang === 'zh' ? 'HSB 专业喷涂' : lang === 'ja' ? 'プロ塗装' : 'Pro Spray Painting'}
            </div>
          </button>
        </div>
        
        {/* Mode Description */}
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-600 dark:text-slate-400">
          {mixingMode === 'mixbox' && (
            lang === 'zh' 
              ? 'Mixbox 2.0 物理混色算法 - 基于 7 维潜在空间模拟真实颜料混合,蓝+黄=绿(非灰色)'
              : lang === 'ja'
              ? 'Mixbox 2.0 物理混色アルゴリズム - 7 次元潜在空間による物理的な絵の具混合シミュレーション'
              : 'Mixbox 2.0 Physical Mixing - 7D latent space simulation, Blue+Yellow=Green (not Gray)'
          )}
          {mixingMode === 'professional' && (
            lang === 'zh'
              ? 'HSB 专业喷涂算法 - 基于明度分层策略:高明度(白底调色) | 中明度(标准混合) | 低明度(黑底提亮)'
              : lang === 'ja'
              ? 'HSB プロ塗装アルゴリズム - 明度分析による専門的な調色プロセス'
              : 'HSB Professional Algorithm - Brightness-based strategy: High(White base) | Mid(Standard) | Low(Black base)'
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* Left Column: Bottle & Base Paint Selection */}
        <div className="flex flex-col">
             <div className="w-full flex justify-between items-center mb-4">
                 <h3 className="text-xs font-bold text-macaron-blue tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 bg-macaron-blue rounded-full"></span>
                    {t.mixingBottle}
                </h3>
             </div>

             {/* Volume Buttons (Moved outside header for space) */}
             <div className="w-full mb-6">
                <div className="flex justify-between bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {[10, 20, 30, 40, 50, 60].map(v => (
                            <button
                            key={v}
                            onClick={() => setBottleVolume(v)}
                            className={`flex-1 py-1.5 text-[10px] sm:text-xs font-mono font-bold rounded-md transition-all ${bottleVolume === v ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {v}ml
                            </button>
                    ))}
                </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                
                {/* Bottle Graphic */}
                <div className="relative mx-auto sm:mx-0 flex flex-col items-center">
                    {/* Bottle Neck */}
                    <div className="w-16 h-4 bg-slate-200 dark:bg-slate-600 mx-auto rounded-t-sm border-x border-t border-slate-300 dark:border-slate-500 opacity-50"></div>
                    
                    {/* Bottle Body */}
                    <div className="relative w-28 h-56 border-2 border-slate-400 dark:border-slate-500 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden z-10">
                        
                        {/* Ticks */}
                        <div className="absolute right-0 top-0 h-full w-full pointer-events-none z-20 flex flex-col justify-end pb-0">
                             {[...Array(11)].map((_, i) => (
                                 <div key={i} className="w-full flex justify-end items-center pr-1 border-t border-slate-300/30 dark:border-slate-500/30 h-[10%] relative">
                                     <span className="text-[9px] font-mono text-slate-400 mr-1">{i * 10}%</span>
                                     <div className="w-2 h-px bg-slate-400"></div>
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
                                    {layer.heightPercent > 5 && (
                                        <span 
                                            className="text-[10px] font-bold font-mono opacity-80 drop-shadow-md"
                                            style={{ color: layer.textColor }}
                                        >
                                            {layer.label}
                                        </span>
                                    )}
                                    {/* Hover Tooltip */}
                                    <div className="absolute left-full ml-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-30 pointer-events-none shadow-lg">
                                        {layer.volume.toFixed(1)}ml ({Math.round(layer.heightPercent)}%)
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Reflection overlay */}
                    <div className="absolute top-4 left-2 w-2 h-48 bg-white opacity-20 rounded-full blur-[1px] z-20 pointer-events-none"></div>
                </div>

                {/* Legend / List */}
                <div className="flex-1 max-h-56 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-2">
                        <span>{t.totalVolume}: {bottleVolume}ml</span>
                        <span className="text-macaron-purple">{selectedBasePaint ? 'BASE MODE' : 'PURE MODE'}</span>
                     </div>
                     
                     {/* Color Analysis Section */}
                     {mixLayers.length > 1 && (() => {
                         // 计算除底漆外的彩色漆混合颜色
                         const colorLayers = mixLayers.filter(l => !l.isBase);
                         let mixedColorHex = '#808080'; // 默认灰色
                         
                         if (colorLayers.length > 0) {
                             // 使用 mixbox 混合算法
                             let totalWeight = 0;
                             let latentMix = [0, 0, 0, 0, 0, 0, 0];
                             
                             colorLayers.forEach(layer => {
                                 const weight = layer.volume;
                                 totalWeight += weight;
                                 // layer.color 是 hex 字符串，需要转换为 RGB
                                 const rgb = hexToRgb(layer.color);
                                 if (rgb) {
                                     const latent = mixbox.rgbToLatent(rgb.r, rgb.g, rgb.b);
                                     if (latent) {
                                         for (let k = 0; k < latent.length; k++) {
                                             latentMix[k] += latent[k] * weight;
                                         }
                                     }
                                 }
                             });
                             
                             if (totalWeight > 0) {
                                 for (let k = 0; k < latentMix.length; k++) {
                                     latentMix[k] /= totalWeight;
                                 }
                                 const mixedRgb = mixbox.latentToRgb(latentMix);
                                 if (mixedRgb) {
                                     const r = Math.round(mixedRgb[0]).toString(16).padStart(2, '0');
                                     const g = Math.round(mixedRgb[1]).toString(16).padStart(2, '0');
                                     const b = Math.round(mixedRgb[2]).toString(16).padStart(2, '0');
                                     mixedColorHex = `#${r}${g}${b}`;
                                 }
                             }
                         }
                         
                         return (
                             <>
                                 {/* 彩色漆混合结果 */}
                                 <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 p-2 rounded-lg border border-blue-200 dark:border-blue-900/30 mb-2">
                                     <div className="flex items-center gap-2">
                                         <div 
                                             className="w-8 h-8 rounded border-2 border-white dark:border-slate-600 shadow-sm flex-shrink-0" 
                                             style={{ backgroundColor: mixedColorHex }}
                                         />
                                         <div className="flex-1 min-w-0">
                                             <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                                 {lang === 'zh' ? '彩色漆混合' : lang === 'ja' ? 'カラー混合' : 'Color Mix'}
                                             </div>
                                             <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                                                 {mixedColorHex.toUpperCase()}
                                             </div>
                                         </div>
                                     </div>
                                     
                                     {/* 色相准确度验证 */}
                                     {(() => {
                                         if (!color) return null;
                                         
                                         // 检查目标颜色饱和度，低饱和度不显示色相验证
                                         const targetRgb = hexToRgb(color.hex);
                                         if (!targetRgb) return null;
                                         
                                         const targetHsb = rgbToHsb(targetRgb.r, targetRgb.g, targetRgb.b);
                                         
                                         // 饱和度 < 15% 的颜色不显示色相验证（色相太弱，验证无意义）
                                         if (targetHsb.s < 15) {
                                             return (
                                                 <div className="mt-2 px-2 py-1 rounded text-[10px] flex items-center justify-center bg-slate-50 dark:bg-slate-800/50">
                                                     <span className="text-slate-400 dark:text-slate-500 font-medium">
                                                         {lang === 'zh' ? '低饱和度 - 无需色相验证' : lang === 'ja' ? '低彩度 - 色相検証不要' : 'Low Saturation - No Hue Check'}
                                                     </span>
                                                 </div>
                                             );
                                         }
                                         
                                         const hueVerification = calculateHueAccuracy(color.hex, mixedColorHex);
                                         
                                         const statusConfig = {
                                             excellent: {
                                                 icon: '✓',
                                                 text: lang === 'zh' ? '色相极准' : lang === 'ja' ? '色相精確' : 'Hue Excellent',
                                                 color: 'text-green-600 dark:text-green-400',
                                                 bgColor: 'bg-green-50 dark:bg-green-900/20'
                                             },
                                             good: {
                                                 icon: '✓',
                                                 text: lang === 'zh' ? '色相良好' : lang === 'ja' ? '色相良好' : 'Hue Good',
                                                 color: 'text-blue-600 dark:text-blue-400',
                                                 bgColor: 'bg-blue-50 dark:bg-blue-900/20'
                                             },
                                             fair: {
                                                 icon: '△',
                                                 text: lang === 'zh' ? '色相偏移' : lang === 'ja' ? '色相ずれ' : 'Hue Shift',
                                                 color: 'text-yellow-600 dark:text-yellow-400',
                                                 bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
                                             },
                                             poor: {
                                                 icon: '✗',
                                                 text: lang === 'zh' ? '色相偏差' : lang === 'ja' ? '色相偏差' : 'Hue Poor',
                                                 color: 'text-red-600 dark:text-red-400',
                                                 bgColor: 'bg-red-50 dark:bg-red-900/20'
                                             }
                                         };
                                         
                                         const config = statusConfig[hueVerification.status];
                                         
                                         return (
                                             <div className={`mt-2 px-2 py-1 rounded text-[10px] flex items-center justify-between ${config.bgColor}`}>
                                                 <span className={`flex items-center gap-1 font-medium ${config.color}`}>
                                                     <span className="font-bold text-xs">{config.icon}</span>
                                                     {config.text}
                                                 </span>
                                                 <span className={`font-mono ${config.color} opacity-80`}>
                                                     {hueVerification.accuracy.toFixed(0)}% (Δ{hueVerification.hueDiff.toFixed(0)}°)
                                                 </span>
                                             </div>
                                         );
                                     })()}
                                 </div>
                             </>
                         );
                     })()}
                     
                     {mixLayers.slice().reverse().map((layer, i) => ( 
                         <div key={i} className="flex justify-between items-center text-xs group p-1 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors">
                             <div className="flex items-center gap-2">
                                 <div className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{backgroundColor: layer.color}}></div>
                                 <span className="text-slate-600 dark:text-slate-300 font-mono">
                                    {layer.isBase ? t.basePaint : '+ '} 
                                    {layer.label}
                                 </span>
                             </div>
                             <span className="font-bold font-mono text-slate-700 dark:text-slate-200">{layer.volume.toFixed(1)}ml</span>
                         </div>
                     ))}
                </div>
             </div>

            {/* Base Paint Selection - Moved below bottle */}
            <div className="mt-4">
                <h3 className="text-xs font-bold text-macaron-purple tracking-wider mb-2 flex items-center gap-2">
                  {t.closestMatches}
                  <span className="text-[10px] font-normal bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
                    {lang === 'zh' ? '推荐' : lang === 'ja' ? '推奨' : 'Recommended'}
                  </span>
                </h3>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                  {lang === 'zh' ? '点击选择作为底漆,或直接使用纯混合模式' : lang === 'ja' ? 'ベースペイントとして選択、または純粋な混合モードを使用' : 'Click to use as base paint, or use pure mixing mode'}
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {nearest.map((paint) => (
                    <button 
                        key={paint.id} 
                        onClick={() => handleBasePaintToggle(paint)}
                        className={`flex items-center gap-2 p-2 rounded-md transition-all border text-left ${selectedBasePaint?.id === paint.id ? 'bg-macaron-purple/10 border-macaron-purple ring-1 ring-macaron-purple' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <div className="w-6 h-6 rounded border border-slate-200 dark:border-slate-600 shadow-sm flex-shrink-0" style={{ backgroundColor: paint.hex }}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-1">
                            <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">[{paint.brand}] {paint.code}</span>
                            {selectedBasePaint?.id === paint.id && (
                                <span className="text-[9px] bg-macaron-purple text-white px-1 rounded flex-shrink-0">
                                    ✓
                                </span>
                            )}
                        </div>
                        <span className="font-mono text-[9px] text-slate-500 dark:text-slate-500 truncate block">{paint.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Deselect Hint */}
                {selectedBasePaint && (
                    <div className="text-[10px] text-slate-400 text-center mt-2 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300" onClick={() => setSelectedBasePaint(null)}>
                        {t.tapToDeselect}
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: RAL Standard & Professional Recipe */}
        <div className="flex flex-col gap-6">
            
            {/* RAL Color Match */}
            {ralMatch && (
                <div>
                    <h3 className="text-xs font-bold text-orange-500 tracking-wider mb-3">
                        {t.ralStandard || 'RAL Standard'}
                    </h3>
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-lg border-2 border-orange-200 dark:border-orange-900/30 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div 
                                className="w-16 h-16 rounded-lg border-2 border-white dark:border-slate-600 shadow-md flex-shrink-0" 
                                style={{ backgroundColor: ralMatch.hex }}
                            />
                            <div className="flex-1">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="font-mono text-lg font-bold text-orange-600 dark:text-orange-400">
                                        RAL {ralMatch.ral}
                                    </span>
                                    <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">
                                        {t.industryStandard || 'Industry Standard'}
                                    </span>
                                </div>
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                    {ralMatch.name}
                                </div>
                                <div className="flex gap-4 text-[10px] text-slate-500 dark:text-slate-400">
                                    <div>
                                        <span className="font-mono">{t.ralLrv || 'LRV'}:</span> {ralMatch.lrv.toFixed(1)}%
                                    </div>
                                    <div>
                                        <span className="font-mono">HEX:</span> {ralMatch.hex}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Professional Recipe Analysis (only shown in professional mode) */}
            {mixingMode === 'professional' && (
            <div className="flex-1 flex flex-col">
                <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 tracking-wider mb-3 flex justify-between items-center">
                  {lang === 'zh' ? '专业配方分析' : lang === 'ja' ? 'プロレシピ分析' : 'Professional Recipe Analysis'}
                  <span className="text-[10px] font-normal opacity-50 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                     HSB+LAB
                  </span>
                </h3>
                
                {professionalRecipe ? (
                  /* Professional Mode Display */
                  <div className="flex-1 font-mono text-xs text-slate-600 dark:text-slate-300 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-900/30 overflow-y-auto max-h-[400px] custom-scrollbar space-y-3">
                    
                    {/* Strategy Badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        professionalRecipe.strategy === 'high-brightness' 
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : professionalRecipe.strategy === 'mid-brightness'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-slate-700 text-white dark:bg-slate-600'
                      }`}>
                        {professionalRecipe.strategy === 'high-brightness' && '☀️ 高明度'}
                        {professionalRecipe.strategy === 'mid-brightness' && '🎨 中明度'}
                        {professionalRecipe.strategy === 'low-brightness' && '🌙 低明度'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        B={professionalRecipe.hsb.b}%
                      </span>
                    </div>
                    
                    {/* HSB & LAB Analysis */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-white/50 dark:bg-slate-900/30 rounded border border-purple-100 dark:border-purple-900/20">
                      <div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mb-1">HSB 分析</div>
                        <div className="space-y-0.5 text-[10px]">
                          <div>H: {professionalRecipe.hsb.h}° ({professionalRecipe.hsb.h >= 0 && professionalRecipe.hsb.h < 60 ? '红-橙' : professionalRecipe.hsb.h < 120 ? '黄-绿' : professionalRecipe.hsb.h < 180 ? '绿-青' : professionalRecipe.hsb.h < 240 ? '青-蓝' : professionalRecipe.hsb.h < 300 ? '蓝-紫' : '紫-红'})</div>
                          <div>S: {professionalRecipe.hsb.s}%</div>
                          <div>B: {professionalRecipe.hsb.b}%</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-pink-600 dark:text-pink-400 font-bold mb-1">LAB 分析</div>
                        <div className="space-y-0.5 text-[10px]">
                          <div>L*: {professionalRecipe.lab.l.toFixed(1)}</div>
                          <div>a*: {professionalRecipe.lab.a.toFixed(1)}</div>
                          <div>b*: {professionalRecipe.lab.b.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Mixing Steps */}
                    <div>
                      <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mb-2">📋 调色步骤</div>
                      <div className="space-y-1.5 text-[10px] leading-relaxed">
                        {professionalRecipe.steps.map((step, idx) => (
                          <div key={idx} className={step.trim().match(/^\d+\./) ? 'font-semibold mt-2' : 'pl-4 text-slate-600 dark:text-slate-400'}>
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Ratios Summary */}
                    <div className="p-3 bg-purple-100/50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                      <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mb-2">⚖️ 配比总结</div>
                      <div className="space-y-1">
                        {professionalRecipe.ratios.map((ratio, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[10px]">
                            <span className="font-mono">{ratio.color}</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">{ratio.percentage.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-purple-500 animate-pulse bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 min-h-[200px]">
                     <svg className="w-6 h-6 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <span className="font-mono text-xs">{t.analyzing}</span>
                  </div>
                ) : null}
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MixerResult;