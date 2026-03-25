import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gk: {
          bg:           '#07071a',
          surface:      '#0d0d24',
          'surface-2':  '#13132e',
          'surface-3':  '#1a1a38',
          purple:       '#9333ea',
          'purple-light':'#a855f7',
          common:       '#3b82f6',
          rare:         '#a855f7',
          legendary:    '#f59e0b',
          success:      '#10b981',
          error:        '#ef4444',
          muted:        '#8b8baa',
          dim:          '#4a4a6a',
        },
      },
      backgroundImage: {
        'gk-brand': 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
        'gk-swap':  'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
      },
      animation: {
        shimmer:     'shimmer 1.6s infinite linear',
        'fade-up':   'fadeUp 0.4s ease both',
        'glow-pulse':'glowPulse 2.2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-800px 0' },
          '100%': { backgroundPosition:  '800px 0' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 14px rgba(147,51,234,0.25)' },
          '50%':      { boxShadow: '0 0 32px rgba(147,51,234,0.55)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
