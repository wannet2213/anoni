/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "Geist Fallback", "system-ui", "sans-serif"],
        display: ["Clash Display", "Geist", "system-ui", "sans-serif"],
      },
      colors: {
        void: {
          DEFAULT: "#050505",
          50: "#0A0A0A",
          100: "#111111",
          200: "#1A1A1A",
          300: "#262626",
        },
        accent: {
          DEFAULT: "#818CF8",
          light: "#A5B4FC",
          dark: "#6366F1",
          glow: "rgba(129,140,248,0.15)",
        },
        glass: {
          border: "rgba(255,255,255,0.08)",
          fill: "rgba(255,255,255,0.03)",
          hover: "rgba(255,255,255,0.06)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      animation: {
        "fade-up": "fadeUp 0.8s cubic-bezier(0.32,0.72,0,1) forwards",
        "fade-in": "fadeIn 0.6s cubic-bezier(0.32,0.72,0,1) forwards",
        "scale-in": "scaleIn 0.5s cubic-bezier(0.32,0.72,0,1) forwards",
        "orb-pulse": "orbPulse 8s ease-in-out infinite alternate",
        shimmer: "shimmer 2s ease-in-out infinite",
        slide: "slideDown 0.5s cubic-bezier(0.32,0.72,0,1) forwards",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(4rem)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        orbPulse: {
          from: { opacity: "0.3", transform: "scale(1)" },
          to: { opacity: "0.7", transform: "scale(1.15)" },
        },
        shimmer: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-1rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32,0.72,0,1)",
        out: "cubic-bezier(0.16,1,0.3,1)",
        in: "cubic-bezier(0.4,0,1,1)",
      },
    },
  },
  plugins: [],
};
