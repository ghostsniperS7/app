/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        foreground: '#09090B',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#09090B',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#09090B',
        },
        primary: {
          DEFAULT: '#18181B',
          foreground: '#FAFAFA',
        },
        secondary: {
          DEFAULT: '#F4F4F5',
          foreground: '#18181B',
        },
        muted: {
          DEFAULT: '#F4F4F5',
          foreground: '#71717A',
        },
        accent: {
          DEFAULT: '#EA580C',
          foreground: '#FAFAFA',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FAFAFA',
        },
        border: '#E4E4E7',
        input: '#E4E4E7',
        ring: '#18181B',
      },
      fontFamily: {
        heading: ['Chivo', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '2px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-from-bottom': {
          from: { transform: 'translateY(16px)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-in': 'slide-in-from-bottom 0.5s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};