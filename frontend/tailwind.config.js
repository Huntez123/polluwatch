/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stone: {
          50: '#fcfcfc',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          800: '#292524',
          900: '#1c1917',
        },
        sage: {
          100: '#e3e8e1',
          500: '#8ba390',
          800: '#3d4f40',
        },
        rust: {
          500: '#c26d5c',
        },
        ochre: {
          500: '#d8a45e',
        },
        "aqi-good":      "#8ba390", // Muted Sage
        "aqi-moderate":  "#d8a45e", // Muted Ochre
        "aqi-sensitive": "#c28e5c", // Warm Copper
        "aqi-unhealthy": "#c26d5c", // Muted Rust
        "aqi-very":      "#8b6d85", // Muted Plum
        "aqi-hazardous": "#5c3a3a", // Deep Maroon
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
