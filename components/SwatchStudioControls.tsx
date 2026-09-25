import React, { useState } from 'react';
import { Language } from '../types';
import { translations } from '../utils/translations';
import {
  ExtractLeaderLineStyle,
  SwatchSettings,
} from '../utils/swatchLayout';

interface SwatchStudioControlsProps {
  settings: SwatchSettings;
  onChangeSettings: (updater: (prev: SwatchSettings) => SwatchSettings) => void;
  onAutoArrangeLR: () => void;
  onAutoArrangeTB: () => void;
  onAlign: (alignment: 'left' | 'right' | 'top' | 'bottom' | 'autoH' | 'autoV') => void;
  onResetPositions: () => void;
  lang: Language;
  assignedCount: number;
  className?: string;
  isCompact?: boolean;
  variant?: 'toolbar' | 'sidebar';
}

export const SwatchStudioControls: React.FC<SwatchStudioControlsProps> = ({
  settings,
  onChangeSettings,
  onAutoArrangeLR,
  onAutoArrangeTB,
  onAlign,
  onResetPositions,
  lang,
  assignedCount,
  className = '',
  isCompact = false,
  variant = 'toolbar',
}) => {
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const t = translations[lang] || translations.zh;

  const lineStyles: Array<{
    id: ExtractLeaderLineStyle;
    title: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'stepped',
      title: t.lineStepped || '折线',
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 15h6v-10h8" strokeLinecap="round" strokeLinejoin="miter" />
        </svg>
      ),
    },
    {
      id: 'roundedStepped',
      title: t.lineRoundedStepped || '圆角',
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 15h4a2 2 0 0 0 2-2V7a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'straight',
      title: t.lineStraight || '直线',
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="16" x2="17" y2="4" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: 'curved',
      title: t.lineCurved || '曲线',
      icon: (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 15 C 9 15, 11 5, 17 5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const scalePresets = [
    { label: '75%', value: 0.75 },
    { label: '100%', value: 1.0 },
    { label: '125%', value: 1.25 },
    { label: '150%', value: 1.5 },
  ];

  if (variant === 'sidebar') {
    return (
      <div
        className={`flex flex-col rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 space-y-4 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-sm">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h12V4H4z" opacity="0.3" />
                <path d="M6 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {t.swatchStudio || '色卡制作'}
              </div>
              <div className="text-[10px] text-slate-400">
                {assignedCount} {lang === 'zh' ? '个色卡' : 'cards'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetPositions}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
            title="重置色卡至采样点附近位置"
          >
            <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h5M16 16v-5h-5M4.5 9A7 7 0 0 1 15.5 6M15.5 11A7 7 0 0 1 4.5 14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t.resetLayout || '重置'}</span>
          </button>
        </div>

        {/* 1-Click Auto Arrange */}
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === 'zh' ? '一键智能排版' : lang === 'ja' ? '自動レイアウト' : 'Smart Layout'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onAutoArrangeLR}
              disabled={assignedCount === 0}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-sky-200/80 bg-sky-50/70 p-2 text-xs font-bold text-sky-700 transition hover:bg-sky-100 hover:shadow-sm active:scale-[0.98] disabled:opacity-40 dark:border-sky-800/80 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="2" y="3" width="6" height="14" rx="1.5" />
                <rect x="12" y="3" width="6" height="14" rx="1.5" />
              </svg>
              <span>{t.autoArrangeLR || '左右分列'}</span>
            </button>

            <button
              type="button"
              onClick={onAutoArrangeTB}
              disabled={assignedCount === 0}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200/80 bg-indigo-50/70 p-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 hover:shadow-sm active:scale-[0.98] disabled:opacity-40 dark:border-indigo-800/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="2" width="14" height="6" rx="1.5" />
                <rect x="3" y="12" width="14" height="6" rx="1.5" />
              </svg>
              <span>{t.autoArrangeTB || '上下分行'}</span>
            </button>
          </div>
        </div>

        {/* Section 1: 连接线种类 */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {t.leaderLineStyle || '连接线种类'}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {settings.lineStyle === 'stepped'
                ? '90° 折线'
                : settings.lineStyle === 'roundedStepped'
                ? '圆角折线'
                : settings.lineStyle === 'straight'
                ? '极简直线'
                : '平滑曲线'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100/90 p-1 dark:bg-slate-800/90">
            {lineStyles.map((item) => {
              const active = settings.lineStyle === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeSettings((prev) => ({ ...prev, lineStyle: item.id }))}
                  className={`flex flex-col items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-semibold transition-all ${
                    active
                      ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                  title={item.title}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {t.lineWidth || '粗细'}:
            </span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={settings.lineWidth}
              onChange={(e) =>
                onChangeSettings((prev) => ({ ...prev, lineWidth: parseFloat(e.target.value) }))
              }
              className="h-1.5 flex-1 cursor-pointer accent-sky-500"
            />
            <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 w-8 text-right">
              {settings.lineWidth.toFixed(1)}px
            </span>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-2 pt-0.5">
            <input
              type="checkbox"
              checked={settings.lineMatchPaintColor}
              onChange={(e) =>
                onChangeSettings((prev) => ({ ...prev, lineMatchPaintColor: e.target.checked }))
              }
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
            />
            <span className="text-[11px] text-slate-600 dark:text-slate-300">
              {t.lineMatchPaint || '连接线匹配油漆主色'}
            </span>
          </label>
        </div>

        {/* Section 2: 色卡大小 & 质感 */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {t.cardSize || '色卡大小'}
            </span>
            <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
              {Math.round(settings.cardScale * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100/90 p-0.5 dark:bg-slate-800/90">
            {scalePresets.map((preset) => {
              const active = Math.abs(settings.cardScale - preset.value) < 0.05;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChangeSettings((prev) => ({ ...prev, cardScale: preset.value }))}
                  className={`rounded-md py-1 text-center text-[10px] font-semibold transition ${
                    active
                      ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">60%</span>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={settings.cardScale}
              onChange={(e) =>
                onChangeSettings((prev) => ({ ...prev, cardScale: parseFloat(e.target.value) }))
              }
              className="h-1.5 flex-1 cursor-pointer accent-sky-500"
            />
            <span className="text-[10px] text-slate-400">150%</span>
          </div>

          <label className={`flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg border p-2 transition ${
            settings.cardGlassEffect
              ? 'border-sky-300 bg-sky-50/70 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300 shadow-sm'
              : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
          }`}>
            <span className="text-[11px] font-semibold">
              ✨ {t.cardGlass || '液态玻璃质感'}
            </span>
            <input
              type="checkbox"
              checked={settings.cardGlassEffect}
              onChange={(e) =>
                onChangeSettings((prev) => ({ ...prev, cardGlassEffect: e.target.checked }))
              }
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
            />
          </label>
        </div>

        {/* Section 3: 边缘对齐 */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
              {t.edgeAlign || '边缘对齐与避让'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onAlign('left')}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400 shadow-xs"
            >
              ← {t.alignLeft || '靠左'}
            </button>
            <button
              type="button"
              onClick={() => onAlign('autoH')}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400 shadow-xs"
            >
              ↔ {t.alignAuto || '水平避让'}
            </button>
            <button
              type="button"
              onClick={() => onAlign('right')}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400 shadow-xs"
            >
              → {t.alignRight || '靠右'}
            </button>

            <button
              type="button"
              onClick={() => onAlign('top')}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400 shadow-xs"
            >
              ↑ {t.alignTop || '靠顶'}
            </button>
            <button
              type="button"
              onClick={() => onAlign('autoV')}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400 shadow-xs"
            >
              ↕ {t.alignAuto || '垂直避让'}
            </button>
            <button
              type="button"
              onClick={() => onAlign('bottom')}
              className="flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white py-1.5 text-[10px] font-medium text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400 shadow-xs"
            >
              ↓ {t.alignBottom || '靠底'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md transition-all dark:border-slate-700/80 dark:bg-slate-900/95 ${className}`}
    >
      {/* Header bar / Quick toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-sm">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm2 0v12h12V4H4z" opacity="0.3" />
              <path d="M6 8h8M6 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {t.swatchStudio || '色卡制作'}
            </span>
            <span className="ml-1.5 text-[10px] text-slate-400">
              ({assignedCount} {lang === 'zh' ? '个色卡' : 'cards'})
            </span>
          </div>
        </div>

        {/* Quick auto-layout buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onAutoArrangeLR}
            disabled={assignedCount === 0}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-sky-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-sky-400"
            title="将所有色卡左右分列排列，自动垂直避让"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="2" y="3" width="6" height="14" rx="1.5" />
              <rect x="12" y="3" width="6" height="14" rx="1.5" />
            </svg>
            <span>{t.autoArrangeLR || '左右分列'}</span>
          </button>

          <button
            type="button"
            onClick={onAutoArrangeTB}
            disabled={assignedCount === 0}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-sky-600 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-sky-400"
            title="将所有色卡上下分行排列，自动水平避让"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
              <rect x="3" y="2" width="14" height="6" rx="1.5" />
              <rect x="3" y="12" width="14" height="6" rx="1.5" />
            </svg>
            <span>{t.autoArrangeTB || '上下分行'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              isExpanded
                ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{isExpanded ? (lang === 'zh' ? '收起设置' : 'Hide') : (lang === 'zh' ? '更多设置' : 'Settings')}</span>
          </button>
        </div>
      </div>

      {/* Expanded detailed settings panel */}
      {isExpanded && (
        <div className="space-y-3.5 border-t border-slate-100 p-3.5 dark:border-slate-800/80">
          {/* Section 1: 连接线种类 (Leader Line Style) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wide text-slate-600 dark:text-slate-300">
                {t.leaderLineStyle || '连接线种类'}
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {settings.lineStyle === 'stepped'
                  ? '90° 直角工程折线'
                  : settings.lineStyle === 'roundedStepped'
                  ? '导圆角作例流线'
                  : settings.lineStyle === 'straight'
                  ? '极简直接连线'
                  : '平滑贝塞尔曲线'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-slate-100/80 p-1 dark:bg-slate-800/80">
              {lineStyles.map((item) => {
                const active = settings.lineStyle === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeSettings((prev) => ({ ...prev, lineStyle: item.id }))}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Line width and color options */}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.lineWidth || '粗细'}:
                </span>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="0.5"
                  value={settings.lineWidth}
                  onChange={(e) =>
                    onChangeSettings((prev) => ({ ...prev, lineWidth: parseFloat(e.target.value) }))
                  }
                  className="h-1.5 w-24 cursor-pointer accent-sky-500"
                />
                <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {settings.lineWidth.toFixed(1)}px
                </span>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={settings.lineMatchPaintColor}
                  onChange={(e) =>
                    onChangeSettings((prev) => ({ ...prev, lineMatchPaintColor: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                />
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  {t.lineMatchPaint || '匹配油漆颜色'}
                </span>
              </label>
            </div>
          </div>

          {/* Section 2: 色卡卡片大小与质感 (Card Size & Appearance) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wide text-slate-600 dark:text-slate-300">
                {t.cardSize || '色卡大小'}
              </span>
              <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
                {Math.round(settings.cardScale * 100)}%
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-slate-100/80 p-0.5 dark:bg-slate-800/80">
                {scalePresets.map((preset) => {
                  const active = Math.abs(settings.cardScale - preset.value) < 0.05;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onChangeSettings((prev) => ({ ...prev, cardScale: preset.value }))}
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                        active
                          ? 'bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <input
                type="range"
                min="0.6"
                max="1.5"
                step="0.05"
                value={settings.cardScale}
                onChange={(e) =>
                  onChangeSettings((prev) => ({ ...prev, cardScale: parseFloat(e.target.value) }))
                }
                className="h-1.5 min-w-[5rem] flex-1 cursor-pointer accent-sky-500"
              />

              {/* Liquid Glass toggle */}
              <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-slate-200/80 px-2 py-1 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={settings.cardGlassEffect}
                  onChange={(e) =>
                    onChangeSettings((prev) => ({ ...prev, cardGlassEffect: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  ✨ {t.cardGlass || '液态玻璃效果'}
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: 边缘对齐与微调 (Alignment Controls) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wide text-slate-600 dark:text-slate-300">
                {t.edgeAlign || '边缘对齐'}
              </span>
              <button
                type="button"
                onClick={onResetPositions}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                title="重置所有卡片到采样点附近默认偏移位置"
              >
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h5M16 16v-5h-5M4.5 9A7 7 0 0 1 15.5 6M15.5 11A7 7 0 0 1 4.5 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{t.resetLayout || '重置位置'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAlign('left')}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                ← {t.alignLeft || '靠左'}
              </button>
              <button
                type="button"
                onClick={() => onAlign('autoH')}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                ↔ {t.alignAuto || '水平自适应'}
              </button>
              <button
                type="button"
                onClick={() => onAlign('right')}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                → {t.alignRight || '靠右'}
              </button>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <button
                type="button"
                onClick={() => onAlign('top')}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                ↑ {t.alignTop || '靠顶'}
              </button>
              <button
                type="button"
                onClick={() => onAlign('autoV')}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                ↕ {t.alignAuto || '垂直自适应'}
              </button>
              <button
                type="button"
                onClick={() => onAlign('bottom')}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                ↓ {t.alignBottom || '靠底'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwatchStudioControls;
