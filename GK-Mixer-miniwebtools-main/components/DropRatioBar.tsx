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
      className={`bp-subcard w-full max-w-full overflow-hidden min-w-0 p-2.5 sm:p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 shadow-xs backdrop-blur-sm ${className}`}
    >
      {/* Header: Title + Multiplier Stepper */}
      <div className="bp-dashed-header flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <div className="bp-swatch flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--accent-color)] text-white shadow-2xs">
            <DropIcon className="h-3.5 w-3.5" weight="fill" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tracking-wide">
                {t.dropRatio || (lang === 'zh' ? '滴数比配方' : 'Drop Ratio')}
              </span>
              <span className="bp-badge rounded-full bg-accent/10 border border-accent/30 px-1.5 py-0.25 font-mono text-[10px] font-bold text-accent">
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
          <div className="bp-segmented flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-1">
              {t.dropMultiplier || (lang === 'zh' ? '倍数' : 'Multiplier')}
            </span>
            <button
              type="button"
              onClick={() => onMultiplierChange(clamped - 1)}
              disabled={clamped <= 1}
              className="bp-btn flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs border border-slate-200/80 dark:border-slate-600 disabled:opacity-30 active:scale-95 transition-transform cursor-pointer"
              aria-label="减少倍率"
            >
              <MinusIcon className="w-3 h-3" weight="bold" />
            </button>
            <span className="w-5 text-center font-mono text-[11px] font-black text-slate-800 dark:text-slate-100">
              {clamped}x
            </span>
            <button
              type="button"
              onClick={() => onMultiplierChange(clamped + 1)}
              disabled={clamped >= 8}
              className="bp-btn flex h-6 w-6 items-center justify-center rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs border border-slate-200/80 dark:border-slate-600 disabled:opacity-30 active:scale-95 transition-transform cursor-pointer"
              aria-label="增加倍率"
            >
              <PlusIcon className="w-3 h-3" weight="bold" />
            </button>
          </div>
        )}
      </div>

      {/* Main Ratio Formula / Pure Notice */}
      {isPure ? (
        <div className="py-3 text-center">
          <div className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2">
            <span
              className="bp-dot w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs"
              style={{ backgroundColor: visible[0].color }}
            />
            <span>{t.dropPure || (lang === 'zh' ? '纯色，无需混合' : 'Pure color, no mixing required')}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {t.dropPureHint || (lang === 'zh' ? '直接使用这种颜料。' : 'Use this paint directly.')}
          </p>
        </div>
      ) : (
        <div className="my-2 sm:my-2.5">
          {/* Visual Ratio Cards Track - Scrolls cleanly without breaking colons */}
          <div className={`w-full max-w-full flex items-center ${visible.length <= 4 ? 'justify-start sm:justify-center' : 'justify-start'} gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar touch-pan-x py-1.5 px-1 min-w-0`}>
            {visible.map((part, index) => {
              const partDrops = part.drops * clamped;
              const percent = totalUnitDrops > 0 ? Math.round((part.drops / totalUnitDrops) * 100) : 0;
              return (
                <React.Fragment key={`${part.name}-${index}`}>
                  {index > 0 && (
                    <div className="flex-shrink-0 flex items-center justify-center pb-2 text-slate-300 dark:text-slate-600 font-mono text-xs sm:text-sm font-bold select-none px-0.5">
                      :
                    </div>
                  )}
                  <div className="bp-subcard flex-shrink-0 flex flex-col items-center justify-center p-1.5 sm:p-2 min-w-[2.75rem] sm:min-w-[3.25rem] max-w-[3.75rem] rounded-xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs group hover:border-accent/50 transition-colors">
                    <div
                      className="bp-dot w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full border border-black/15 dark:border-white/20 shadow-2xs mb-1 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: part.color }}
                    />
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-mono text-sm sm:text-base font-black tabular-nums text-slate-800 dark:text-slate-100 leading-none">
                        {partDrops}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {t.dropUnit || (lang === 'zh' ? '滴' : 'drop')}
                      </span>
                    </div>
                    <div className="mt-0.5 text-center w-full">
                      <div className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[2.75rem] sm:max-w-[3.25rem]" title={part.name}>
                        {part.name}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 leading-none mt-0.5">
                        {percent}%
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Inline Formula Summary Line */}
          <div className="bp-dashed-box mt-2 px-2.5 py-1 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">
              {lang === 'zh' ? '配方速记:' : lang === 'ja' ? 'レシピ比:' : 'Formula:'}
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 flex-wrap justify-center">
              {visible.map((p, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-slate-400 select-none">:</span>}
                  <span
                    className="bp-dot w-2 h-2 rounded-full border border-black/15 shadow-2xs inline-block"
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
      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-1.5 text-[10px] leading-tight text-slate-400">
        <InfoIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span>{isPure ? t.dropPureHint : t.dropRatioHint}</span>
          {!isPure && t.dropApprox && (
            <span className="block text-slate-400/90 mt-0.5">
              {t.dropApprox}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DropRatioBar;
