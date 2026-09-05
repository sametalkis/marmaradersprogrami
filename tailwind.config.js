/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        marmara: {
          blue: '#1e40af',
          lightblue: '#3b82f6',
          red: '#dc2626'
        },
        // Vurgu rengi: index.css'teki [data-accent] bloklarından gelir.
        // <html data-accent="..."> tüm accent-* sınıflarını anında değiştirir.
        accent: {
          DEFAULT: ({ opacityValue }) =>
            opacityValue
              ? `rgb(var(--accent-500) / ${opacityValue})`
              : 'rgb(var(--accent-500))',
          ...Object.fromEntries(
            [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [
              s,
              `rgb(var(--accent-${s}) / <alpha-value>)`,
            ])
          ),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
