import konstaConfig from 'konsta/config';
import defaultColors from 'tailwindcss/colors';

// Accent families are driven by CSS variables (see utils/accentTheme.ts) so the
// accent theme can be switched at runtime. Fallbacks = original Tailwind values.
const hexToTriplet = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const ACCENT_FAMILIES = ['sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'amber', 'orange'];
const themedFamily = (family) =>
  Object.fromEntries(
    Object.entries(defaultColors[family]).map(([shade, hex]) => [
      shade,
      `rgb(var(--ac-${family}-${shade}, ${hexToTriplet(hex)}) / <alpha-value>)`,
    ])
  );
const themedColors = Object.fromEntries(ACCENT_FAMILIES.map((f) => [f, themedFamily(f)]));
const macaronVar = (key, hex) => `rgb(var(--ac-macaron-${key}, ${hexToTriplet(hex)}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default konstaConfig({
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
        'brand-primary': themedColors.sky['600'],
        'primary': themedColors.sky['600'],
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
});
