import React, { useRef } from 'react';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';

interface IOSSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  autoFocus?: boolean;
}

export const IOSSearchBar: React.FC<IOSSearchBarProps> = ({
  value,
  onChange,
  placeholder = '搜索…',
  className = '',
  onClear,
  autoFocus = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* iOS Search Magnifier Icon */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 flex items-center justify-center">
        <MagnifyingGlassIcon className="w-4 h-4" />
      </div>

      {/* iOS Search Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            if (onClear) onClear();
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-10 sm:h-11 pl-9 pr-9 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-850 rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all outline-none"
      />

      {/* iOS Clear Button (Circle with X) */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-300/80 dark:bg-slate-600/80 hover:bg-slate-400 dark:hover:bg-slate-500 text-white flex items-center justify-center transition-all duration-150 active:scale-90 cursor-pointer"
          title="Clear"
          aria-label="Clear input"
        >
          <XIcon className="w-3 h-3" weight="bold" />
        </button>
      )}
    </div>
  );
};

export default IOSSearchBar;
