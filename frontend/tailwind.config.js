/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.08)",
        glow: "0 0 0 6px rgba(99,102,241,.12)",
      },
      colors: {
        gray: {
          850: "#1f2937",
          900: "#111827",
          950: "#030712",
        },
        dark: {
          ...{
            bg: "#050505",
            card: "#121212",
            border: "#262626",
          },
          50: "#f8f9fa",
          100: "#e9ecef",
          200: "#dee2e6",
          300: "#ced4da",
          400: "#adb5bd",
          500: "#6c757d",
          600: "#495057",
          700: "#343a40",
          800: "#212529",
          900: "#0d1117",
          950: "#010409",
        },
        primary: {
          500: "#3B82F6",
          600: "#2563EB",
        },
        accent: {
          glow: "rgba(59, 130, 246, 0.5)",
        },
        hpBlue: "#0C5CF4",
        hpGray: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          700: "#374151",
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        breathe: "breathe 6s ease-in-out infinite",
        wave: "wave 1.5s ease-in-out infinite",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
        },
        wave: {
          "0%, 100%": { height: "10%" },
          "50%": { height: "100%" },
        },
      },
    },
  },
  plugins: [],
};
