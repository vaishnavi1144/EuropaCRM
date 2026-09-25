import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#E4ECF3',
        input: '#E4ECF3',
        ring: '#009E92',
        background: '#F7FAFC',
        foreground: '#071B4A',
        primary: {
          DEFAULT: '#009E92',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: '#F7FAFC',
          foreground: '#667085',
        },
        accent: {
          DEFAULT: '#D9F5F1',
          foreground: '#009E92',
        },
        navy: {
          DEFAULT: '#071B4A',
          foreground: '#ffffff',
        },
        mint: {
          DEFAULT: '#D9F5F1',
          foreground: '#009E92',
        },
      },
      boxShadow: {
        card: '0 2px 10px rgba(16, 24, 40, 0.055)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
