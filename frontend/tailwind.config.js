/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.08)",
        glow: "0 0 0 6px rgba(99,102,241,.12)",
      },
      colors: {
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
    },
  },
  plugins: [],
};
