import React from 'react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import { PlusIcon, MinusIcon, DropIcon, InfoIcon } from '@phosphor-icons/react';

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
  className?: string;
}

const DropRatioBar: React.FC<DropRatioBarProps> = ({
  parts,
  lang,
  multiplier,
  onMultiplierChange,
  className = '',
}) => {
  const t = translations[lang] || translations.zh;
  const visible = parts.filter(part => part.drops > 0);
  if (visible.length === 0) return null;

  const clamped = Math.min(8, Math.max(1, multiplier));
  const isPure = visible.length === 1;

  const totalUnitDrops = visible.reduce((sum, p) => sum + p.drops, 0);
  const totalDrops = totalUnitDrops * clamped;

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border border-sky-200/70 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 shadow-xs backdrop-blur-sm transition-all ${className}`}
    >
      {/* Header: Title + Multiplier Stepper */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-xs">
            <DropIcon className="h-4 w-4" weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-wide">
                {t.dropRatio || (lang === 'zh' ? '滴数比配方' : 'Drop Ratio')}
              </span>
              <span className="rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-600 dark:text-sky-300">
                {lang === 'zh' ? `共 ${totalDrops} 滴` : lang === 'ja' ? `計 ${totalDrops} 滴` : `${totalDrops} drops`}
              </span>
            </div>
            {clamped > 1 && (
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                {lang === 'zh'
                  ? `基准 ${totalUnitDrops} 滴 × ${clamped} 倍`
                  : lang === 'ja'
                  ? `基準 ${totalUnitDrops} 滴 × ${clamped} 倍`
                  : `Base ${totalUnitDrops} drops × ${clamped}`}
              </div>
            )}
          </div>
        </div>

        {!isPure && (
          <div className="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1.5">
              {t.dropMultiplier || (lang === 'zh' ? '倍数' : 'Multiplier')}
            </span>
            <button
              type="button"
              onClick={() => onMultiplierChange(clamped - 1)}
              disabled={clamped <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs border border-slate-200/80 dark:border-slate-600 disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
              aria-label="减少倍率"
            >
              <MinusIcon className="w-3.5 h-3.5" weight="bold" />
            </button>
            <span className="w-6 text-center font-mono text-xs font-black text-slate-800 dark:text-slate-100">
              {clamped}x
            </span>
            <button
              type="button"
              onClick={() => onMultiplierChange(clamped + 1)}
              disabled={clamped >= 8}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs border border-slate-200/80 dark:border-slate-600 disabled:opacity-30 active:scale-95 transition-all cursor-pointer"
              aria-label="增加倍率"
            >
              <PlusIcon className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>
        )}
      </div>

      {/* Main Ratio Formula / Pure Notice */}
      {isPure ? (
        <div className="py-4 text-center">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2">
            <span
              className="w-4 h-4 rounded-full border border-black/20 shadow-2xs"
              style={{ backgroundColor: visible[0].color }}
            />
            <span>{t.dropPure || (lang === 'zh' ? '纯色，无需混合' : 'Pure color, no mixing required')}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {t.dropPureHint || (lang === 'zh' ? '直接使用这种颜料。' : 'Use this paint directly.')}
          </p>
        </div>
      ) : (
        <div className="my-3">
          {/* Visual Ratio Cards Track - Scrolls cleanly without breaking colons */}
          <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-1.5 px-0.5">
            {visible.map((part, index) => {
              const partDrops = part.drops * clamped;
              const percent = totalUnitDrops > 0 ? Math.round((part.drops / totalUnitDrops) * 100) : 0;
              return (
                <React.Fragment key={`${part.name}-${index}`}>
                  {index > 0 && (
                    <div className="flex-shrink-0 flex items-center justify-center pb-5 text-slate-300 dark:text-slate-600 font-mono text-2xl font-black select-none px-0.5">
                      :
                    </div>
                  )}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center p-2.5 sm:p-3 min-w-[4.25rem] sm:min-w-[4.75rem] rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs group hover:border-sky-400/50 transition-all">
                    <div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-white dark:border-slate-600 shadow-sm mb-1.5 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: part.color }}
                    />
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-mono text-2xl sm:text-3xl font-black tabular-nums text-slate-800 dark:text-slate-100 leading-none">
                        {partDrops}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {t.dropUnit || (lang === 'zh' ? '滴' : 'drop')}
                      </span>
                    </div>
                    <div className="mt-1 text-center w-full">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[4.25rem] sm:max-w-[4.75rem]">
                        {part.name}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                        {percent}%
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Inline Formula Summary Line */}
          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">
              {lang === 'zh' ? '配方速记:' : lang === 'ja' ? 'レシピ比:' : 'Formula:'}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-200 flex-wrap justify-center">
              {visible.map((p, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-slate-400 select-none">:</span>}
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/15 shadow-2xs inline-block"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.name} {p.drops * clamped}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Helpful Tips at Bottom */}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
        <InfoIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span>{isPure ? t.dropPureHint : t.dropRatioHint}</span>
      </div>
      {!isPure && (
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400 pl-5">
          {t.dropApprox}
        </p>
      )}
    </div>
  );
};

export default DropRatioBar;
