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
  UIFontScale,
  THEME_SYNC_EVENT,
  loadAccentTheme,
  saveAccentTheme,
  loadUIStyle,
  saveUIStyle,
  loadWorkflowMode,
  saveWorkflowMode,
  loadHideTopBar,
  saveHideTopBar,
  loadUIFontScale,
  saveUIFontScale,
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
  const [fontScale, setFontScale] = useState<UIFontScale>(() => loadUIFontScale());

  useEffect(() => {
    const sync = () => {
      setAccentTheme(loadAccentTheme());
      setUiStyle(loadUIStyle());
      setWorkflowMode(loadWorkflowMode());
      setHideTopBar(loadHideTopBar());
      setFontScale(loadUIFontScale());
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

  const handleFontScaleChange = (nextScale: UIFontScale) => {
    setFontScale(nextScale);
    saveUIFontScale(nextScale);
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
        <Drawer.Content className="bp-modal-shell fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[90dvh] max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-slate-200/70 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-2xl outline-none transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/95 dark:text-slate-100">
          
          {/* Modal Header (includes grabber handle so header background & z-index cover the full top cap) */}
          <div className="bp-modal-header relative z-20 shrink-0 border-b border-slate-100 px-5 pt-2.5 pb-3 dark:border-slate-800">
            {/* iOS-style grabber handle */}
            <div className="bp-modal-grabber mb-2.5 mx-auto h-1 w-10 rounded-full bg-slate-300/90 dark:bg-slate-600/90" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {uiStyle === 'catalog' ? (
                  <span
                    className="inline-flex items-center justify-center border border-current px-1.5 py-0.5 text-[10px] font-bold tracking-tight"
                    style={{ fontFamily: '"FT", Arial, sans-serif' }}
                  >
                    FT · 05
                  </span>
                ) : uiStyle === 'ascii' ? (
                  <span className="font-mono text-xs font-bold">[#]</span>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full border border-black/10 bg-macaron-pink" />
                    <div className="h-3 w-3 rounded-full border border-black/10 bg-macaron-blue" />
                    <div className="h-3 w-3 rounded-full border border-black/10 bg-macaron-green" />
                  </>
                )}
                <Drawer.Title className="ml-1 text-base font-bold tracking-tight">
                  {lang === 'zh' ? '软件设置' : lang === 'ja' ? '設定' : 'Settings'}
                </Drawer.Title>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="bp-btn flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform active:scale-[0.96] dark:bg-white/10 dark:text-slate-300"
                aria-label="Close"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="relative z-0 flex-1 min-h-0 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 no-scrollbar">

            {/* 0. 双人群工作流模式 / Dual Workflow Mode */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SparkleIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '工作流动线模式 (Workflow Mode)' : 'Workflow Mode'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleWorkflowModeChange('pro')}
                  aria-pressed={workflowMode === 'pro'}
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
                  aria-pressed={workflowMode === 'beginner'}
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

            {/* 0.5. 混色分色模式说明 / Mixing Modes Summary */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <label className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200">
                  <PaletteIcon className="h-3.5 w-3.5 text-accent" />{' '}
                  {lang === 'zh'
                    ? '混色分色说明（高达 / GK 喷涂自调色双方案）'
                    : lang === 'ja'
                    ? '混色モード案内（ガンプラ/GKエアブラシ調色）'
                    : 'Mixing Modes (Gundam/GK Airbrush Self-Mixing)'}
                </label>
                <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-700/60 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                  {lang === 'zh' ? '⚠️ 笔涂玩家仅供参考' : '⚠️ Brush painters: reference only'}
                </span>
              </div>

              <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                {lang === 'zh'
                  ? '颜色分解专为【高达 / GK 喷涂自调色玩家】设计，针对手头是否备有全套色源漆提供以下两个方案：'
                  : 'Designed for Gundam/GK airbrush self-mixing players, offering two schemes based on whether you own a full set of CMY color source paints:'}
              </p>

              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="rounded-xl border border-blue-200/70 bg-white/90 p-2.5 dark:border-blue-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-blue-600 dark:text-blue-400">
                      🎨 {lang === 'zh' ? '方案一 · Mixbox（含红黄蓝实色）' : 'Scheme 1 · Mixbox (Solid RYB)'}
                    </span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {lang === 'zh' ? '无全套色源 · 常规实色' : 'Standard Solids'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                    {lang === 'zh'
                      ? '黑白底漆 + 红/黄/蓝普通实色主漆（可辅以少量色源/间色），适合使用常规基础实色直接调配、追求高遮盖力的喷涂玩家。'
                      : 'B/W base + standard Red/Yellow/Blue opaque paints. Ideal when mixing with regular high-opacity paints without a full CMY source set.'}
                  </p>
                </div>

                <div className="rounded-xl border border-cyan-200/70 bg-white/90 p-2.5 dark:border-cyan-900/40 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-cyan-600 dark:text-cyan-400">
                      ✨ {lang === 'zh' ? '方案二 · HSB（纯色源·无实色）' : 'Scheme 2 · HSB (Pure CMY Sources)'}
                    </span>
                    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                      {lang === 'zh' ? '备齐CMY全套色源' : 'Full CMY Sources'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                    {lang === 'zh'
                      ? '去掉红黄蓝实色，仅用黑白底漆 + 青/品红/黄 CMY 色源（及橙/绿/紫间色）减色混配，高饱和跨色相调色纯净不发灰。'
                      : 'Excludes opaque RYB solids; uses only B/W base + CMY primary & secondary color sources for clean, high-chroma subtractive mixing.'}
                  </p>
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
                  aria-pressed={colorSpace === 'srgb'}
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
                  aria-pressed={colorSpace === 'display-p3'}
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
                  aria-pressed={colorSpace === 'adobe-rgb'}
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
                  aria-pressed={lang === 'zh'}
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
                  aria-pressed={lang === 'en'}
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
                  aria-pressed={lang === 'ja'}
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
                  aria-pressed={theme === 'light'}
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
                  aria-pressed={theme === 'dark'}
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

            {/* 3.3. 网页字体大小比例缩放 / UI Font Scale */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SquaresFourIcon className="h-3.5 w-3.5" />{' '}
                {lang === 'zh' ? '网页字体大小缩放 (Font Scale)' : lang === 'ja' ? '文字サイズ倍率' : 'UI Font Scale'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: '100' as UIFontScale,
                      title: '100% 标准 (默认)',
                      sub: lang === 'zh' ? '紧凑干练·显示最全' : 'Default compact',
                    },
                    {
                      id: '108' as UIFontScale,
                      title: '108% 适中',
                      sub: lang === 'zh' ? '字号微幅放大' : 'Slightly larger',
                    },
                    {
                      id: '115' as UIFontScale,
                      title: '115% 大字号',
                      sub: lang === 'zh' ? '适合高分大屏' : 'Large display',
                    },
                  ]
                ).map((opt) => {
                  const active = fontScale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleFontScaleChange(opt.id)}
                      aria-pressed={active}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border py-2.5 px-2 text-center text-xs font-medium transition-all active:scale-[0.97] ${
                        active
                          ? 'border-[var(--accent-color)] bg-[var(--accent-color)] font-bold text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-bold">{opt.title}</span>
                      <span className="text-[10px] opacity-80 font-normal">{opt.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3.5. 界面视觉风格 / UI Visual Style */}
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <SquaresFourIcon className="h-3.5 w-3.5" /> {lang === 'zh' ? '界面视觉风格 (UI Style)' : lang === 'ja' ? 'UI スタイル' : 'UI Visual Style'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUiStyleChange('glass')}
                  aria-pressed={uiStyle === 'glass'}
                  className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.96] ${
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
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
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
                  <span
                    className="mt-0.5 inline-block rounded bg-slate-200/70 px-1.5 py-0.5 text-[9.5px] text-slate-600 dark:bg-slate-700/70 dark:text-slate-300"
                    style={{ fontFamily: '"Plus Jakarta Sans", "MiSans", sans-serif' }}
                  >
                    Aa 字体：MiSans + Space Grotesk
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUiStyleChange('blueprint')}
                  aria-pressed={uiStyle === 'blueprint'}
                  className={`relative flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all active:scale-[0.96] ${
                    uiStyle === 'blueprint'
                      ? 'border-slate-900 bg-[var(--accent-soft)] text-slate-900 shadow-[2px_2px_0px_#0f172a] dark:border-slate-300 dark:text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className="text-xs font-extrabold"
                      style={{ fontFamily: '"Chakra Petch", "Smiley Sans", sans-serif' }}
                    >
                      📐 {lang === 'zh' ? '工程线框风 (Blueprint)' : lang === 'ja' ? 'ブループリント' : 'Blueprint Wireframe'}
                    </span>
                    {uiStyle === 'blueprint' && (
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-white border border-slate-900"
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
                  <span
                    className="mt-0.5 inline-block rounded border border-slate-400/60 bg-white/80 px-1.5 py-0.5 text-[9.5px] text-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    style={{ fontFamily: '"Chakra Petch", "Smiley Sans", monospace' }}
                  >
                    Aa 字体：得意黑 + Chakra 机甲体
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUiStyleChange('craft')}
                  aria-pressed={uiStyle === 'craft'}
                  className={`relative flex flex-col items-start gap-1 rounded-[18px] border border-transparent p-3 text-left transition-all ${
                    uiStyle === 'craft'
                      ? 'bg-[var(--neu-light-base,#e0e5ec)] text-[var(--neu-light-text,#001f3f)] shadow-[inset_4px_4px_8px_var(--neu-light-dark,#bec3c9),inset_-4px_-4px_8px_var(--neu-light-light,#ffffff)] ring-1 ring-[var(--accent-color)]/35 dark:bg-[var(--neu-dark-base,#23272e)] dark:text-[var(--neu-dark-text,#f6f5f7)] dark:shadow-[inset_4px_4px_8px_var(--neu-dark-dark,#16181d),inset_-4px_-4px_8px_var(--neu-dark-light,#2e333c)]'
                      : 'bg-[var(--neu-light-base,#e0e5ec)] text-[var(--neu-light-text,#001f3f)] shadow-[5px_5px_10px_var(--neu-light-dark,#bec3c9),-5px_-5px_10px_var(--neu-light-light,#ffffff)] dark:bg-[var(--neu-dark-base,#23272e)] dark:text-[var(--neu-dark-text,#f6f5f7)] dark:shadow-[5px_5px_10px_var(--neu-dark-dark,#16181d),-5px_-5px_10px_var(--neu-dark-light,#2e333c)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className="text-xs font-extrabold"
                      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans JP", "Noto Sans SC", sans-serif' }}
                    >
                      ☁️ {lang === 'zh' ? '新拟态软浮雕 (Neumorphism)' : lang === 'ja' ? 'ニューモーフィズム (Soft UI)' : 'Neumorphism (Soft UI)'}
                    </span>
                    {uiStyle === 'craft' && (
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white shadow-[2px_2px_4px_rgba(0,0,0,0.2)]"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        <CheckIcon className="h-2.5 w-2.5" weight="bold" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    {lang === 'zh'
                      ? '145° 双极明暗柔光阴影 · 同色系软泥凹凸浮雕 · 随主题联动'
                      : '145° dual soft shadows, extruded/inset clay relief & theme tint'}
                  </span>
                  <span
                    className="mt-0.5 inline-block rounded-lg bg-[var(--neu-light-base,#e0e5ec)] px-1.5 py-0.5 text-[9.5px] text-[var(--neu-light-text,#001f3f)] shadow-[inset_2px_2px_4px_var(--neu-light-dark,#bec3c9),inset_-2px_-2px_4px_var(--neu-light-light,#ffffff)] dark:bg-[var(--neu-dark-base,#23272e)] dark:text-[var(--neu-dark-text,#f6f5f7)] dark:shadow-[inset_2px_2px_4px_var(--neu-dark-dark,#16181d),inset_-2px_-2px_4px_var(--neu-dark-light,#2e333c)]"
                    style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans JP", "Noto Sans SC", sans-serif' }}
                  >
                    Aa 字体：Plus Jakarta Sans + Noto Sans (neumorphism.io)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUiStyleChange('ascii')}
                  aria-pressed={uiStyle === 'ascii'}
                  className={`relative flex flex-col items-start gap-1 rounded-none border-[1.5px] p-3 text-left transition-none ${
                    uiStyle === 'ascii'
                      ? 'border-[var(--tui-border,#1B2F4A)] bg-[var(--tui-subsurface,#E1EBF7)] text-[var(--tui-ink,#101C2B)] outline outline-1 -outline-offset-4 outline-[var(--tui-border,#1B2F4A)] shadow-[3px_3px_0px_var(--accent-color)] dark:border-[#3E5C82] dark:bg-[#121E30] dark:text-[#E2ECF7] dark:outline-[#3E5C82]'
                      : 'border-slate-800 bg-[#EBF2FA] text-slate-900 shadow-[3px_3px_0px_rgba(27,47,74,0.28)] hover:bg-slate-900 hover:text-white dark:border-[#3E5C82] dark:bg-[#0D1522] dark:text-[#E2ECF7] dark:shadow-[3px_3px_0px_rgba(0,0,0,0.75)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className="text-xs font-bold tracking-wider"
                      style={{ fontFamily: '"Silkscreen", "Geist Mono", "Zpix", "DotGothic16", monospace' }}
                    >
                      📟 {lang === 'zh' ? '终端字符风 (ASCII)' : lang === 'ja' ? 'ASCII ターミナル' : 'ASCII Terminal'}
                    </span>
                    {uiStyle === 'ascii' && (
                      <span
                        className="flex h-4 px-1 shrink-0 items-center justify-center rounded-none text-[10px] font-mono font-bold text-white"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        [*]
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] leading-snug text-slate-600 dark:text-slate-400">
                    {lang === 'zh'
                      ? '0px 双线制表框 · 动态 ASCII 光场背景 · 低饱和主题联动'
                      : '0px double box-drawing, live GradientASCII shader & desaturated TUI'}
                  </span>
                  <span
                    className="mt-0.5 inline-block rounded-none border border-[var(--tui-border,#1B2F4A)] bg-[var(--tui-header-tint,#D6E4F4)] px-1.5 py-0.5 text-[9.5px] text-[var(--tui-ink,#101C2B)] dark:border-[#3E5C82] dark:bg-[#16253B] dark:text-[#E2ECF7]"
                    style={{ fontFamily: '"Silkscreen", "Geist Mono", "Zpix", "DotGothic16", monospace' }}
                  >
                    [Aa] 字体：Silkscreen + Geist Mono + Zpix / DotGothic16
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUiStyleChange('catalog')}
                  aria-pressed={uiStyle === 'catalog'}
                  className={`sm:col-span-2 relative flex flex-col items-start gap-1.5 rounded-none border p-3.5 text-left transition-colors duration-200 ${
                    uiStyle === 'catalog'
                      ? 'border-[var(--ft-light-stage-ink,#24352b)] bg-[var(--ft-light-acid,#e5ed85)] text-[var(--ft-light-stage-ink,#24352b)] shadow-none dark:border-[var(--ft-dark-acid,#e5ed85)] dark:bg-[var(--ft-dark-surface,#24352b)] dark:text-[var(--ft-dark-ink,#f7f8f2)]'
                      : 'border-[var(--ft-light-line,rgba(36,53,43,0.35))] bg-[var(--ft-light-paper,#f7f8f2)] text-[var(--ft-light-ink,#24352b)] shadow-none hover:bg-[var(--ft-light-acid,#e5ed85)] hover:border-[var(--ft-light-stage-ink,#24352b)] dark:border-[var(--ft-dark-line,rgba(247,248,242,0.28))] dark:bg-[var(--ft-dark-paper,#1b2820)] dark:text-[var(--ft-dark-ink,#f7f8f2)] dark:hover:bg-[var(--ft-dark-surface,#24352b)]'
                  }`}
                >
                  <div className="flex w-full items-baseline justify-between gap-2 border-b border-current/25 pb-1.5">
                    <div className="flex items-baseline gap-2.5">
                      <span
                        className="text-base leading-none text-current"
                        style={{
                          fontFamily: '"FT", "Roboto Flex", sans-serif',
                          fontVariationSettings: "'wght' 760, 'wdth' 110, 'opsz' 50",
                          letterSpacing: '-0.04em',
                        }}
                      >
                        fieldwork<sup className="text-[9px] ml-0.5 font-sans">®</sup>
                      </span>
                      <span
                        className="text-xs font-medium tracking-tight"
                        style={{
                          fontFamily: '"FT", "Roboto Flex", "Noto Sans SC", sans-serif',
                          fontVariationSettings: "'wght' 550, 'wdth' 102, 'opsz' 32",
                        }}
                      >
                        {lang === 'zh'
                          ? 'Fieldwork Type 铸字厂样本风 (FT System)'
                          : lang === 'ja'
                            ? 'Fieldwork Type 活字見本帳 (FT System)'
                            : 'Fieldwork Type · FT System Specimen'}
                      </span>
                    </div>
                    {uiStyle === 'catalog' ? (
                      <span
                        className="inline-flex h-5 px-2 shrink-0 items-center justify-center text-[10px] font-medium tracking-tight bg-[var(--ft-light-stage-ink,#24352b)] text-[var(--ft-light-acid,#e5ed85)] dark:bg-[var(--ft-dark-acid,#e5ed85)] dark:text-[var(--ft-dark-stage-ink,#24352b)]"
                        style={{ fontFamily: '"FT", Arial, sans-serif' }}
                      >
                        No. 05 · Active →
                      </span>
                    ) : (
                      <span className="text-[11px] opacity-70 tabular-nums">No. 05 / Variable sans</span>
                    )}
                  </div>
                  <span className="text-[10.5px] leading-relaxed opacity-85">
                    {lang === 'zh'
                      ? 'Oil UI 独立铸字厂样本美学 · 随 7 套主题色联动切换专属三色印刷样本板 (高明度舞台块 × 深色铸字油墨 × 温润样本纸) · 零阴影 1px 标尺线'
                      : 'Oil UI independent type foundry specimen: 7 adaptive foundry color triads (luminous specimen stage × deep chromatic ink × warm paper), zero offset shadows & 1px axis rules'}
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-block border border-current/35 bg-[var(--ft-light-paper,#f7f8f2)] px-2 py-0.5 text-[10px] text-[var(--ft-light-ink,#24352b)] dark:bg-[var(--ft-dark-paper,#1b2820)] dark:text-[var(--ft-dark-acid,#e5ed85)]"
                      style={{
                        fontFamily: '"FT", "Roboto Flex", "Noto Sans SC", sans-serif',
                        fontVariationSettings: "'wght' 520, 'wdth' 105, 'opsz' 24",
                      }}
                    >
                      Aa 字体：FT System (Roboto Flex 可变三轴 wght 100–900 · wdth 50–151 · opsz 8–144) + Arial + 思源黑体
                    </span>
                    <span className="inline-flex items-center gap-1 border border-current/35 bg-[var(--ft-light-plate,#ced9f0)] px-2 py-0.5 text-[10px] text-[var(--ft-light-stage-ink,#24352b)] tabular-nums">
                      <span>Good things take type.</span>
                    </span>
                  </div>
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
                  const [a, b, c] = themeSwatches(item, uiStyle);
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
                  ? uiStyle === 'ascii'
                    ? 'ASCII 模式下切换预设将同步切换背后 GradientASCII 动态字符光场配色、几何形态及低饱和终端面板色调，不影响颜料取色结果。'
                    : '切换全局强调色（按钮、选中态、标签等），不影响颜料与取色结果。'
                  : lang === 'ja'
                  ? 'UI のアクセントカラーと ASCII 背景光フィールドを切り替えます。塗料データには影響しません。'
                  : 'Switches UI accent palette (and live GradientASCII background in ASCII mode) without affecting paint data.'}
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

              {/* Technology, Licensing & Compliance Notice (Plan B: PolyForm Noncommercial 1.0.0 + Encrypted Core) */}
              <div className="mt-2.5 border-t border-slate-200/60 pt-2.5 text-[11px] text-slate-500 dark:border-slate-700/60 dark:text-slate-400 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    GK Paint Mixer v2.5
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Web · iOS App Store (JP/US/HK) · Android
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  Powered by: Mixbox 2.0 · CIEDE2000 · RAL Classic · OpenSCAD CSG & PBR/NPR Shader Engine
                </div>
                <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/60 p-2 text-[9.5px] leading-relaxed text-slate-500 dark:text-slate-400 space-y-1">
                  <div className="font-bold text-slate-700 dark:text-slate-200">
                    ⚖️ 开源协议与防抄袭合规声明 (PolyForm Noncommercial 1.0.0)
                  </div>
                  <div>
                    1. <strong>非商业开源授权</strong>：本仓库基于 <strong>PolyForm Noncommercial License 1.0.0</strong> 发布，仅供个人涂装爱好者学习与非商业使用，严禁任何未经授权的商业用途；核心调色与光影推导算法已做加密保护。
                  </div>
                  <div>
                    2. <strong>商标与原创资产免责</strong>：应用内收录之油漆品牌名称与色号仅作客观色彩检索与工艺参考，相关商标归各自权利人所有，与本应用无隶属或背书关系；内置 3D 几何体均为参数化数学建模原创生成，不含任何第三方受版权保护的模型资产。
                  </div>
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
