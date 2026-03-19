/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        amber: { DEFAULT: '#f59e0b', dark: '#d97706' }
      }
    }
  },
  plugins: []
}
