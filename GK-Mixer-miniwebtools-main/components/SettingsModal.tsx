import React, { useState } from 'react';
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
} from '@phosphor-icons/react';
import { ColorSpace, Language } from '../types';
import {
  ACCENT_THEMES,
  AccentThemeId,
  loadAccentTheme,
  saveAccentTheme,
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

  const handleAccentChange = (id: AccentThemeId) => {
    setAccentTheme(id);
    saveAccentTheme(id);
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
                      ? 'border-amber-500 bg-amber-500 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
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
                      ? 'border-indigo-600 bg-indigo-600 font-bold text-white shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
                  }`}
                >
                  <MoonIcon className="h-4 w-4" />
                  <span>{lang === 'zh' ? '深色模式' : lang === 'ja' ? 'ダーク' : 'Dark Mode'}</span>
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
                          ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200'
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
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
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
              <div className="mt-3 flex items-center justify-between text-[11px] text-pink-500 dark:text-pink-400">
                <span className="flex items-center gap-1 font-semibold">
                  <SparkleIcon className="h-3.5 w-3.5" weight="fill" />
                  <span>{lang === 'zh' ? '特别鸣谢' : lang === 'ja' ? '特別感謝' : 'Special Thanks'}: スミレ</span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">© 2025-2026 GK-Mixer</span>
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
