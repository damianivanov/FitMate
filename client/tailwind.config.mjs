/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
        danger: 'var(--color-danger)',
        panel: '#0E0E1A',
        panel2: '#131324',
        panel3: '#1A1A30',
      },
      backgroundImage: {
        shell:
          'radial-gradient(ellipse at 15% 5%, rgba(255,115,55,.10), transparent 35%), radial-gradient(ellipse at 85% 8%, rgba(88,104,245,.07), transparent 30%), radial-gradient(ellipse at 50% 100%, rgba(255,115,55,.05), transparent 40%), linear-gradient(180deg, #09091A 0%, #0E0E1A 100%)',
      },
    },
  },
  plugins: [],
}
