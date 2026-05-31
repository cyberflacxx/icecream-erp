import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF7E8',
        vanilla: '#FFE8B8',
        orange: '#F97316',
        deepOrange: '#C2410C',
        brown: '#3B1F12',
        chocolate: '#5A2E1B',
        cocoa: '#7C3F22',
        border: '#F3D7B6',
        success: '#16A34A',
        warning: '#F59E0B',
        error: '#DC2626',
        textDark: '#1F130D',
        muted: '#6B4A3A',
        darkBg: '#1A0D07',
        darkCard: '#2C1509',
        darkBorder: '#4A2010',
        darkText: '#FFE8B8',
        darkMuted: '#C9956A',
        tableHeaderDark: '#3B1F12',
        tableHoverDark: '#2C1509'
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans]
      },
      boxShadow: {
        soft: '0 14px 40px rgba(59, 31, 18, 0.08)'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: []
};

export default config;
