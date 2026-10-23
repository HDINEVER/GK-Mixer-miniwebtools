import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import {
  XIcon,
  PaletteIcon,
  GlobeIcon,
  CircleHalfIcon,
  SunIcon,
  MoonIcon,
  CodeIcon,
  GithubLogoIcon,
  ArrowUpRightIcon,
  TelevisionSimpleIcon,
  XLogoIcon,
  ChatCircleDotsIcon,
  SparkleIcon,
  CheckIcon,
  SwatchesIcon,
  SquaresFour as SquaresFourIcon,
} from '@phosphor-icons/react';
import { ColorSpace, Language } from '../types';
import {
  ACCENT_THEMES,
  AccentThemeId,
  UIStyle,
  WorkflowMode,
  THEME_SYNC_EVENT,
  loadAccentTheme,
  saveAccentTheme,
  loadUIStyle,
  saveUIStyle,
  loadWorkflowMode,
  saveWorkflowMode,
  loadHideTopBar,
  saveHideTopBar,
  themeSwatches,
} from '../utils/accentTheme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
  colorSpace: ColorSpace;
  setColorSpace: (cs: ColorSpace) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  t: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  setLang,
  colorSpace,
  setColorSpace,
  theme,
  setTheme,
  t,
}) => {
  const [copiedQQ, setCopiedQQ] = useState(false);
  const [accentTheme, setAccentTheme] = useState<AccentThemeId>(() => loadAccentTheme());
  const [uiStyle, setUiStyle] = useState<UIStyle>(() => loadUIStyle());
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>(() => loadWorkflowMode());
  const [hideTopBar, setHideTopBar] = useState<boolean>(() => loadHideTopBar());

  useEffect(() => {
    const sync = () => {
      setAccentTheme(loadAccentTheme());
      setUiStyle(loadUIStyle());
      setWorkflowMode(loadWorkflowMode());
      setHideTopBar(loadHideTopBar());
    };
    window.addEventListener(THEME_SYNC_EVENT, sync);
    return () => window.removeEventListener(THEME_SYNC_EVENT, sync);
  }, []);

  const handleAccentChange = (id: AccentThemeId) => {
    setAccentTheme(id);
    saveAccentTheme(id);
  };

  const handleUiStyleChange = (style: UIStyle) => {
    setUiStyle(style);
    saveUIStyle(style);
  };

  const handleWorkflowModeChange = (mode: WorkflowMode) => {
    setWorkflowMode(mode);
    saveWorkflowMode(mode);
  };

  const handleHideTopBarChange = (nextHide: boolean) => {
    setHideTopBar(nextHide);
    saveHideTopBar(nextHide);
  };

  const handleCopyQQ = () => {
    navigator.clipboard?.writeText('701691238');
    setCopiedQQ(true);
    setTimeout(() => setCopiedQQ(false), 2000);
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[90vh] max-w-lg flex-col rounded-t-[28px] border border-slate-200/70 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-2xl outline-none transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-100">
          
          {/* iOS-style grabber handle */}
          <div className="my-2.5 mx-auto h-1 w-10 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-macaron-pink" />
              <div className="h-3 w-3 rounded-full bg-macaron-blue" />
              <div className="h-3 w-3 rounded-full bg-macaron-green" />
              <Drawer.Title className="ml-1 text-base font-bold tracking-tight">
                {lang === 'zh' ? '软件设置' : lang === 'ja' ? '設定' : 'Settings'}
              </Drawer.Title>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform active:scale-[0.95] dark:bg-white/10 dark:text-slate-300"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 no-scrollbar">

            {/* 0. 双人群工作流模式 / Dual Workflow Mode */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SparkleIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '工作流动线模式 (Workflow Mode)' : 'Workflow Mode'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleWorkflowModeChange('pro')}
                  className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                    workflowMode === 'pro'
                      ? 'border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 ring-1 ring-[var(--accent-color)]/40 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-extrabold">🛠️ 专业喷涂动线</span>
                    {workflowMode === 'pro' && (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    参考图取色 ➔ 调色分解 ➔ 明度色卡 ➔ 自选混色 ➔ 试色台
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleWorkflowModeChange('beginner')}
                  className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                    workflowMode === 'beginner'
                      ? 'border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 ring-1 ring-[var(--accent-color)]/40 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-extrabold">🌱 新手引导模式</span>
                    {workflowMode === 'beginner' && (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    ① 模拟试色 ➔ ② 选品牌漆+几滴微调 ➔ ③ 导出色卡讨论/存库
                  </span>
                </button>
              </div>
            </div>

            {/* 0.5. 混色模式区别说明 / Mixing Modes Explanation */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
              <label className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <PaletteIcon className="h-3.5 w-3.5 text-accent" />{' '}
                {lang === 'zh'
                  ? '混色模式区别说明 (Mixbox vs HSB 纯色源)'
                  : lang === 'ja'
                  ? '混色モードの違い (Mixbox vs HSB 純色ソース)'
                  : 'Mixing Modes Guide (Mixbox vs HSB Pure CMY)'}
              </label>

              <div className="grid grid-cols-1 gap-2.5 text-xs">
                <div className="rounded-xl border border-blue-200/70 bg-white/90 p-2.5 dark:border-blue-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                      🎨 {lang === 'zh' ? 'Mixbox (含红黄蓝实色)' : 'Mixbox (Solid + CMY)'}
                    </span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {lang === 'zh' ? '10瓶 · 含3实色' : '10 Paints'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {lang === 'zh'
                      ? '使用 001/002 黑白底漆 + 003光泽红 / 004光泽蓝 / 005光泽黄（三个普通基础实色）+ 033/034 色源及 015/036/037 间色。适合手头备有常规红黄蓝实色主漆、需要直接高遮盖力调色的玩家。'
                      : 'Uses 001/002 Base B/W + 003 Red / 004 Blue / 005 Yellow solid paints + CMY & secondary color sources. Ideal if you stock standard opaque red/blue/yellow paints.'}
                  </p>
                </div>

                <div className="rounded-xl border border-cyan-200/70 bg-white/90 p-2.5 dark:border-cyan-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-cyan-600 dark:text-cyan-400">
                      ✨ {lang === 'zh' ? 'HSB (纯色源·无实色)' : 'HSB (Pure Color Sources)'}
                    </span>
                    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                      {lang === 'zh' ? '8瓶 · 纯色源体系' : '8 Pure Sources'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {lang === 'zh'
                      ? '去掉红、蓝、黄三个普通实色，仅用 001/002 黑白底漆 + 033青 / 034品红 / 035黄（CMY三原色源）+ 015橙 / 036绿 / 037紫（三间色源）。依靠半透明色源减色耦合（如品红+橙得正红、青+紫得正蓝），避免实色颜料跨色相混合发灰发脏。'
                      : 'Excludes opaque Red/Blue/Yellow solids. Uses only 001/002 B/W base + CMY primary sources (033/034/035) + secondary sources (015/036/037) for clean, high-chroma subtractive mixing.'}
                  </p>
                </div>

                <div className="rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {lang === 'zh'
                    ? '💡 两种模式均可独立开关「间色色源 (015橙/036绿/037紫)」：开启时以「以一顶二」直接替代双原色混配；关闭时自动回退为原色混配。'
                    : '💡 Both modes support toggling Secondary Sources (015 Orange / 036 Green / 037 Purple) on or off.'}
                </div>
              </div>
            </div>
            
            {/* 1. 色彩空间 / Color Space */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <PaletteIcon className="h-3.5 w-3.5" /> {t.colorSpace || 'COLOR SPACE'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setColorSpace('srgb')}
                  className={`rounded-xl border py-2.5 px-2 text-center text-xs font-medium transition-all active:scale-[0.97] ${
                    colorSpace === 'srgb'
                      ? 'border-sky-500 bg-sky-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">sRGB</div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {lang === 'zh' ? '标准显示' : lang === 'ja' ? '標準' : 'Standard'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setColorSpace('display-p3')}
                  className={`rounded-xl border py-2.5 px-2 text-center text-xs font-medium transition-all active:scale-[0.97] ${
                    colorSpace === 'display-p3'
                      ? 'border-sky-500 bg-sky-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">Display P3</div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {lang === 'zh' ? 'Apple 广色域' : lang === 'ja' ? '広色域' : 'Wide Gamut'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setColorSpace('adobe-rgb')}
                  className={`rounded-xl border py-2.5 px-2 text-center text-xs font-medium transition-all active:scale-[0.97] ${
                    colorSpace === 'adobe-rgb'
                      ? 'border-sky-500 bg-sky-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold">Adobe RGB</div>
                  <div className="mt-0.5 text-[10px] opacity-80">
                    {lang === 'zh' ? '印刷设计' : lang === 'ja' ? '印刷設計' : 'Print Design'}
                  </div>
                </button>
              </div>
            </div>

            {/* 2. 界面语言 / Language */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <GlobeIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '界面语言' : lang === 'ja' ? '言語' : 'Language'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLang('zh')}
                  className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all active:scale-[0.97] ${
                    lang === 'zh'
                      ? 'border-emerald-500 bg-emerald-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  简体中文
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all active:scale-[0.97] ${
                    lang === 'en'
                      ? 'border-emerald-500 bg-emerald-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ja')}
                  className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all active:scale-[0.97] ${
                    lang === 'ja'
                      ? 'border-emerald-500 bg-emerald-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  日本語
                </button>
              </div>
            </div>

            {/* 3. 外观主题 / Appearance */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <CircleHalfIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '外观主题' : lang === 'ja' ? '外観テーマ' : 'Appearance'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-medium transition-all active:scale-[0.97] ${
                    theme === 'light'
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)] font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <SunIcon className="h-4 w-4" />
                  <span>{lang === 'zh' ? '浅色模式' : lang === 'ja' ? 'ライト' : 'Light Mode'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 text-xs font-medium transition-all active:scale-[0.97] ${
                    theme === 'dark'
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)] font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <MoonIcon className="h-4 w-4" />
                  <span>{lang === 'zh' ? '深色模式' : lang === 'ja' ? 'ダーク' : 'Dark Mode'}</span>
                </button>
              </div>
            </div>

            {/* 3.2. 顶部栏显示与隐藏 / Top Header Bar Visibility */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SquaresFourIcon className="h-3.5 w-3.5" />{' '}
                {lang === 'zh' ? '顶部品牌栏显示' : lang === 'ja' ? 'トップバー表示' : 'Top Header Bar'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleHideTopBarChange(false)}
                  aria-pressed={!hideTopBar}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border py-2.5 px-3 text-left text-xs font-medium transition-all active:scale-[0.97] ${
                    !hideTopBar
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)] font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <span>📌 {lang === 'zh' ? '显示顶部栏' : lang === 'ja' ? '表示する' : 'Show Top Bar'}</span>
                  <span className="text-[10px] opacity-80 font-normal">
                    {lang === 'zh' ? '常驻 GK-Mixer 标题与按钮' : 'Standard top header'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleHideTopBarChange(true)}
                  aria-pressed={hideTopBar}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border py-2.5 px-3 text-left text-xs font-medium transition-all active:scale-[0.97] ${
                    hideTopBar
                      ? 'border-[var(--accent-color)] bg-[var(--accent-color)] font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <span>☰ {lang === 'zh' ? '隐藏顶部栏 (悬浮方块)' : lang === 'ja' ? '非表示 (フローティング)' : 'Hide (Floating Cube)'}</span>
                  <span className="text-[10px] opacity-80 font-normal">
                    {lang === 'zh' ? '右上角保留三横杠方块开设置' : 'Floating 3-bar button'}
                  </span>
                </button>
              </div>
            </div>

            {/* 3.5. 界面视觉风格 / UI Visual Style */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SquaresFourIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '界面视觉风格 (UI Style)' : lang === 'ja' ? 'UI スタイル' : 'UI Visual Style'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUiStyleChange('glass')}
                  aria-pressed={uiStyle === 'glass'}
                  className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.97] ${
                    uiStyle === 'glass'
                      ? 'border-[var(--accent-color)] bg-[var(--accent-soft)] text-slate-900 ring-1 ring-[var(--accent-color)]/40 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-extrabold">
                      🔮 {lang === 'zh' ? '流体毛玻璃 (Glass)' : lang === 'ja' ? 'リキッドガラス' : 'Liquid Glass'}
                    </span>
                    {uiStyle === 'glass' && (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    {lang === 'zh'
                      ? '大圆角 · 磨砂半透明 · 柔和弥散阴影'
                      : 'Frosted blur, large radii & soft shadows'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUiStyleChange('blueprint')}
                  aria-pressed={uiStyle === 'blueprint'}
                  className={`relative flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all active:scale-[0.97] ${
                    uiStyle === 'blueprint'
                      ? 'border-slate-900 bg-[var(--accent-soft)] text-slate-900 shadow-[2px_2px_0px_#0f172a] dark:border-slate-300 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-extrabold">
                      📐 {lang === 'zh' ? '工程线框风 (Blueprint)' : lang === 'ja' ? 'ブループリント' : 'Blueprint Wireframe'}
                    </span>
                    {uiStyle === 'blueprint' && (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded text-white border border-slate-900"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    {lang === 'zh'
                      ? '24px 工程网格 · 1.5px 硬边框 · 机械硬投影'
                      : '24px grid, 1.5px crisp border & hard offset shadow'}
                  </span>
                </button>
              </div>
            </div>

            {/* 4. 配色风格 / Accent Theme */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SwatchesIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '配色风格' : lang === 'ja' ? 'アクセントカラー' : 'Accent Theme'}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_THEMES.map((item) => {
                  const active = accentTheme === item.id;
                  const [a, b, c] = themeSwatches(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAccentChange(item.id)}
                      aria-pressed={active}
                      className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 text-[11px] font-semibold transition-all duration-150 active:scale-[0.96] ${
                       active
                          ? 'border-accent bg-accent/10 text-accent shadow-sm ring-1 ring-accent/40 dark:bg-accent/15 dark:text-accent-light'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                      }`}
                    >
                      <span className="flex -space-x-1.5">
                        {[a, b, c].map((color, i) => (
                          <span
                            key={i}
                            className="h-5 w-5 rounded-full border-2 border-white shadow-sm dark:border-slate-900"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      <span className="truncate">{item.name[lang] ?? item.name.en}</span>
                      {active && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
                          <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                {lang === 'zh'
                  ? '切换全局强调色（按钮、选中态、标签等），不影响颜料与取色结果。'
                  : lang === 'ja'
                  ? 'UI のアクセントカラーを切り替えます。塗料データには影響しません。'
                  : 'Changes UI accent colours only — paint data and picked colours are unaffected.'}
              </p>
            </div>

            {/* 5. 开发者信息与社群链接 (整合左右页面所有的开发者信息) */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors dark:border-slate-700/80 dark:bg-slate-800/50">
              <label className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <CodeIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '关于开发者与软件' : lang === 'ja' ? '開発者について' : 'About Developer'}
              </label>

              {/* Developer Profile Card */}
              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/HDINEVER/GK-Mixer-miniwebtools"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-gradient-to-br from-macaron-pink via-macaron-blue to-macaron-purple text-base font-black text-white shadow-md transition-transform active:scale-90"
                  title="Visit GitHub Repository"
                >
                  HD
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                      @HDIN
                    </span>
                    <span className="rounded-full bg-macaron-blue/30 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-macaron-blue/20 dark:text-sky-200">
                      {lang === 'zh' ? '开发者' : lang === 'ja' ? '開発者' : 'Developer'}
                    </span>
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'zh'
                      ? '模型爱好者的调色工具'
                      : lang === 'ja'
                      ? 'モデラーのための塗装調色ツール'
                      : 'Paint Mixing Tool for Modelers'}
                  </div>
                </div>
              </div>

              {/* GitHub Repository Link Button */}
              <a
                href="https://github.com/HDINEVER/GK-Mixer-miniwebtools"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3.5 flex items-center justify-between rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <GithubLogoIcon className="h-4 w-4" />
                  <span>GitHub Repository</span>
                </div>
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400">HDINEVER/GK-Mixer <ArrowUpRightIcon className="h-3 w-3" /></span>
              </a>

              {/* Social Channels */}
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <a
                  href="https://space.bilibili.com/26458514"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white py-2 text-xs font-medium text-slate-700 transition-all hover:text-sky-500 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <TelevisionSimpleIcon className="h-4 w-4" />
                  <span>Bilibili</span>
                </a>
                <a
                  href="https://x.com/kroos_h"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white py-2 text-xs font-medium text-slate-700 transition-all hover:text-sky-500 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <XLogoIcon className="h-4 w-4" />
                  <span>Twitter / X</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyQQ}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white py-2 text-xs font-medium text-slate-700 transition-all hover:text-sky-500 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <ChatCircleDotsIcon className="h-4 w-4" />
                  <span>{copiedQQ ? '已复制！' : 'QQ群: 701691238'}</span>
                </button>
              </div>

              {/* Special Thanks */}
              <div className="mt-3.5 rounded-xl border border-pink-200/70 dark:border-pink-900/40 bg-pink-50/40 dark:bg-pink-950/20 p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-pink-500 dark:text-pink-400">
                  <span className="flex items-center gap-1 font-bold">
                    <SparkleIcon className="h-3.5 w-3.5" weight="fill" />
                    <span>{lang === 'zh' ? '特别鸣谢' : lang === 'ja' ? '特別感謝' : 'Special Thanks'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">© 2025-2026 GK-Mixer</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-pink-200/60 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/80 px-2.5 py-1.5 shadow-2xs">
                    <img
                      src="/avatar-achuan.jpg"
                      alt="スミレ 阿川"
                      className="h-8 w-8 rounded-full object-cover border border-pink-300 dark:border-pink-700 shadow-xs shrink-0"
                    />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        スミレ (阿川)
                      </div>
                      <div className="truncate text-[10px] text-pink-500 dark:text-pink-400 font-semibold">
                        Special Thanks
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-pink-200/60 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/80 px-2.5 py-1.5 shadow-2xs">
                    <img
                      src="/avatar-tornado.png"
                      alt="tornado"
                      className="h-8 w-8 rounded-full object-cover border border-pink-300 dark:border-pink-700 shadow-xs shrink-0"
                    />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">
                        tornado
                      </div>
                      <div className="truncate text-[10px] text-pink-500 dark:text-pink-400 font-semibold">
                        Special Thanks
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technology & Algorithms Credit */}
              <div className="mt-2.5 border-t border-slate-200/60 pt-2.5 text-[11px] text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">GK-Mixer v2.0</span>
                  <span className="text-[10px] text-slate-400">Android APK & Web Edition</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Powered by: Mixbox 2.0 · CIEDE2000 · RAL · miniature-paints · ModKit Swatch
                </div>
              </div>
            </div>

          </div>

          {/* Confirm Button */}
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 py-3 text-center text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98] dark:bg-white dark:text-slate-900"
            >
              {lang === 'zh' ? '完成' : lang === 'ja' ? '完了' : 'Done'}
            </button>
          </div>

        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default SettingsModal;
