import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cellar: {
          ink: '#05070F',
          navy: '#0B1020',
          surface: '#151B34',
          mulberry: '#532845',
          purple: '#635CCD',
          lavender: '#B18CFF',
          text: '#F7F8FC',
          muted: '#A3A5B8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        cellar: '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
