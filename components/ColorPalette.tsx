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
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, onColorSelect, selectedColorId, onAddManual }) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
            <div className="flex justify-between items-end">
                <div>
                    <p className="font-mono text-xs text-slate-600 font-bold">{c.hex}</p>
                    <p className="font-mono text-[10px] text-slate-400">
                        C{c.cmyk.c} M{c.cmyk.m} Y{c.cmyk.y} K{c.cmyk.k}
                    </p>
                </div>
                {c.source === 'auto' ? (
                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded">AUTO</span>
                ) : (
                    <span className="text-[10px] bg-macaron-yellow text-slate-600 px-1 rounded">USR</span>
                )}
            </div>
            
            {selectedColorId === c.id && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full border border-slate-800 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorPalette;