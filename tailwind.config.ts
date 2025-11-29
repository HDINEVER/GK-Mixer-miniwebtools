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
