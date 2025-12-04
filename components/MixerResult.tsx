import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ColorData, PaintBrand, Language } from '../types';
import { generatePaintRecipe } from '../services/geminiService';
import { findNearestPaints, hexToRgb, rgbToCmyk, mixboxBlend } from '../utils/colorUtils';
import { translations } from '../utils/translations';

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

interface MixerResultProps {
  color: ColorData | null;
  lang: Language;
}

type MixMode = 'CMYK' | 'PAINT';

interface Layer {
    color: string;
    heightPercent: number;
    volume: number;
    label: string;
    textColor: string;
    isBase?: boolean;
}

const MixerResult: React.FC<MixerResultProps> = ({ color, lang }) => {
  const [recipe, setRecipe] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [nearest, setNearest] = useState<PaintBrand[]>([]);
  const [bottleVolume, setBottleVolume] = useState<number>(20); // Default to 20ml
  const [selectedBasePaint, setSelectedBasePaint] = useState<PaintBrand | null>(null);
  const [mixMode, setMixMode] = useState<MixMode>('CMYK');
  
  const t = translations[lang];
  const bottleRef = useRef<HTMLDivElement>(null);
  const cmykRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Update CMY Bars Animation (removed K)
  useEffect(() => {
    if (color && cmykRefs.current.length === 3) {
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
      
      const found = findNearestPaints(color.hex);
      setNearest(found);
      
      // Auto-select the first match, but allow deselection later
      if (found.length > 0) {
          setSelectedBasePaint(found[0]);
      } else {
          setSelectedBasePaint(null);
      }

      generatePaintRecipe(color, lang).then(res => {
        setRecipe(res);
        setLoading(false);
      });
    }
  }, [color, lang]);

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
      
      if (selectedBasePaint) {
        // --- BASE PAINT MODE ---
        // Calculate difference between Target and Base
        const targetCmyk = color.cmyk;
        const baseRgb = hexToRgb(selectedBasePaint.hex);
        const baseCmyk = rgbToCmyk(baseRgb.r, baseRgb.g, baseRgb.b);

        const diffC = Math.max(0, targetCmyk.c - baseCmyk.c);
        const diffM = Math.max(0, targetCmyk.m - baseCmyk.m);
        const diffY = Math.max(0, targetCmyk.y - baseCmyk.y);
        const diffK = Math.max(0, targetCmyk.k - baseCmyk.k);
        
        let basePart = 100; // Arbitrary weight for the base paint
        
        const totalParts = basePart + diffC + diffM + diffY + diffK;
        
        const getVol = (part: number) => (part / totalParts) * bottleVolume;
        const getH = (part: number) => (part / totalParts) * 100;

        // Base Layer
        layers.push({
            color: selectedBasePaint.hex,
            heightPercent: getH(basePart),
            volume: getVol(basePart),
            label: selectedBasePaint.code,
            textColor: selectedBasePaint.name.toLowerCase().includes('white') ? '#000' : '#fff',
            isBase: true
        });

        // Additive Layers (only CMY, no K!)
        if (mixMode === 'CMYK') {
            // Removed K channel - only CMY primaries for physical mixing
            if (diffC > 0) layers.push({ color: '#00ffff', heightPercent: getH(diffC), volume: getVol(diffC), label: 'C', textColor: '#000' });
            if (diffM > 0) layers.push({ color: '#ff00ff', heightPercent: getH(diffM), volume: getVol(diffM), label: 'M', textColor: '#fff' });
            if (diffY > 0) layers.push({ color: '#ffff00', heightPercent: getH(diffY), volume: getVol(diffY), label: 'Y', textColor: '#000' });
        } else {
            // Paint mode - use realistic paint colors (no black!)
            if (diffC > 0) layers.push({ color: '#0047AB', heightPercent: getH(diffC), volume: getVol(diffC), label: 'Blu', textColor: '#fff' });
            if (diffM > 0) layers.push({ color: '#DC143C', heightPercent: getH(diffM), volume: getVol(diffM), label: 'Red', textColor: '#fff' });
            if (diffY > 0) layers.push({ color: '#FFD700', heightPercent: getH(diffY), volume: getVol(diffY), label: 'Yel', textColor: '#000' });
        }

      } else {
        // --- PURE CMYK MODE (No Base) ---
        // Intelligently select base color based on target luminance
        const c = color.cmyk.c;
        const m = color.cmyk.m;
        const y = color.cmyk.y;
        const k = color.cmyk.k;
        
        // Calculate perceptual luminance (0.0 = black, 1.0 = white)
        const luminance = getLuminance(color.rgb);
        
        // Smart base selection based on luminance threshold
        // Dark colors (luminance < 0.3) → Black base
        // Light colors (luminance >= 0.3) → White base
        const isDark = luminance < 0.3;
        
        // Base weight calculation:
        // - For dark colors: Use black base, reduce CMY, rely more on base
        // - For light colors: Use white base, traditional CMY mixing
        const baseWeight = isDark 
          ? 100 - (c + m + y) * 0.4  // Dark: high base, low pigment
          : luminance * 100;           // Light: scale with brightness
        
        const totalParts = Math.max(baseWeight, 10) + c + m + y;
        
        const getVol = (part: number) => (part / totalParts) * bottleVolume;
        const getH = (part: number) => (part / totalParts) * 100;

        // Base Layer (White for light colors, Black for dark colors)
        if (baseWeight > 1) {
            layers.push({
                color: isDark ? '#000000' : '#FFFFFF',
                heightPercent: getH(baseWeight),
                volume: getVol(baseWeight),
                label: isDark ? 'Black' : 'White',
                textColor: isDark ? '#fff' : '#000',
                isBase: true
            });
        }

        // CMYK Pigments (only CMY, no K!)
        if (mixMode === 'CMYK') {
             // Removed K channel - only CMY primaries
             if (c > 0) layers.push({ color: '#00ffff', heightPercent: getH(c), volume: getVol(c), label: 'C', textColor: '#000' });
             if (m > 0) layers.push({ color: '#ff00ff', heightPercent: getH(m), volume: getVol(m), label: 'M', textColor: '#fff' });
             if (y > 0) layers.push({ color: '#ffff00', heightPercent: getH(y), volume: getVol(y), label: 'Y', textColor: '#000' });
        } else {
            // "Paint" mode - use realistic paint colors (no black!)
             if (c > 0) layers.push({ color: '#0047AB', heightPercent: getH(c), volume: getVol(c), label: 'Blue', textColor: '#fff' });
             if (m > 0) layers.push({ color: '#DC143C', heightPercent: getH(m), volume: getVol(m), label: 'Red', textColor: '#fff' });
             if (y > 0) layers.push({ color: '#FFD700', heightPercent: getH(y), volume: getVol(y), label: 'Yel', textColor: '#000' });
        }
      }

      return layers.reverse(); // Stack visual: Bottom first in array if flex-col-reverse
  }, [color, selectedBasePaint, bottleVolume, mixMode]);

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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-macaron-blue/30 dark:border-slate-700 shadow-sm p-4 md:p-6 overflow-hidden transition-colors duration-300">
      
      {/* Top Section: Color Info & CMYK Dashboard */}
      <div className="flex flex-col md:flex-row gap-6 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
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

        {/* CMY Bars (removed K for physical paint mixing) */}
        <div className="flex-1 grid grid-cols-1 gap-2">
            {[
                { l: 'C', v: color.cmyk.c, c: 'bg-cyan-400', t: 'text-cyan-600 dark:text-cyan-400' },
                { l: 'M', v: color.cmyk.m, c: 'bg-magenta-500', t: 'text-pink-600 dark:text-pink-400' },
                { l: 'Y', v: color.cmyk.y, c: 'bg-yellow-400', t: 'text-yellow-600 dark:text-yellow-400' }
            ].map((item, i) => (
                <div key={item.l} className="flex items-center gap-3">
                    <span className={`font-mono font-bold w-4 ${item.t}`}>{item.l}</span>
                    <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            ref={el => cmykRefs.current[i] = el}
                            data-width={`${item.v}%`}
                            className={`h-full rounded-full opacity-80 ${item.c}`}
                            style={{ 
                                width: '0%', 
                                backgroundColor: item.l === 'M' ? '#FF00FF' : undefined
                            }} 
                        />
                    </div>
                    <span className="font-mono text-xs w-8 text-right text-slate-400">{item.v}%</span>
                </div>
            ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left: Bottle & Calculator */}
        <div className="flex-1 flex flex-col items-center">
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

             <div className="flex flex-col sm:flex-row gap-6 items-end w-full justify-center bg-slate-50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden min-h-[320px]">
                
                {/* Bottle Graphic */}
                <div className="relative mx-auto sm:mx-0">
                    {/* Bottle Neck */}
                    <div className="w-16 h-4 bg-slate-200 dark:bg-slate-600 mx-auto rounded-t-sm border-x border-t border-slate-300 dark:border-slate-500 opacity-50"></div>
                    
                    {/* Bottle Body */}
                    <div className="relative w-32 h-64 border-2 border-slate-400 dark:border-slate-500 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-xl backdrop-blur-sm overflow-hidden z-10">
                        
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
                    <div className="absolute top-4 left-2 w-2 h-56 bg-white opacity-20 rounded-full blur-[1px] z-20 pointer-events-none"></div>
                </div>

                {/* Legend / List */}
                <div className="w-full sm:flex-1 h-auto sm:h-64 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                     <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-2">
                        <span>{t.totalVolume}: {bottleVolume}ml</span>
                        <span className="text-macaron-purple">{selectedBasePaint ? 'BASE MODE' : 'PURE MODE'}</span>
                     </div>
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

             {/* Mode Switcher */}
             <div className="mt-4 flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full max-w-sm">
                 <button 
                    onClick={() => setMixMode('CMYK')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${mixMode === 'CMYK' ? 'bg-white dark:bg-slate-600 shadow text-macaron-blue' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                     {t.mixModeCMYK}
                 </button>
                 <button 
                    onClick={() => setMixMode('PAINT')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${mixMode === 'PAINT' ? 'bg-white dark:bg-slate-600 shadow text-macaron-pink' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                     {t.mixModePaints}
                 </button>
             </div>
        </div>

        {/* Right: Selection & AI */}
        <div className="flex-1 flex flex-col gap-6">
            
            {/* Nearest Paints Selection */}
            <div>
                <h3 className="text-xs font-bold text-macaron-purple tracking-wider mb-3">
                  {t.closestMatches}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {nearest.map((paint) => (
                    <button 
                        key={paint.id} 
                        onClick={() => handleBasePaintToggle(paint)}
                        className={`w-full flex items-center gap-3 p-2 rounded-md transition-all border ${selectedBasePaint?.id === paint.id ? 'bg-macaron-purple/10 border-macaron-purple ring-1 ring-macaron-purple' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <div className="w-8 h-8 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm flex-shrink-0" style={{ backgroundColor: paint.hex }}></div>
                      <div className="flex-1 text-left">
                        <div className="flex justify-between items-center">
                            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">[{paint.brand}] {paint.code}</span>
                            {selectedBasePaint?.id === paint.id && (
                                <span className="text-[10px] bg-macaron-purple text-white px-1 rounded flex items-center gap-1">
                                    ✓ <span className="hidden sm:inline">ACTIVE</span>
                                </span>
                            )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-500 truncate block">{paint.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Deselect Hint */}
                {selectedBasePaint && (
                    <div className="text-[10px] text-slate-400 text-center mt-2 cursor-pointer hover:text-slate-600" onClick={() => setSelectedBasePaint(null)}>
                        {t.tapToDeselect}
                    </div>
                )}
            </div>

            {/* AI Recipe */}
            <div className="flex-1 flex flex-col min-h-[200px]">
                <h3 className="text-xs font-bold text-macaron-green tracking-wider mb-3 flex justify-between items-center">
                  {t.aiRecipe}
                  <span className="text-[10px] font-normal opacity-50 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
                     {lang.toUpperCase()}
                  </span>
                </h3>
                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-macaron-green animate-pulse bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                     <svg className="w-6 h-6 animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <span className="font-mono text-xs">{t.analyzing}</span>
                  </div>
                ) : (
                  <div className="flex-1 prose prose-sm max-w-none font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 overflow-y-auto max-h-[300px] custom-scrollbar">
                    <pre className="whitespace-pre-wrap font-inherit">{recipe}</pre>
                  </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default MixerResult;