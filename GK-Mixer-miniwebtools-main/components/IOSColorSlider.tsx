import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MinusIcon } from '@phosphor-icons/react';

interface IOSColorSliderProps {
  color: string;
  value: number; // 0 to 100
  onChange: (val: number) => void;
  label: string;
  subLabel?: string;
  onRemove?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export const IOSColorSlider: React.FC<IOSColorSliderProps> = ({
  color,
  value,
  onChange,
  label,
  subLabel,
  onRemove,
  disabled = false,
  min = 0,
  max = 100,
  step = 1,
}) => {
  const isWhite = color.toUpperCase() === '#FFFFFF' || color.toUpperCase() === '#FFF';
  const isBlack = color.toUpperCase() === '#000000' || color.toUpperCase() === '#000';
  const range = max - min;
  const percentage = Math.max(0, Math.min(100, ((value - min) / (range || 1)) * 100));

  // Determine active track color fill
  const getActiveTrackStyle = () => {
    if (isWhite) {
      return {
        background: 'linear-gradient(180deg, #F1F5F9 0%, #CBD5E1 100%)',
        border: '1px solid #94A3B8',
      };
    }
    if (isBlack) {
      return {
        background: '#0F172A',
      };
    }
    return {
      background: color,
    };
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3 py-1 w-full select-none group">
      {/* Circle Color Swatch */}
      <div
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 shadow-sm relative overflow-hidden transition-transform duration-150 group-hover:scale-105"
        style={{
          backgroundColor: color,
          border: isWhite
            ? '1.5px solid rgba(0, 0, 0, 0.2)'
            : '1px solid rgba(0, 0, 0, 0.12)',
        }}
        title={`${label} ${subLabel || color}`}
      />

      {/* Label and Sublabel */}
      <div className={`${onRemove ? 'min-w-[80px] max-w-[130px] sm:max-w-[170px]' : 'min-w-[64px] max-w-[110px] sm:max-w-[150px]'} flex-shrink-0 flex flex-col justify-center leading-tight pr-1`}>
        <div 
          className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate"
          title={label}
        >
          {label}
        </div>
        {subLabel && (
          <div 
            className="font-mono text-[10px] text-slate-400 dark:text-slate-500 truncate"
            title={subLabel}
          >
            {subLabel}
          </div>
        )}
      </div>

      {/* iOS-Style Range Slider */}
      <div className="flex-1 min-w-0 relative flex items-center h-8">
        {/* Track Container */}
        <div className="relative w-full h-2 sm:h-2.5 rounded-full overflow-hidden bg-slate-200/90 dark:bg-slate-700/80">
          {/* Active colored fill (0ms instant tracking on drag) */}
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full"
            style={{
              width: `${percentage}%`,
              ...getActiveTrackStyle(),
            }}
          />
        </div>

        {/* iOS Capsule/Squircle Thumb (0ms instant tracking on drag) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            left: `${percentage}%`,
          }}
        >
          <div className="w-6 h-4 sm:w-7 sm:h-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.1)] border border-black/[0.08] dark:border-white/20 active:scale-110 transition-transform duration-100" />
        </div>

        {/* Native Transparent Range Input Overlay for 100% accessible and silky smooth mobile drag */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none z-10"
          aria-label={label}
        />
      </div>

      {/* Numerical Value Readout */}
      <div className="w-7 sm:w-9 text-right font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums flex-shrink-0">
        {Math.round(value)}
      </div>

      {/* Delete Button (Optional for custom palette) */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-bold hover:bg-rose-500 active:scale-90 transition-all flex-shrink-0 shadow-sm ml-0.5"
          title="移除此颜色"
          aria-label="移除此颜色"
        >
          <MinusIcon className="w-3.5 h-3.5" weight="bold" />
        </button>
      )}
    </div>
  );
};

export default IOSColorSlider;
