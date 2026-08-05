import React, { useState, useRef, useMemo } from 'react';
import { ColorData, Language, RALColor } from '../types';
import { translations } from '../utils/translations';
import { findNearestRAL, calculateMixboxRatios, EXTENDED_MIXING_COLORS, getContrastColor } from '../utils/colorUtils';
import html2canvas from 'html2canvas';

// 8色扩展调色板的颜色名称映射
const COLOR_NAMES_8 = {
  en: ['White', 'Black', 'Red', 'Magenta', 'Blue', 'Cyan', 'Yellow', 'Orange'],
  zh: ['白', '黑', '红', '品红', '蓝', '青', '黄', '橙'],
  ja: ['白', '黒', '赤', 'マゼンタ', '青', 'シアン', '黄', 'オレンジ']
};

// Gaia 色号映射
const GAIA_CODES = ['001', '002', '003', '004', '005', '006', '007', '008'];

// 生成 Mixbox 配方文字描述（使用 Gaia 编号格式）
const getMixboxRecipeText = (hex: string, lang: Language): string => {
  const ratios = calculateMixboxRatios(hex, 'srgb', true);
  const names = COLOR_NAMES_8[lang];
  
  // 筛选出比例大于1%的颜色，并按比例排序
  const validColors = ratios
    .map((ratio, index) => ({ 
      ratio, 
      index, 
      name: names[index],
      code: GAIA_CODES[index]
    }))
    .filter(item => item.ratio > 1)
    .sort((a, b) => b.ratio - a.ratio);
  
  if (validColors.length === 0) return '-';
  
  // 格式化输出：显示前3个主要颜色
  return validColors
    .slice(0, 3)
    .map(item => `${item.code}${item.name} ${Math.round(item.ratio)}%`)
    .join(' + ');
};

// 生成简短配方（用于紧凑显示）
const getShortRecipeText = (hex: string, lang: Language): string => {
  const ratios = calculateMixboxRatios(hex, 'srgb', true);
  const names = COLOR_NAMES_8[lang];
  
  const validColors = ratios
    .map((ratio, index) => ({ ratio, index, name: names[index], code: GAIA_CODES[index] }))
    .filter(item => item.ratio > 1)
    .sort((a, b) => b.ratio - a.ratio);
  
  if (validColors.length === 0) return '-';
  
  // 更简短的格式：只显示编号和比例
  return validColors
    .slice(0, 3)
    .map(item => `${item.code}:${Math.round(item.ratio)}%`)
    .join(' ');
};

// 获取 RAL 色号和名称
const getRALInfo = (rgb: { r: number; g: number; b: number }): { number: string; name: string } | null => {
  const ral = findNearestRAL(rgb);
  if (ral) {
    return {
      number: `RAL ${ral.ral}`,
      name: ral.name
    };
  }
  return null;
};

interface PaletteVisualizerProps {
  sourceImage: string | null;
  colors: ColorData[];
  lang: Language;
}

type VisualizerMode = 'STRIPES' | 'CLAY' | 'COMIC' | 'TICKET';

const STONE_PATHS = [
  "M30,20 L70,10 L90,40 L80,80 L40,90 L10,60 Z", // Space
  "M20,30 L60,10 L90,50 L70,90 L30,80 L10,40 Z", // Mind
  "M40,10 L80,30 L90,70 L60,90 L20,80 L10,40 Z", // Reality
  "M30,20 L70,10 L90,50 L70,90 L30,80 L10,30 Z", // Power
  "M20,20 L60,10 L90,40 L80,80 L40,90 L10,50 Z", // Time
  "M30,10 L70,20 L90,50 L70,80 L30,90 L10,40 Z"  // Soul
];

const adjustColor = (color: string, amount: number) => {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

const PaletteVisualizer: React.FC<PaletteVisualizerProps> = ({ sourceImage, colors, lang }) => {
  const [mode, setMode] = useState<VisualizerMode>('TICKET');
  const [isExporting, setIsExporting] = useState(false);
  const t = translations[lang];
  const visualizerRef = useRef<HTMLDivElement>(null);

  const handleExportImage = async () => {
    if (!visualizerRef.current) return;

    try {
      // 设置导出状态，让隐藏的信息显示出来
      setIsExporting(true);
      
      // 等待 React 重新渲染完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(visualizerRef.current, {
        backgroundColor: null,
        scale: 2,
        allowTaint: true,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `palette-${mode.toLowerCase()}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      // Use setTimeout to ensure the click event completes before cleanup
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        // 恢复正常状态
        setIsExporting(false);
      }, 100);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-macaron-blue/30 dark:border-slate-700 shadow-sm p-4 md:p-6 h-full flex flex-col transition-colors duration-300">
      {/* 响应式头部: 大屏水平布局，小屏垂直布局 */}
      <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-3 xs:gap-0 mb-6">
        {/* 标题 */}
        <h3 className="text-xs font-bold text-macaron-purple tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-macaron-purple rounded-full"></span>
            {t.visualizerTitle}
        </h3>
        
        {/* 导出按钮 */}
        <button
          onClick={handleExportImage}
          className="px-3 py-1.5 text-[10px] font-bold rounded bg-macaron-green/20 text-macaron-green hover:bg-macaron-green hover:text-white transition-all border border-macaron-green/50 flex items-center justify-center gap-1 w-full xs:w-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33A3 3 0 0116.5 19.5H6.75Z" />
          </svg>
          EXPORT
        </button>
        
        {/* 模式切换按钮组 */}
        <div className="grid grid-cols-2 xs:flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 w-full xs:w-auto">
            <button
                onClick={() => setMode('TICKET')}
                className={`px-2 py-1.5 text-[10px] font-bold rounded transition-all ${mode === 'TICKET' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                STONES
            </button>
            <button
                onClick={() => setMode('COMIC')}
                className={`px-2 py-1.5 text-[10px] font-bold rounded transition-all ${mode === 'COMIC' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                COMIC
            </button>
            <button
                onClick={() => setMode('CLAY')}
                className={`px-2 py-1.5 text-[10px] font-bold rounded transition-all ${mode === 'CLAY' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                CLAY
            </button>
            <button
                onClick={() => setMode('STRIPES')}
                className={`px-2 py-1.5 text-[10px] font-bold rounded transition-all ${mode === 'STRIPES' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                STRIPES
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden p-8 min-h-[300px]" ref={visualizerRef}>
        
        {/* Background Layer with Source Image & Reduced Blur */}
        {sourceImage ? (
            <div className="absolute inset-0 z-0">
                <div 
                    className="absolute inset-0 bg-cover bg-center transform scale-105"
                    style={{ backgroundImage: `url(${sourceImage})` }}
                />
                <div className="absolute inset-0 backdrop-blur-md bg-white/20 dark:bg-slate-950/40 transition-colors duration-300" />
            </div>
        ) : (
             <div className="absolute inset-0 bg-slate-50 dark:bg-slate-800/50 z-0" />
        )}
        <div className="relative z-10 w-full flex justify-center items-center">
            {/* CSS Injection for the selected mode */}
            <style>{getStyleForMode(mode, isExporting)}</style>

            {mode === 'STRIPES' && (
                <div className={`viz-wrapper ${isExporting ? 'exporting' : ''}`}>
                    <div className="container">
                        <div className="palette">
                            {colors.slice(0, 5).map((col) => {
                                const ralInfo = getRALInfo(col.rgb);
                                const mixRecipe = getMixboxRecipeText(col.hex, lang);
                                const textColor = getContrastColor(col.hex);
                                return (
                                    <div key={col.id} className="color" style={{ backgroundColor: col.hex }}>
                                        <div className="stripe-info" style={{ color: textColor }}>
                                            <span className="stripe-hex">{col.hex.replace('#', '')}</span>
                                            <span className="stripe-recipe">{mixRecipe}</span>
                                            {ralInfo && <span className="stripe-ral">{ralInfo.number} {ralInfo.name}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Fill remaining if < 5 */}
                            {[...Array(Math.max(0, 5 - colors.length))].map((_, i) => (
                                <div key={i} className="color" style={{ backgroundColor: '#eee' }}>
                                    <div className="stripe-info" style={{ color: '#999' }}>
                                        <span className="stripe-hex">---</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div id="stats">
                            <span>{colors.length} colors detected</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18">
                                <path d="M4 7.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5S5.5 9.83 5.5 9 4.83 7.5 4 7.5zm10 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-5 0c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5S9.83 7.5 9 7.5z" />
                            </svg>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'CLAY' && (
                <div className="viz-wrapper">
                    <div className="card">
                        <div className="clay-slab">
                            <div className="container-items">
                                {colors.map(col => {
                                    const ralInfo = getRALInfo(col.rgb);
                                    const mixRecipe = getMixboxRecipeText(col.hex, lang);
                                    return (
                                        <div key={col.id} className="clay-color-wrapper">
                                            <button 
                                                className="item-color" 
                                                style={{ ['--color' as any]: col.hex }} 
                                                aria-label={col.hex}
                                                data-color={col.hex}
                                                onClick={() => navigator.clipboard.writeText(col.hex)}
                                            />
                                            <div className="clay-info">
                                                <span className="clay-hex">{col.hex}</span>
                                                <span className="clay-recipe">{mixRecipe}</span>
                                                {ralInfo && <span className="clay-ral">{ralInfo.number} {ralInfo.name}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'COMIC' && (
                <div className="viz-wrapper">
                    <div className="body">
                        <div className="comic-panel">
                            <div className="container-items">
                                {colors.map(col => {
                                    const ralInfo = getRALInfo(col.rgb);
                                    const mixRecipe = getMixboxRecipeText(col.hex, lang);
                                    return (
                                        <div key={col.id} className="comic-color-wrapper">
                                            <button 
                                                className="item-color" 
                                                style={{ ['--color' as any]: col.hex }} 
                                                aria-color={col.hex}
                                                data-recipe={mixRecipe}
                                                data-ral={ralInfo?.number || ''}
                                                onClick={() => navigator.clipboard.writeText(col.hex)}
                                            />
                                            <div className="comic-info">
                                                <span className="comic-hex">{col.hex}</span>
                                                <span className="comic-recipe">{mixRecipe}</span>
                                                {ralInfo && <span className="comic-ral">{ralInfo.number} {ralInfo.name}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'TICKET' && (
                <div className="viz-wrapper">
                    <div className="card">
                        <div className="stones-container">
                            {colors.slice(0, 6).map((col, i) => {
                                const path = STONE_PATHS[i % STONE_PATHS.length];
                                const ralInfo = getRALInfo(col.rgb);
                                const mixRecipe = getMixboxRecipeText(col.hex, lang);
                                const textColor = getContrastColor(col.hex);
                                // Very rough brightness adjustment for gradient simulation
                                // In a real app, use a proper color library
                                return (
                                    <div key={col.id} className="stone-wrapper">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="stone">
                                            <defs>
                                                <radialGradient r="50%" cy="50%" cx="50%" id={`glow-${col.id}`}>
                                                    <stop style={{stopColor: '#ffffff'}} offset="0%" />
                                                    <stop style={{stopColor: col.hex}} offset="40%" />
                                                    <stop style={{stopColor: col.hex}} offset="100%" />
                                                </radialGradient>
                                            </defs>
                                            <path 
                                                fill={`url(#glow-${col.id})`} 
                                                d={path} 
                                                className="glow" 
                                                stroke={col.hex} 
                                                strokeWidth="2"
                                            />
                                        </svg>
                                        <div className="stone-info">
                                            <div className="stone-hex" style={{color: col.hex}}>{col.hex}</div>
                                            <div className="stone-recipe" style={{color: textColor === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)'}}>
                                                {mixRecipe}
                                            </div>
                                            {ralInfo && (
                                                <div className="stone-ral" style={{color: col.hex}}>
                                                    {ralInfo.number} {ralInfo.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Fill if empty to show structure */}
                            {colors.length === 0 && (
                                <div className="text-white font-mono text-sm opacity-50">No Colors</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

      </div>
      
      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-400 font-mono">
            {t.visualizerDesc}
        </p>
      </div>
    </div>
  );
};

// CSS Styles
const getStyleForMode = (mode: VisualizerMode, isExporting: boolean = false) => {
    // 导出时的额外样式 - 强制显示所有信息并停止动画
    const exportStyles = isExporting ? `
        /* 导出时强制显示所有信息 */
        .exporting .stripe-info { opacity: 1 !important; }
        .exporting .color { flex: 1 !important; }
        .stone-info { opacity: 1 !important; }
        /* 导出时停止动画 */
        .stone-wrapper { animation: none !important; transform: translateY(0) !important; }
    ` : '';
    
    switch (mode) {
        case 'STRIPES': return `
            .viz-wrapper {
                font-family: sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                height: 280px;
                width: 400px;
                border-radius: 1em;
                overflow: hidden;
                box-shadow: 0 10px 20px #dbdbdb;
                background: white;
            }
            .palette { display: flex; height: 86%; width: 100%; }
            .color {
                height: 100%; flex: 1; display: flex; align-items: center; justify-content: center;
                font-weight: 600; letter-spacing: 1px; transition: flex 0.2s linear;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                position: relative;
            }
            .stripe-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                opacity: 0;
                transition: opacity 0.2s linear;
                text-align: center;
                padding: 8px 4px;
            }
            .stripe-hex {
                font-size: 11px;
                font-weight: bold;
                letter-spacing: 1px;
            }
            .stripe-recipe {
                font-size: 8px;
                font-weight: 500;
                opacity: 0.85;
                line-height: 1.3;
                max-width: 60px;
                word-wrap: break-word;
            }
            .stripe-ral {
                font-size: 8px;
                font-weight: 600;
                opacity: 0.9;
                padding: 2px 4px;
                background: rgba(0,0,0,0.15);
                border-radius: 3px;
            }
            .color:hover { flex: 2.5; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px; }
            .color:hover .stripe-info { opacity: 1; }
            #stats {
                height: 14%; width: 100%; background: white; display: flex; align-items: center;
                justify-content: space-between; padding: 0 1.5em; box-sizing: border-box; color: #bebebe;
                font-size: 12px;
            }
            #stats svg { fill: #bebebe; transform: scale(0.8); }
            ${exportStyles}
        `;
        case 'CLAY': return `
            .viz-wrapper {
                display: flex; justify-content: center; align-items: center;
                font-family: "Quicksand", sans-serif;
            }
            .card {
                display: grid; place-content: center;
                background: #e7e7e7; padding: 20px; border-radius: 20px;
            }
            .clay-slab {
                padding: 1.5rem; border-radius: 40px; background: #e7e7e7;
                box-shadow: inset 6px 6px 12px #c5c5c5, inset -6px -6px 12px #ffffff;
            }
            .container-items { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; max-width: 400px; }
            .clay-color-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
            }
            .item-color {
                position: relative; flex-shrink: 0; width: 48px; height: 48px;
                border: none; outline: none; cursor: pointer; background-color: var(--color);
                border-radius: 41% 59% 45% 55% / 58% 44% 56% 42%;
                transition: all 300ms cubic-bezier(0.165, 0.84, 0.44, 1);
                box-shadow: 4px 4px 8px rgba(160, 160, 160, 0.6), -4px -4px 8px rgba(255, 255, 255, 0.8),
                            inset 2px 2px 4px color-mix(in srgb, var(--color) 80%, black), inset -2px -2px 4px color-mix(in srgb, var(--color) 80%, white);
            }
            .item-color::before {
                position: absolute; content: attr(aria-label);
                left: 50%; bottom: 120%; transform: translateX(-50%) scale(0);
                padding: 4px 8px; background: #e7e7e7; border-radius: 10px;
                font-size: 10px; color: #555; white-space: nowrap;
                box-shadow: inset 2px 2px 4px #c5c5c5, inset -2px -2px 4px #ffffff;
                pointer-events: none; opacity: 0; transition: all 300ms; z-index: 10;
            }
            .item-color:hover { transform: translateY(-5px) scale(1.05); border-radius: 50%; }
            .item-color:hover::before { opacity: 1; transform: translateX(-50%) scale(1); }
            .item-color:active { transform: translateY(2px) scale(0.95); }
            .clay-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                font-size: 8px;
                color: #666;
                text-align: center;
                max-width: 70px;
            }
            .clay-hex {
                font-weight: bold;
                font-size: 9px;
                color: #444;
            }
            .clay-recipe {
                font-size: 7px;
                opacity: 0.8;
                line-height: 1.2;
                word-wrap: break-word;
            }
            .clay-ral {
                font-size: 7px;
                font-weight: 600;
                color: #777;
                padding: 1px 4px;
                background: rgba(0,0,0,0.08);
                border-radius: 3px;
            }
        `;
        case 'COMIC': return `
             .viz-wrapper {
                display: flex; justify-content: center; align-items: center;
                font-family: "Bangers", cursive;
             }
             .body {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
                font-family: "Bangers", cursive;
             }
             .comic-panel {
                background: #ffffff;
                border: 4px solid #000;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 4px 4px 0px rgba(0, 0, 0, 1);
             }
             .container-items {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
                max-width: 400px;
             }
             .comic-color-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
             }
             .item-color {
                position: relative;
                flex-shrink: 0;
                width: 48px;
                height: 48px;
                border: none;
                outline: none;
                background-color: var(--color);
                border-radius: 6px;
                border: 3px solid #000;
                box-shadow: 3px 3px 0 0 #000;
                transition: 200ms ease-out;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
             }
             .item-color:hover { transform: scale(1.1) translateY(-3px); box-shadow: 5px 5px 0 0 #000; }
             .item-color:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 0 #000; }
             .comic-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                font-family: "Arial", sans-serif;
                text-align: center;
                max-width: 70px;
             }
             .comic-hex {
                font-size: 9px;
                font-weight: bold;
                color: #000;
                letter-spacing: 0.5px;
             }
             .comic-recipe {
                font-size: 7px;
                color: #555;
                line-height: 1.2;
                word-wrap: break-word;
             }
             .comic-ral {
                font-size: 7px;
                font-weight: 600;
                color: #333;
                padding: 1px 4px;
                background: #fef3c7;
                border: 1px solid #000;
                border-radius: 2px;
             }
        `;
        case 'TICKET': return `
             .viz-wrapper { display: flex; justify-content: center; perspective: 1000px; font-family: sans-serif; }
             .card {
                width: 100%; height: 100%; margin: 0; padding: 0; display: flex;
                justify-content: center; align-items: center; font-family: "Arial", sans-serif; overflow: hidden;
             }
             .stones-container {
                position: relative; width: 100%; display: flex; justify-content: space-around;
                align-items: flex-start; padding: 2rem 1rem; flex-wrap: wrap; gap: 20px;
             }
             .stone-wrapper { 
                position: relative; 
                width: 100px; 
                display: flex;
                flex-direction: column;
                align-items: center;
                animation: float 4s ease-in-out infinite; 
             }
             .stone { 
                width: 80px; 
                height: 80px; 
                cursor: pointer; 
                transition: transform 0.3s ease; 
             }
             .stone:hover { transform: scale(1.15); }
             .stone-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                margin-top: 8px;
                text-align: center;
                opacity: 0.9;
                transition: opacity 0.3s ease;
             }
             .stone-wrapper:hover .stone-info { opacity: 1; }
             .stone-hex {
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                text-shadow: 0 0 8px currentColor, 0 0 12px currentColor;
             }
             .stone-recipe {
                font-size: 8px;
                font-weight: 500;
                line-height: 1.3;
                max-width: 90px;
                word-wrap: break-word;
             }
             .stone-ral {
                font-size: 8px;
                font-weight: 600;
                padding: 2px 6px;
                background: rgba(255,255,255,0.15);
                border-radius: 4px;
                backdrop-filter: blur(4px);
                text-shadow: 0 0 5px currentColor;
             }
             
             @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
             }
             
             .stone-wrapper:nth-child(2) { animation-delay: -0.5s; }
             .stone-wrapper:nth-child(3) { animation-delay: -1s; }
             .stone-wrapper:nth-child(4) { animation-delay: -1.5s; }
             .stone-wrapper:nth-child(5) { animation-delay: -2s; }
             .stone-wrapper:nth-child(6) { animation-delay: -2.5s; }
             ${exportStyles}
        `;
    }
    return exportStyles;
};

export default PaletteVisualizer;
