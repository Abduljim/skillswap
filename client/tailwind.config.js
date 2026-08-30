/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f6f8',
          100: '#e6eaef',
          200: '#c9d2dd',
          300: '#9daebf',
          400: '#6b8299',
          500: '#4a6280',
          600: '#374c66',
          700: '#2b3c52',
          800: '#1e2b3c',
          900: '#121c29',
          950: '#0a1119',
        },
        cream: {
          50: '#fdfaf5',
          100: '#faf4ea',
          200: '#f2e7d2',
          300: '#e6d3b0',
          400: '#d9ba85',
        },
        coral: {
          50: '#fff4f1',
          100: '#ffe5de',
          200: '#ffc7b8',
          300: '#ff9d87',
          400: '#ff6f52',
          500: '#f94b28',
          600: '#e33412',
          700: '#bc2609',
        },
        mint: {
          50: '#f0faf5',
          100: '#dbf2e5',
          200: '#b9e4cd',
          300: '#8bcfad',
          400: '#5cb58c',
          500: '#3b9a71',
        },
        lavender: {
          50: '#f6f5fb',
          100: '#eeecf7',
          200: '#dcd9ef',
          300: '#c1b9e2',
          400: '#a394d2',
          500: '#8672c1',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 12px -2px rgb(18 28 41 / 0.08), 0 1px 3px rgb(18 28 41 / 0.05)',
        lift: '0 12px 32px -8px rgb(18 28 41 / 0.16)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'draw-line': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'draw-line': 'draw-line 0.6s ease-out both',
        float: 'float 5s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
