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
  overrides: Partial<Record<AccentFamily, PaletteName>>,
  macaron?: Record<MacaronKey, string>,
): AccentTheme => {
  const map = { ...identity, ...overrides };
  return { id, name, map, macaron: macaron ?? derivedMacaron(map) };
};

export const ACCENT_THEMES: AccentTheme[] = [
  make('classic', { zh: '马卡龙', en: 'Macaron', ja: 'マカロン' }, {}, MACARON_DEFAULTS),
  make('ocean', { zh: '深海', en: 'Ocean', ja: 'オーシャン' }, {
    sky: 'cyan', blue: 'blue', indigo: 'blue', violet: 'indigo', purple: 'indigo', pink: 'sky', amber: 'teal', orange: 'cyan',
  }),
  make('sakura', { zh: '樱花', en: 'Sakura', ja: 'サクラ' }, {
    sky: 'pink', blue: 'rose', indigo: 'fuchsia', violet: 'fuchsia', purple: 'fuchsia', pink: 'rose', amber: 'rose', orange: 'pink',
  }),
  make('matcha', { zh: '抹茶', en: 'Matcha', ja: '抹茶' }, {
    sky: 'emerald', blue: 'green', indigo: 'teal', violet: 'teal', purple: 'teal', pink: 'lime', amber: 'lime', orange: 'green',
  }),
  make('sunset', { zh: '日落', en: 'Sunset', ja: 'サンセット' }, {
    sky: 'orange', blue: 'amber', indigo: 'red', violet: 'rose', purple: 'rose', pink: 'amber', amber: 'amber', orange: 'red',
  }),
  make('twilight', { zh: '暮紫', en: 'Twilight', ja: 'トワイライト' }, {
    sky: 'violet', blue: 'indigo', indigo: 'indigo', violet: 'fuchsia', purple: 'fuchsia', pink: 'pink', amber: 'pink', orange: 'rose',
  }),
  make('graphite', { zh: '石墨', en: 'Graphite', ja: 'グラファイト' }, {
    sky: 'slate', blue: 'zinc', indigo: 'slate', violet: 'zinc', purple: 'zinc', pink: 'stone', amber: 'stone', orange: 'stone',
  }),
];

export const DEFAULT_ACCENT_THEME: AccentThemeId = 'classic';
const STORAGE_KEY = 'gk-accent-theme';

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
};

/** Preview swatches for the settings picker: primary / secondary / warm. */
export const themeSwatches = (theme: AccentTheme): string[] => [
  PALETTES[theme.map.sky]['500'],
  PALETTES[theme.map.purple]['500'],
  PALETTES[theme.map.amber]['500'],
];
