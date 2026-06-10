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
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans]
      },
      boxShadow: {
        soft: '0 14px 40px rgba(59, 31, 18, 0.08)',
        'glow-sm': '0 0 15px rgba(249, 115, 22, 0.25)',
        'glow-md': '0 0 30px rgba(249, 115, 22, 0.35)',
        'glow-lg': '0 0 60px rgba(249, 115, 22, 0.2)',
        'card-hover': '0 20px 60px rgba(59, 31, 18, 0.15), 0 4px 16px rgba(59, 31, 18, 0.08)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.1)'
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        DEFAULT: '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '14px',
        '3xl': '16px',
        'full': '9999px'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' }
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        blob: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '25%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
          '50%': { borderRadius: '50% 60% 30% 60% / 40% 30% 70% 60%' },
          '75%': { borderRadius: '40% 50% 60% 30% / 70% 40% 50% 30%' }
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'shimmer-sweep': {
          '0%': { left: '-75%' },
          '60%, 100%': { left: '150%' }
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(249,115,22,0.5)' },
          '70%': { boxShadow: '0 0 0 14px rgba(249,115,22,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0)' }
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'float-slow': 'float 6s ease-in-out infinite',
        'float-medium': 'float 4s ease-in-out 1s infinite',
        'float-fast': 'float 3s ease-in-out 0.5s infinite',
        marquee: 'marquee 24s linear infinite',
        blob: 'blob 8s ease-in-out infinite',
        'spin-slow': 'spin-slow 12s linear infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'gradient-x': 'gradient-x 4s ease infinite'
      },
      backgroundSize: {
        '200%': '200% 200%'
      }
    }
  },
  plugins: []
};

export default config;
