import React, { useState } from 'react';
import { ColorData, Language } from '../types';
import { translations } from '../utils/translations';

interface PaletteVisualizerProps {
  sourceImage: string | null;
  colors: ColorData[];
  lang: Language;
}

type VisualizerMode = 'STRIPES' | 'CLAY' | 'COMIC' | 'TICKET';

const PaletteVisualizer: React.FC<PaletteVisualizerProps> = ({ sourceImage, colors, lang }) => {
  const [mode, setMode] = useState<VisualizerMode>('TICKET');
  const t = translations[lang];

  // Helper to get color safely
  const c = (i: number) => colors[i]?.hex || '#CCCCCC';
  const cObj = (i: number) => colors[i] || { hex: '#CCCCCC', id: '0' };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-macaron-blue/30 dark:border-slate-700 shadow-sm p-4 md:p-6 h-full flex flex-col transition-colors duration-300">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-macaron-purple tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-macaron-purple rounded-full"></span>
            {t.visualizerTitle}
        </h3>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            {['TICKET', 'STRIPES', 'CLAY', 'COMIC'].map((m) => (
                <button
                    key={m}
                    onClick={() => setMode(m as VisualizerMode)}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${mode === m ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    {m}
                </button>
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden p-8 min-h-[300px]">
        
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
                                    aria-label={col.hex} // Using aria-label as content for before pseudo
                                    data-label={col.hex}
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
                <div className="container-cards-ticket">
                    <div className="card-ticket">
                         <svg className="ticket-svg" xmlns="http://www.w3.org/2000/svg" width={64} height={150} viewBox="0 0 64 150" fill="currentColor">
                            {/* Simplified serrated edge path logic or keeping original */}
                            <path d="M44 138V136.967H20V138H44Z" />
                            {/* ... keeping simplified for brevity, or we can use a simpler serrated edge SVG if the original is too long, 
                                but let's try to simulate the effect with a border image or just the left part */}
                            <rect x="20" y="0" width="24" height="150" fill="currentColor" />
                            <circle cx="20" cy="0" r="4" fill="white"/>
                            {Array.from({length: 15}).map((_, i) => (
                                <circle key={i} cx="20" cy={10 + i * 10} r="3" fill="white" />
                            ))}
                        </svg>
                        
                        <div className="separator">
                            <span className="span-lines" />
                        </div>
                        
                        <div className="content-ticket">
                            <div className="content-data">
                                <div className="destination">
                                    <div className="dest start">
                                        <p className="country">PRIMARY</p>
                                        <p className="acronym" style={{color: c(0)}}>{c(0)}</p>
                                        <p className="hour">HEX</p>
                                    </div>
                                    <svg style={{flexShrink: 0}} xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                        <path fill="none" stroke="#aeaeae" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="m18 8l4 4l-4 4M2 12h20" />
                                    </svg>
                                    <div className="dest end">
                                        <p className="country">ACCENT</p>
                                        <p className="acronym" style={{color: c(1)}}>{c(1)}</p>
                                        <p className="hour">HEX</p>
                                    </div>
                                </div>
                                <div style={{borderBottom: '2px solid #e8e8e8'}} />
                                <div className="data-flex-col">
                                    <div className="data-flex">
                                        <div className="data">
                                            <p className="title">PALETTE ID</p>
                                            <p className="subtitle">{cObj(0).id.toUpperCase().slice(0,6)}</p>
                                        </div>
                                        <div className="data passenger">
                                            <p className="title">COUNT</p>
                                            <p className="subtitle">{colors.length} COLORS</p>
                                        </div>
                                    </div>
                                    <div className="data-flex">
                                        {colors.slice(2, 5).map((col, i) => (
                                            <div className="data" key={col.id}>
                                                <p className="title">COL {i+3}</p>
                                                <p className="subtitle" style={{color: col.hex}}>{col.hex}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="container-icons">
                                <div className="icon plane">
                                   {/* Replaced Plane with Color Swatch Icon */}
                                   <div style={{width: 26, height: 26, borderRadius: 4, backgroundColor: c(0), border: '2px solid white'}}></div>
                                </div>
                                <div className="icon uiverse">
                                   <div style={{width: 20, height: 20, borderRadius: '50%', backgroundColor: c(1), border: '1px solid white'}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

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
                font-family: "Impact", sans-serif;
             }
             .body { padding: 10px; background-color: #f0e8d8; border-radius: 12px; }
             .comic-panel {
                background: #ffffff; border: 3px solid #000; padding: 1rem;
                border-radius: 8px; box-shadow: 4px 4px 0px rgba(0, 0, 0, 1);
             }
             .container-items { display: flex; flex-wrap: wrap; max-width: 250px; justify-content: center; gap: 4px; }
             .item-color {
                position: relative; width: 36px; height: 44px; border: none; outline: none; margin: 2px;
                background-color: transparent; transition: 300ms ease-out; cursor: pointer;
             }
             .item-color::after {
                position: absolute; content: ""; inset: 0; width: 36px; height: 36px;
                background-color: var(--color); border-radius: 4px; border: 2px solid #000;
                box-shadow: 3px 3px 0 0 #000; pointer-events: none; transition: 300ms;
             }
             .item-color::before {
                position: absolute; content: attr(aria-label);
                left: 50%; bottom: 50px; font-size: 12px; padding: 4px;
                background-color: #fef3c7; color: #000; border: 2px solid #000; border-radius: 4px;
                pointer-events: none; opacity: 0; transform: translateX(-50%) scale(0.5);
                transition: all 200ms; z-index: 20; white-space: nowrap;
             }
             .item-color:hover { transform: scale(1.2) translateY(-5px); z-index: 10; }
             .item-color:hover::before { opacity: 1; transform: translateX(-50%) scale(1); }
        `;
        case 'TICKET': return `
             .viz-wrapper { display: flex; justify-content: center; perspective: 1000px; font-family: sans-serif; }
             .card-ticket {
                position: relative; height: 150px; width: 320px; display: flex;
                color: #2d2d2d; background-color: #ffffff; border-radius: 1rem;
                transition: all 0.3s; overflow: hidden;
                box-shadow: 0 10px 20px rgba(0,0,0,0.1);
             }
             .card-ticket:hover { transform: translateY(-5px); }
             .ticket-svg { position: absolute; left: -10px; top: 0; height: 100%; color: #f8fafc; z-index: 0; }
             .separator {
                position: absolute; top: 0; left: 50px; width: 16px; height: 100%;
                display: flex; align-items: center; justify-content: center; z-index: 10;
             }
             .span-lines {
                height: 100%; border-left: 2px dashed #e8e8e8;
             }
             .content-ticket { position: relative; justify-content: space-between; width: 100%; display: flex; padding-left: 60px; z-index: 1; }
             .content-data {
                display: flex; flex-direction: column; justify-content: space-between; width: 100%;
                padding: 10px; gap: 4px;
             }
             .data-flex { display: flex; justify-content: space-between; gap: 4px; width: 100%; }
             .data-flex-col { display: flex; flex-direction: column; gap: 8px; }
             .data { font-size: 10px; line-height: 12px; }
             .data .title { color: #aeaeae; margin-bottom: 2px; }
             .data .subtitle { font-weight: 700; color: #212121; font-family: monospace; }
             .destination { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; }
             .dest .country { font-size: 9px; color: #aeaeae; }
             .dest .acronym { font-weight: 800; font-size: 16px; color: #2d2d2d; }
             .dest .hour { font-size: 9px; }
             .container-icons {
                width: 60px; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
                background: linear-gradient(135deg, #f0f0f0 0%, #ffffff 100%); border-left: 1px solid #f0f0f0;
             }
        `;
    }
    return '';
};

export default PaletteVisualizer;
