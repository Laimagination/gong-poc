import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gong: {
          purple: "#7C3AED",
          "purple-dark": "#5B21B6",
          "purple-light": "#A78BFA",
          slate: "#1E293B",
          "slate-light": "#334155",
          accent: "#06B6D4",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
