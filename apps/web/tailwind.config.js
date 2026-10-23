/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'sans-serif'],
      },
      colors: {
        ink: '#1c1915',
        muted: '#5c564e',
        paper: '#f3f0e8',
        card: '#fbf8f3',
        line: '#e3d9c8',
        pine: '#27306b',
        brass: '#9a7433',
      },
    },
  },
  plugins: [],
}
