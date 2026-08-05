/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./**/*.{ts,tsx}",
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
        macaron: {
          blue: '#AEC6CF',
          green: '#77DD77',
          pink: '#FFB7B2',
          purple: '#B39EB5',
          yellow: '#FDFD96',
          gray: '#CFCFC4'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
