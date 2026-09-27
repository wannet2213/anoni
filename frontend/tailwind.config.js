/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        accent: {
          DEFAULT: "#4F46E5",
          light: "#4338CA",
          dark: "#3730A3",
          glow: "#E0E7FF",
        },
      },
    },
  },
  plugins: [],
};
