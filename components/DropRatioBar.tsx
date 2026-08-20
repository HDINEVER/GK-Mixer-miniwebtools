import React from 'react';
import { Language } from '../types';
import { translations } from '../utils/translations';

export interface DropRatioPart {
  color: string;
  name: string;
  drops: number;
}

interface DropRatioBarProps {
  parts: DropRatioPart[];
  lang: Language;
  multiplier: number;
  onMultiplierChange: (value: number) => void;
}

const DropRatioBar: React.FC<DropRatioBarProps> = ({
  parts,
  lang,
  multiplier,
  onMultiplierChange,
}) => {
  const t = translations[lang];
  const visible = parts.filter(part => part.drops > 0);
  if (visible.length === 0) return null;

  const clamped = Math.min(8, Math.max(1, multiplier));
  const isPure = visible.length === 1;

  return (
    <div className="mb-3 p-3 rounded-xl border border-macaron-blue/30 dark:border-slate-600 bg-white/80 dark:bg-slate-900/50">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] font-bold tracking-wider text-macaron-blue">
          {t.dropRatio}
        </div>
        {!isPure && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">{t.dropMultiplier}</span>
            <button
              type="button"
              onClick={() => onMultiplierChange(clamped - 1)}
              disabled={clamped <= 1}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-30"
              aria-label="−"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
              {clamped}
            </span>
            <button
              type="button"
              onClick={() => onMultiplierChange(clamped + 1)}
              disabled={clamped >= 8}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-30"
              aria-label="+"
            >
              +
            </button>
          </div>
        )}
      </div>

      {isPure ? (
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t.dropPure}
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-3">
          {visible.map((part, index) => (
            <React.Fragment key={`${part.name}-${index}`}>
              {index > 0 && (
                <span className="pb-5 text-lg font-semibold text-slate-300 dark:text-slate-500">
                  :
                </span>
              )}
              <div className="flex min-w-[3.25rem] flex-col items-center gap-1">
                <div
                  className="h-6 w-6 rounded-full border border-slate-200 dark:border-slate-500 shadow-sm"
                  style={{ backgroundColor: part.color }}
                />
                <div className="font-mono text-xl font-bold tabular-nums leading-none text-slate-800 dark:text-slate-100">
                  {part.drops * clamped}
                </div>
                <div className="max-w-[4.5rem] truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {part.name}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        {isPure ? t.dropPureHint : t.dropRatioHint}
      </p>
      {!isPure && (
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
          {t.dropApprox}
        </p>
      )}
    </div>
  );
};

export default DropRatioBar;
