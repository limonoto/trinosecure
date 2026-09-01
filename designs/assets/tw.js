/* Shared Tailwind CDN config — load right after the Tailwind CDN script.
   Token names mirror shadcn/ui so markup ports cleanly to Next.js + shadcn. */
tailwind.config = {
  darkMode: 'class',
  theme: {
    container: { center: true, padding: '2rem' },
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: { DEFAULT: 'hsl(var(--primary) / <alpha-value>)', foreground: 'hsl(var(--primary-foreground) / <alpha-value>)' },
        secondary: { DEFAULT: 'hsl(var(--secondary) / <alpha-value>)', foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'hsl(var(--muted) / <alpha-value>)', foreground: 'hsl(var(--muted-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'hsl(var(--accent) / <alpha-value>)', foreground: 'hsl(var(--accent-foreground) / <alpha-value>)' },
        card: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground) / <alpha-value>)' },
        popover: { DEFAULT: 'hsl(var(--popover) / <alpha-value>)', foreground: 'hsl(var(--popover-foreground) / <alpha-value>)' },
        destructive: { DEFAULT: 'hsl(var(--destructive) / <alpha-value>)', foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)' },
        success: { DEFAULT: 'hsl(var(--success) / <alpha-value>)', foreground: 'hsl(var(--success-foreground) / <alpha-value>)' },
        warning: { DEFAULT: 'hsl(var(--warning) / <alpha-value>)', foreground: 'hsl(var(--warning-foreground) / <alpha-value>)' },
        info: { DEFAULT: 'hsl(var(--info) / <alpha-value>)', foreground: 'hsl(var(--info-foreground) / <alpha-value>)' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        xs: '0 1px 2px 0 hsl(var(--shadow-color) / 0.06)',
        sm: '0 1px 3px 0 hsl(var(--shadow-color) / 0.10), 0 1px 2px -1px hsl(var(--shadow-color) / 0.10)',
        md: '0 4px 12px -2px hsl(var(--shadow-color) / 0.14), 0 2px 6px -2px hsl(var(--shadow-color) / 0.10)',
        lg: '0 12px 28px -6px hsl(var(--shadow-color) / 0.22), 0 6px 12px -6px hsl(var(--shadow-color) / 0.14)',
        drawer: '-16px 0 40px -12px hsl(var(--shadow-color) / 0.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateY(8px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-in-right': 'slide-in-right .26s cubic-bezier(.32,.72,0,1)',
        'scale-in': 'scale-in .16s ease-out',
        'toast-in': 'toast-in .22s cubic-bezier(.32,.72,0,1)',
      },
    },
  },
};
