import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-foreground))' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      boxShadow: {
        soft: '0 8px 24px -18px rgba(15, 23, 42, 0.32)',
        banking: '0 16px 40px -28px rgba(15, 23, 42, 0.42)',
        lift: '0 20px 50px -30px rgba(15, 23, 42, 0.48)',
      },
      keyframes: {
        'page-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'modal-in': { from: { opacity: '0', transform: 'translateY(14px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'float-slow': { '0%, 100%': { transform: 'translate3d(0, 0, 0)' }, '50%': { transform: 'translate3d(0, -8px, 0)' } },
        'success-pop': { '0%': { opacity: '0', transform: 'scale(0.75)' }, '65%': { opacity: '1', transform: 'scale(1.08)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'gradient-flow': { '0%, 100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'route-progress': { from: { transform: 'translateX(-110%)' }, to: { transform: 'translateX(220%)' } },
        'row-in': { from: { opacity: '0', transform: 'translateY(5px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'success-check': { '0%': { opacity: '0', transform: 'scale(0.7)' }, '70%': { opacity: '1', transform: 'scale(1.08)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'page-in': 'page-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'modal-in': 'modal-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'success-pop': 'success-pop 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 2.2s linear infinite',
        'gradient-flow': 'gradient-flow 7s ease infinite',
        'route-progress': 'route-progress 900ms cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'row-in': 'row-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'success-check': 'success-check 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
