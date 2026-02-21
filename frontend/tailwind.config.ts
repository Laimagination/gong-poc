import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          0: "#FFFFFF",
          1: "#F8FAFC",
          2: "#F1F5F9",
          3: "#E2E8F0",
          4: "#CBD5E1",
        },
        gong: {
          purple: "#235FF6",
          "purple-dark": "#1A4BD4",
          "purple-light": "#5B8AF9",
          "purple-glow": "#235FF622",
          slate: "#F8FAFC",
          "slate-light": "#F1F5F9",
          accent: "#06B6D4",
          "accent-light": "#0891B2",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          gold: "#D4A843",
        },
        border: {
          DEFAULT: "rgba(0,0,0,0.08)",
          subtle: "rgba(0,0,0,0.04)",
          strong: "rgba(0,0,0,0.15)",
        },
        text: {
          primary: "#0F172A",
          secondary: "#475569",
          muted: "#94A3B8",
          inverse: "#FFFFFF",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-gong": "linear-gradient(135deg, #235FF6 0%, #06B6D4 100%)",
        "gradient-gong-subtle": "linear-gradient(135deg, rgba(35,95,246,0.08) 0%, rgba(6,182,212,0.08) 100%)",
        "gradient-surface": "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(35,95,246,0.1)",
        "glow-lg": "0 0 40px rgba(35,95,246,0.15)",
        "glow-accent": "0 0 20px rgba(6,182,212,0.1)",
        glass: "0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
        card: "0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "slide-in-left": "slideInLeft 0.4s ease-out forwards",
        shimmer: "shimmer 2s infinite linear",
        pulse_glow: "pulseGlow 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(35,95,246,0.06)" },
          "50%": { boxShadow: "0 0 30px rgba(35,95,246,0.12)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
