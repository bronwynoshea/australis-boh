/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./imports/upstream-apps/slotz-app/src/**/*.{js,ts,jsx,tsx}",
    "./imports/upstream-apps/loft-app/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'boh-primary': 'var(--boh-primary)',
        'loft-purple': '#1B163C',
        'boh-bg': 'var(--boh-bg)',
        'boh-surface': 'var(--boh-surface)',
        'boh-border': 'var(--boh-border)',
        'boh-text': 'var(--boh-text)',
        'boh-text-sub': 'var(--boh-text-sub)',
        'boh-primary-tint': 'var(--boh-primary-tint)',
        'brand-bg-light': 'var(--brand-bg-light)',
        'brand-bg-dark': 'var(--brand-bg-dark)',
        'boh-bg-light': 'var(--boh-bg-light)',
        'boh-surface-light': 'var(--boh-surface-light)',
        'boh-border-light': 'var(--boh-border-light)',
        'boh-text-light': 'var(--boh-text-light)',
        'boh-text-sub-light': 'var(--boh-text-sub-light)',
        'brand-cafe': 'var(--brand-cafe)',
        'brand-journey': 'var(--brand-journey)',
        'brand-coach': 'var(--brand-coach)',
        'brand-mentor': 'var(--brand-mentor)',
        'brand-dna': 'var(--brand-dna)',
        'heading-dark': 'var(--heading-dark)',
        'heading-light': 'var(--heading-light)',
        // Primary alias for Counter accent
        'primary': 'var(--boh-primary)',
        // Brand colors for app-specific accents
        'brand-boh': 'var(--boh-primary)',
        'brand-careerstudio': 'var(--career-studio-purple)',
        'brand-talent': 'var(--talent-blue)',
        'brand-other': '#6B7280',
        'primary-dark': '#5146b8',
        'primary-light': '#f4f2ff',
        'primary-border': '#e8e6ff',
        'primary-text-muted': '#5a557d',
        darkbg: '#151024',
        darkcard: '#201936',
      },
    },
  },
  plugins: [],
};


