import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tailwind config — derived from `docs/design/design-system.yml`.
 * 値は CSS 変数 (src/styles/tokens.css) を介して読み込む二重バインディング。
 * 直接 hex を書くのは禁止。新しいトークンは design-system.yml に追加してから本ファイルに反映する。
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        '2xl': '1280px',
      },
    },
    // design-system.yml responsive.breakpoints
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // semantic tokens (light/dark via CSS vars in tokens.css)
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          hover: 'hsl(var(--primary-hover) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          soft: 'hsl(var(--accent-soft) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      // design-system.yml borders.radius
      borderRadius: {
        none: '0',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        full: '9999px',
        DEFAULT: '8px',
      },
      // design-system.yml typography
      fontFamily: {
        heading: ['var(--font-heading)', 'var(--font-jp)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'var(--font-jp)', 'system-ui', 'sans-serif'],
        jp: ['var(--font-jp)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // headings (h1-h4)
        h1: ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['2rem', { lineHeight: '1.25', fontWeight: '600' }],
        h3: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        h4: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        // body
        xs: ['0.75rem', { lineHeight: '1.6' }],
        sm: ['0.875rem', { lineHeight: '1.6' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.6' }],
      },
      // design-system.yml spacing
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
      // design-system.yml shadows
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        md: '0 4px 8px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
        lg: '0 12px 24px -8px rgba(15, 23, 42, 0.08), 0 4px 8px -4px rgba(15, 23, 42, 0.04)',
        xl: '0 24px 48px -12px rgba(15, 23, 42, 0.12)',
        inner: 'inset 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
      },
      // design-system.yml motion.duration / easing
      transitionDuration: {
        instant: '100ms',
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.16, 1, 0.3, 1)',
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
