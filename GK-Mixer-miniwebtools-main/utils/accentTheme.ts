import { PALETTES, PaletteName, Shade } from './accentPalettes';

/**
 * Accent theming
 * ------------------------------------------------------------------
 * Every accent colour family used by the UI (sky / blue / indigo / violet /
 * purple / pink / amber / orange + the macaron pastels) is compiled by
 * Tailwind as `rgb(var(--ac-<family>-<shade>) / <alpha>)`. Switching a theme
 * just rewrites those CSS variables, so no component class names change.
 * Semantic colours (emerald/green = success, red/rose = danger, slate = neutral)
 * are deliberately NOT themed.
 */

export const ACCENT_FAMILIES = ['sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'amber', 'orange'] as const;
export type AccentFamily = (typeof ACCENT_FAMILIES)[number];
export const SHADES: Shade[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
export const MACARON_KEYS = ['blue', 'purple', 'pink'] as const;
type MacaronKey = (typeof MACARON_KEYS)[number];

export type AccentThemeId = 'classic' | 'ocean' | 'sakura' | 'matcha' | 'sunset' | 'twilight' | 'graphite';

export interface AccentTheme {
  id: AccentThemeId;
  name: { zh: string; en: string; ja: string };
  accentHex: string;
  hoverHex: string;
  darkTextHex: string;
  map: Record<AccentFamily, PaletteName>;
  macaron: Record<MacaronKey, string>;
}

/** Original macaron pastels (kept exact for the default theme). */
export const MACARON_DEFAULTS: Record<MacaronKey, string> = {
  blue: '#AEC6CF',
  purple: '#B39EB5',
  pink: '#FFB7B2',
};

const identity: Record<AccentFamily, PaletteName> = {
  sky: 'sky', blue: 'blue', indigo: 'indigo', violet: 'violet',
  purple: 'purple', pink: 'pink', amber: 'amber', orange: 'orange',
};

const derivedMacaron = (map: Record<AccentFamily, PaletteName>): Record<MacaronKey, string> => ({
  blue: PALETTES[map.sky]['300'],
  purple: PALETTES[map.purple]['300'],
  pink: PALETTES[map.pink]['200'],
});

const make = (
  id: AccentThemeId,
  name: AccentTheme['name'],
  accentHex: string,
  hoverHex: string,
  darkTextHex: string,
  overrides: Partial<Record<AccentFamily, PaletteName>>,
  macaron?: Record<MacaronKey, string>,
): AccentTheme => {
  const map = { ...identity, ...overrides };
  return {
    id,
    name,
    accentHex,
    hoverHex,
    darkTextHex,
    map,
    macaron: macaron ?? derivedMacaron(map),
  };
};

export const ACCENT_THEMES: AccentTheme[] = [
  make('classic', { zh: '珊瑚红', en: 'Coral', ja: 'コーラル' }, '#EF5350', '#E53935', '#FF8A80', {}, MACARON_DEFAULTS),
  make('ocean', { zh: '深海蓝', en: 'Ocean', ja: 'オーシャン' }, '#3B82F6', '#2563EB', '#93C5FD', {
    sky: 'cyan', blue: 'blue', indigo: 'blue', violet: 'indigo', purple: 'indigo', pink: 'sky', amber: 'teal', orange: 'cyan',
  }),
  make('sakura', { zh: '樱花粉', en: 'Sakura', ja: 'サクラ' }, '#EC4899', '#DB2777', '#F9A8D4', {
    sky: 'pink', blue: 'rose', indigo: 'fuchsia', violet: 'fuchsia', purple: 'fuchsia', pink: 'rose', amber: 'rose', orange: 'pink',
  }),
  make('matcha', { zh: '抹茶绿', en: 'Matcha', ja: '抹茶' }, '#10B981', '#059669', '#6EE7B7', {
    sky: 'emerald', blue: 'green', indigo: 'teal', violet: 'teal', purple: 'teal', pink: 'lime', amber: 'lime', orange: 'green',
  }),
  make('sunset', { zh: '日落橙', en: 'Sunset', ja: 'サンセット' }, '#F97316', '#EA580C', '#FDBA74', {
    sky: 'orange', blue: 'amber', indigo: 'red', violet: 'rose', purple: 'rose', pink: 'amber', amber: 'amber', orange: 'red',
  }),
  make('twilight', { zh: '暮紫罗', en: 'Twilight', ja: 'トワイライト' }, '#8B5CF6', '#7C3AED', '#C4B5FD', {
    sky: 'violet', blue: 'indigo', indigo: 'indigo', violet: 'fuchsia', purple: 'fuchsia', pink: 'pink', amber: 'pink', orange: 'rose',
  }),
  make('graphite', { zh: '石墨灰', en: 'Graphite', ja: 'グラファイト' }, '#475569', '#334155', '#CBD5E1', {
    sky: 'slate', blue: 'zinc', indigo: 'slate', violet: 'zinc', purple: 'zinc', pink: 'stone', amber: 'stone', orange: 'stone',
  }),
];

export const DEFAULT_ACCENT_THEME: AccentThemeId = 'classic';
const STORAGE_KEY = 'gk-accent-theme';

export type UIStyle = 'glass' | 'blueprint';
export const DEFAULT_UI_STYLE: UIStyle = 'glass';
const UI_STYLE_STORAGE_KEY = 'gk-ui-style';
export const THEME_SYNC_EVENT = 'gk-theme-sync';

const emitThemeSync = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(THEME_SYNC_EVENT));
  }
};

export const hexToRgbTriplet = (hex: string): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export const getAccentTheme = (id: string | null | undefined): AccentTheme =>
  ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0];

export const applyAccentTheme = (id: AccentThemeId) => {
  if (typeof document === 'undefined') return;
  const theme = getAccentTheme(id);
  const style = document.documentElement.style;
  const accentRgb = hexToRgbTriplet(theme.accentHex);
  const hoverRgb = hexToRgbTriplet(theme.hoverHex);
  const darkTextRgb = hexToRgbTriplet(theme.darkTextHex);

  style.setProperty('--accent-color', theme.accentHex);
  style.setProperty('--accent-rgb', accentRgb);
  style.setProperty('--accent-hover', theme.hoverHex);
  style.setProperty('--accent-hover-rgb', hoverRgb);
  style.setProperty('--accent-soft', `rgb(${accentRgb} / 0.12)`);
  style.setProperty('--accent-dark-text-rgb', darkTextRgb);

  for (const family of ACCENT_FAMILIES) {
    const palette = PALETTES[theme.map[family]];
    for (const shade of SHADES) {
      style.setProperty(`--ac-${family}-${shade}`, hexToRgbTriplet(palette[shade]));
    }
  }
  for (const key of MACARON_KEYS) {
    style.setProperty(`--ac-macaron-${key}`, hexToRgbTriplet(theme.macaron[key]));
  }
  document.documentElement.dataset.accent = theme.id;
};

export const loadAccentTheme = (): AccentThemeId => {
  try {
    return getAccentTheme(localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_ACCENT_THEME;
  }
};

export const saveAccentTheme = (id: AccentThemeId) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
  applyAccentTheme(id);
  emitThemeSync();
};

export const applyUIStyle = (uiStyle: UIStyle) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.uiStyle = uiStyle;
};

export const loadUIStyle = (): UIStyle => {
  try {
    const raw = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return raw === 'blueprint' || raw === 'glass' ? raw : DEFAULT_UI_STYLE;
  } catch {
    return DEFAULT_UI_STYLE;
  }
};

export const saveUIStyle = (uiStyle: UIStyle) => {
  try {
    localStorage.setItem(UI_STYLE_STORAGE_KEY, uiStyle);
  } catch {
    /* storage unavailable */
  }
  applyUIStyle(uiStyle);
  emitThemeSync();
};

/** Preview swatches for the settings picker: primary / secondary / warm. */
export const themeSwatches = (theme: AccentTheme): string[] => [
  theme.accentHex,
  PALETTES[theme.map.sky]['500'],
  PALETTES[theme.map.purple]['400'],
];
