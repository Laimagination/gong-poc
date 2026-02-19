import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        surface: {
          0: "#06080F",
          1: "#0C1017",
          2: "#12161F",
          3: "#1A1F2E",
          4: "#242938",
        },
        gong: {
          purple: "#7C3AED",
          "purple-dark": "#5B21B6",
          "purple-light": "#A78BFA",
          "purple-glow": "#7C3AED33",
          slate: "#0C1017",
          "slate-light": "#1A1F2E",
          accent: "#06B6D4",
          "accent-light": "#67E8F9",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          gold: "#D4A843",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          subtle: "rgba(255,255,255,0.04)",
          strong: "rgba(255,255,255,0.12)",
        },
        text: {
          primary: "#F1F5F9",
          secondary: "#94A3B8",
          muted: "#64748B",
          inverse: "#0C1017",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-gong": "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)",
        "gradient-gong-subtle": "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.15) 100%)",
        "gradient-surface": "linear-gradient(180deg, #12161F 0%, #0C1017 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(124,58,237,0.15)",
        "glow-lg": "0 0 40px rgba(124,58,237,0.2)",
        "glow-accent": "0 0 20px rgba(6,182,212,0.15)",
        glass: "0 4px 30px rgba(0,0,0,0.3)",
        card: "0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.2)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3)",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(124,58,237,0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(124,58,237,0.25)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
