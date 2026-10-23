import React from 'react';
import { MinusIcon, PlusIcon } from '@phosphor-icons/react';

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
  percentageText?: string;
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
  percentageText,
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
    <div
      className={`bp-slider-row ${
        value > 0 ? 'bp-slider-row-active' : ''
      } flex items-center gap-1.5 sm:gap-3 py-1.5 w-full min-w-0 max-w-full box-border select-none group min-h-[50px]`}
    >
      {/* 1. Left Color Identity (Responsive width: 82px on mobile, 130px on sm+) */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-[82px] sm:w-[130px] min-w-0 flex-shrink-0">
        <div
          className="bp-swatch w-7 h-7 sm:w-8 sm:h-8 rounded-full sm:rounded-xl flex-shrink-0 shadow-sm relative overflow-hidden transition-transform duration-150 group-hover:scale-105"
          style={{
            backgroundColor: color,
            border: isWhite
              ? '1.5px solid rgba(0, 0, 0, 0.2)'
              : '1px solid rgba(0, 0, 0, 0.12)',
          }}
          title={`${label} ${subLabel || color}`}
        />
        <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
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
      </div>

      {/* 2. Middle Slider Track (flex-1 with mobile-safe min-w) */}
      <div className="flex-1 min-w-[44px] sm:min-w-[100px] mx-0.5 sm:mx-3 relative flex items-center h-8">
        {/* Track Container */}
        <div className="bp-slider-track relative w-full h-2.5 rounded-full overflow-hidden bg-slate-200/90 dark:bg-slate-700/80">
          {/* Active colored fill */}
          <div
            className="bp-slider-fill absolute left-0 top-0 bottom-0 rounded-full"
            style={{
              width: `${percentage}%`,
              ...getActiveTrackStyle(),
            }}
          />
        </div>

        {/* iOS Capsule Thumb / Blueprint Mechanical Thumb */}
        <div
          className="absolute top-1/2 pointer-events-none"
          style={{
            left: `${percentage}%`,
            transform: 'translate3d(-50%, -50%, 0)',
            willChange: 'left, transform',
          }}
        >
          <div className="bp-slider-thumb-knob w-5 h-3.5 sm:w-7 sm:h-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22),0_1px_2px_rgba(0,0,0,0.1)] border border-black/[0.08] dark:border-white/20 active:scale-110 transition-transform duration-100" />
        </div>

        {/* Native Transparent Range Input Overlay */}
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

      {/* 3. Right Stepper Controls (Auto-sized flex-shrink-0 so 4 buttons never overflow row border) */}
      <div className="flex-shrink-0 flex items-center justify-end gap-1">
        {/* [-] Stepper button */}
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="bp-btn w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none text-slate-600 dark:text-slate-300 flex items-center justify-center transition-transform active:scale-90 flex-shrink-0"
          title="减少数值"
          aria-label="减少数值"
        >
          <MinusIcon className="w-3 h-3" weight="bold" />
        </button>

        {/* Number Input & Percentage Subscript */}
        <div className="flex flex-col items-center justify-center min-w-[32px] sm:min-w-[36px]">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={Math.round(value)}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              if (!isNaN(parsed)) {
                onChange(Math.max(min, Math.min(max, parsed)));
              } else if (e.target.value === '') {
                onChange(min);
              }
            }}
            className={`bp-input w-8 sm:w-9 h-6 text-center font-mono text-xs font-bold rounded-md border outline-none transition-colors tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              value > 0
                ? 'bg-white dark:bg-slate-800 border-accent/60 text-accent shadow-xs'
                : 'bg-slate-100/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
            }`}
          />
          {percentageText && value > 0 && (
            <span className="text-[9px] font-mono font-bold text-accent/85 leading-none mt-0.5 tabular-nums">
              {percentageText}
            </span>
          )}
        </div>

        {/* [+] Stepper button */}
        <button
          type="button"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="bp-btn w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/80 dark:hover:bg-slate-600 disabled:opacity-30 disabled:pointer-events-none text-slate-600 dark:text-slate-300 flex items-center justify-center transition-transform active:scale-90 flex-shrink-0"
          title="增加数值"
          aria-label="增加数值"
        >
          <PlusIcon className="w-3 h-3" weight="bold" />
        </button>

        {/* Delete Button (Optional for custom palette) */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="bp-delete-btn w-5 h-5 rounded-full bg-slate-200 hover:bg-rose-500 text-slate-500 hover:text-white dark:bg-slate-700 dark:hover:bg-rose-500 dark:text-slate-300 flex items-center justify-center transition-colors active:scale-90 flex-shrink-0"
            title="移除此颜色"
            aria-label="移除此颜色"
          >
            <MinusIcon className="w-2.5 h-2.5" weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
};

export default IOSColorSlider;
