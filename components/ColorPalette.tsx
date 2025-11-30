import React, { useEffect, useRef } from 'react';
import { ColorData } from '../types';
import { getContrastColor } from '../utils/colorUtils';

// Use global anime instance from CDN
declare var anime: any;

interface ColorPaletteProps {
  colors: ColorData[];
  onColorSelect: (color: ColorData) => void;
  selectedColorId?: string;
  onAddManual: () => void;
  onDeleteColor: (colorId: string) => void;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, onColorSelect, selectedColorId, onAddManual, onDeleteColor }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      anime({
        targets: containerRef.current.children,
        translateY: [20, 0],
        opacity: [0, 1],
        delay: anime.stagger(100),
        easing: 'easeOutExpo'
      });
    }
  }, [colors.length]); // Re-animate if list changes significantly

  // Animate selection indicator when selected color changes
  useEffect(() => {
    if (selectionIndicatorRef.current) {
      anime({
        targets: selectionIndicatorRef.current,
        scale: [0.3, 1],
        opacity: [0, 1],
        rotate: [-180, 0],
        duration: 500,
        easing: 'easeOutElastic(1, .6)'
      });
    }
  }, [selectedColorId]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-macaron-blue tracking-wider">DETECTED PALETTE</h3>
        <button 
            onClick={onAddManual}
            className="text-xs px-3 py-1 border border-macaron-green text-macaron-green hover:bg-macaron-green hover:text-white transition-colors rounded-full"
        >
            + MANUAL PICK
        </button>
      </div>
      
      <div ref={containerRef} className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {colors.map((c) => (
          <div 
            key={c.id}
            onClick={() => onColorSelect(c)}
            className={`
              relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 group
              ${selectedColorId === c.id ? 'border-slate-800 shadow-md transform -translate-y-1' : 'border-slate-100 hover:border-macaron-pink'}
            `}
          >
            <div 
              className="w-full h-16 rounded-md mb-2 shadow-inner" 
              style={{ backgroundColor: c.hex }}
            />
            <div className="flex justify-between items-end relative">
                <div>
                    <p className="font-mono text-xs text-slate-600 font-bold">{c.hex}</p>
                    <p className="font-mono text-[10px] text-slate-400">
                        C{c.cmyk.c} M{c.cmyk.m} Y{c.cmyk.y} K{c.cmyk.k}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {c.source === 'auto' ? (
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded">AUTO</span>
                    ) : (
                        <span className="text-[10px] bg-macaron-yellow text-slate-600 px-1 rounded">USR</span>
                    )}
                    
                    {/* Selection Indicator - Inside Info Area */}
                    {selectedColorId === c.id && (
                        <div 
                          ref={selectionIndicatorRef}
                          className="w-4 h-4 rounded-full bg-gradient-to-br from-macaron-pink to-macaron-blue border border-white dark:border-slate-600 shadow-md flex items-center justify-center flex-shrink-0"
                        >
                            <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                    )}
                </div>
            </div>
            
            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteColor(c.id);
              }}
              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-red-500 hover:border-red-500 dark:hover:text-red-400 dark:hover:border-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              title="Delete color"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorPalette;