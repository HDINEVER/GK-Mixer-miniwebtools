import React, { useState, useRef } from 'react';
import { ColorData, Language } from '../types';
import { translations } from '../utils/translations';
import html2canvas from 'html2canvas';

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
  const t = translations[lang];
  const visualizerRef = useRef<HTMLDivElement>(null);

  const handleExportImage = async () => {
    if (!visualizerRef.current) return;

    try {
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
      document.body.removeChild(link);
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
            <style>{getStyleForMode(mode)}</style>

            {mode === 'STRIPES' && (
                <div className="viz-wrapper">
                    <div className="container">
                        <div className="palette">
                            {colors.slice(0, 5).map((col) => (
                                <div key={col.id} className="color" style={{ backgroundColor: col.hex }}>
                                    <span>{col.hex.replace('#', '')}</span>
                                </div>
                            ))}
                            {/* Fill remaining if < 5 */}
                            {[...Array(Math.max(0, 5 - colors.length))].map((_, i) => (
                                <div key={i} className="color" style={{ backgroundColor: '#eee' }}><span>---</span></div>
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
                                {colors.map(col => (
                                    <button 
                                        key={col.id}
                                        className="item-color" 
                                        style={{ ['--color' as any]: col.hex }} 
                                        aria-label={col.hex}
                                        data-color={col.hex}
                                        onClick={() => navigator.clipboard.writeText(col.hex)}
                                    />
                                ))}
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
                                {colors.map(col => (
                                    <button 
                                        key={col.id}
                                        className="item-color" 
                                        style={{ ['--color' as any]: col.hex }} 
                                        aria-color={col.hex}
                                        onClick={() => navigator.clipboard.writeText(col.hex)}
                                    />
                                ))}
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
                                        <div style={{color: col.hex}} className="stone-name">{col.hex}</div>
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
const getStyleForMode = (mode: VisualizerMode) => {
    switch (mode) {
        case 'STRIPES': return `
            .viz-wrapper {
                font-family: sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                height: 200px;
                width: 350px;
                border-radius: 1em;
                overflow: hidden;
                box-shadow: 0 10px 20px #dbdbdb;
                background: white;
            }
            .palette { display: flex; height: 86%; width: 100%; }
            .color {
                height: 100%; flex: 1; display: flex; align-items: center; justify-content: center;
                color: white; font-weight: 600; letter-spacing: 1px; transition: flex 0.1s linear;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            }
            .color span { opacity: 0; transition: opacity 0.1s linear; font-size: 10px; }
            .color:hover { flex: 2; box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px; }
            .color:hover span { opacity: 1; }
            #stats {
                height: 14%; width: 100%; background: white; display: flex; align-items: center;
                justify-content: space-between; padding: 0 1.5em; box-sizing: border-box; color: #bebebe;
                font-size: 12px;
            }
            #stats svg { fill: #bebebe; transform: scale(0.8); }
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
                padding: 1rem; border-radius: 40px; background: #e7e7e7;
                box-shadow: inset 6px 6px 12px #c5c5c5, inset -6px -6px 12px #ffffff;
            }
            .container-items { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; max-width: 300px; }
            .item-color {
                position: relative; flex-shrink: 0; width: 40px; height: 40px;
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
                padding: 1.2rem;
                border-radius: 8px;
                box-shadow: 4px 4px 0px rgba(0, 0, 0, 1);
             }
             .container-items {
                display: flex;
                transform-style: preserve-3d;
                transform: perspective(1000px);
             }
             .item-color {
                position: relative;
                flex-shrink: 0;
                width: 40px;
                height: 48px;
                border: none;
                outline: none;
                margin: -4px;
                background-color: transparent;
                transition: 300ms ease-out;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
             }
             .item-color::after {
                position: absolute; content: ""; inset: 0; width: 40px; height: 40px;
                background-color: var(--color); border-radius: 6px; border: 3px solid #000;
                box-shadow: 4px 4px 0 0 #000; pointer-events: none; transition: 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
             }
             .item-color::before {
                position: absolute; content: attr(aria-color);
                left: 50%; bottom: 60px; font-size: 16px; letter-spacing: 1px; line-height: 1;
                padding: 6px 10px; background-color: #fef3c7; color: #000; border: 3px solid #000; border-radius: 6px;
                pointer-events: none; opacity: 0; visibility: hidden; transform-origin: bottom center;
                transition: all 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 300ms ease-out, visibility 300ms ease-out;
                transform: translateX(-50%) scale(0.5) translateY(10px); white-space: nowrap; z-index: 1000;
             }
             .item-color:hover { transform: scale(1.5) translateY(-5px); z-index: 99999; }
             .item-color:hover::before { opacity: 1; visibility: visible; transform: translateX(-50%) scale(1) translateY(0); }
             .item-color:active::after { transform: translate(2px, 2px); box-shadow: 2px 2px 0 0 #000; }
             .item-color:focus::before { content: "COPIED!"; opacity: 1; visibility: visible; background-color: #a7f3d0; transform: translateX(-50%) scale(1) translateY(0); }
             
             /* Stacking Effects */
             .item-color:hover + * { transform: scale(1.3) translateY(-3px); z-index: 9999; }
             .item-color:hover + * + * { transform: scale(1.15); z-index: 999; }
             .item-color:has(+ *:hover) { transform: scale(1.3) translateY(-3px); z-index: 9999; }
             .item-color:has(+ * + *:hover) { transform: scale(1.15); z-index: 999; }
        `;
        case 'TICKET': return `
             .viz-wrapper { display: flex; justify-content: center; perspective: 1000px; font-family: sans-serif; }
             .card {
                width: 100%; height: 100%; margin: 0; padding: 0; display: flex;
                justify-content: center; align-items: center; font-family: "Arial", sans-serif; overflow: hidden;
             }
             .stones-container {
                position: relative; width: 100%; display: flex; justify-content: space-around;
                align-items: center; padding: 2rem; flex-wrap: wrap; gap: 10px;
             }
             .stone-wrapper { position: relative; width: 100px; height: 100px; animation: float 4s ease-in-out infinite; }
             .stone { position: absolute; width: 100%; height: 100%; cursor: pointer; transition: transform 0.3s ease; }
             .stone:hover { transform: scale(1.2); }
             .stone-name {
                position: absolute; width: 100%; text-align: center; bottom: -30px; left: 0;
                margin-top: 10px; color: #fff; font-size: 12px; font-weight: bold;
                text-transform: uppercase; letter-spacing: 1px; opacity: 0;
                transition: opacity 0.3s ease; text-shadow: 0 0 5px currentColor;
             }
             .stone:hover + .stone-name { opacity: 1; }
             
             @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
             }
             
             .stone-wrapper:nth-child(2) { animation-delay: -0.5s; }
             .stone-wrapper:nth-child(3) { animation-delay: -1s; }
             .stone-wrapper:nth-child(4) { animation-delay: -1.5s; }
             .stone-wrapper:nth-child(5) { animation-delay: -2s; }
             .stone-wrapper:nth-child(6) { animation-delay: -2.5s; }
        `;
    }
    return '';
};

export default PaletteVisualizer;
