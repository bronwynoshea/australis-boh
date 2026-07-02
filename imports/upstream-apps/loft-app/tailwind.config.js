/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      colors: {
        cafe: '#2563eb',
        journey: '#7e22ce',
        coach: '#f59e0b',
        mentor: '#800020',
        dna: '#14b8a6',
        'brand-cafe': '#2563eb',
        'brand-journey': '#7e22ce',
        'brand-coach': '#f59e0b',
        'brand-coach-dark': '#34d399',
        'brand-mentor': '#800020',
        'brand-dna': '#14b8a6',
        'brand-bg-light': '#F3F1FA',
        'brand-bg-dark': '#1B163C',
        'loft-purple': '#1B163C',
        'heading-dark': '#60A5FA',
        'heading-light': '#1E2555',
      },
      padding: {
        'safe': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.pb-safe': {
          'padding-bottom': 'env(safe-area-inset-bottom)',
        },
        '.pt-safe': {
          'padding-top': 'env(safe-area-inset-top)',
        },
        '.pl-safe': {
          'padding-left': 'env(safe-area-inset-left)',
        },
        '.pr-safe': {
          'padding-right': 'env(safe-area-inset-right)',
        },
      });
    }
  ],
};
