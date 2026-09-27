/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['"Readex Pro"', 'Tahoma', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { DEFAULT: '#10243A', 50: '#EEF2F7', 100: '#D9E2EC', 700: '#1A3350', 800: '#142B45', 900: '#10243A', 950: '#0A1726' },
        emerald: { DEFAULT: '#10B981' },
        gold: { DEFAULT: '#D6AC59', light: '#EBD3A0', dark: '#B08A3E' },
        canvas: '#F5F7FA',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ground: 'rgb(var(--ground) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        sunk: 'rgb(var(--sunk) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,36,58,.04), 0 4px 16px -6px rgba(16,36,58,.10)',
        pop: '0 12px 40px -10px rgba(16,36,58,.35)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        sheet: { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: { rise: 'rise .35s ease-out both', fade: 'fade .2s ease-out both', sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1) both' },
    },
  },
  plugins: [],
};
