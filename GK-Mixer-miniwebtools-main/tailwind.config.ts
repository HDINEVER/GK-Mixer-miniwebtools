import defaultColors from 'tailwindcss/colors';

// Accent families are driven by CSS variables (see utils/accentTheme.ts) so the
// accent theme can be switched at runtime. Fallbacks = original Tailwind values.
const hexToTriplet = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const ACCENT_FAMILIES = ['sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'amber', 'orange'];
const themedFamily = (family: string) =>
  Object.fromEntries(
    Object.entries((defaultColors as unknown as Record<string, Record<string, string>>)[family]).map(([shade, hex]) => [
      shade,
      `rgb(var(--ac-${family}-${shade}, ${hexToTriplet(hex)}) / <alpha-value>)`,
    ])
  );
const themedColors = Object.fromEntries(ACCENT_FAMILIES.map((f) => [f, themedFamily(f)]));
const macaronVar = (key: string, hex: string) => `rgb(var(--ac-macaron-${key}, ${hexToTriplet(hex)}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./**/*.{ts,tsx}",
    "./node_modules/konsta/**/*.{js,mjs,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        ...themedColors,
        'brand-primary': 'rgb(var(--accent-rgb, 239 83 80) / <alpha-value>)',
        'primary': 'rgb(var(--accent-rgb, 239 83 80) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb, 239 83 80) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb, 229 57 53) / <alpha-value>)',
          light: 'rgb(var(--accent-dark-text-rgb, 255 138 128) / <alpha-value>)',
          soft: 'var(--accent-soft, rgb(239 83 80 / 0.12))',
          50: 'rgb(var(--accent-rgb, 239 83 80) / 0.06)',
          100: 'rgb(var(--accent-rgb, 239 83 80) / 0.12)',
          200: 'rgb(var(--accent-rgb, 239 83 80) / 0.22)',
          300: 'rgb(var(--accent-rgb, 239 83 80) / 0.38)',
          400: 'rgb(var(--accent-dark-text-rgb, 255 138 128) / <alpha-value>)',
          500: 'rgb(var(--accent-rgb, 239 83 80) / <alpha-value>)',
          600: 'rgb(var(--accent-hover-rgb, 229 57 53) / <alpha-value>)',
          700: 'rgb(var(--accent-hover-rgb, 229 57 53) / <alpha-value>)',
        },
        // Dynamic accent alias for coral
        coral: {
          DEFAULT: 'rgb(var(--accent-rgb, 239 83 80) / <alpha-value>)',
          50: 'rgb(var(--accent-rgb, 239 83 80) / 0.06)',
          100: 'rgb(var(--accent-rgb, 239 83 80) / 0.12)',
          200: 'rgb(var(--accent-rgb, 239 83 80) / 0.22)',
          300: 'rgb(var(--accent-rgb, 239 83 80) / 0.38)',
          400: 'rgb(var(--accent-dark-text-rgb, 255 138 128) / <alpha-value>)',
          500: 'rgb(var(--accent-rgb, 239 83 80) / <alpha-value>)',
          600: 'rgb(var(--accent-hover-rgb, 229 57 53) / <alpha-value>)',
          700: 'rgb(var(--accent-hover-rgb, 229 57 53) / <alpha-value>)',
        },
        macaron: {
          blue: macaronVar('blue', '#AEC6CF'),
          green: '#77DD77',
          pink: macaronVar('pink', '#FFB7B2'),
          purple: macaronVar('purple', '#B39EB5'),
          yellow: '#FDFD96',
          gray: '#CFCFC4'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        ios: [
          '-apple-system', 'SF Pro Text', 'SF UI Text', 'system-ui', 'Helvetica Neue',
          'Helvetica', 'Arial', 'sans-serif'
        ],
        material: ['Roboto', 'system-ui', 'Noto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
    },
  },
  plugins: [],
};
