import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--color-surface)",
          card: "var(--color-surface-card)",
          lift: "var(--color-surface-lift)",
          input: "var(--color-surface-input)"
        },
        muted: "var(--color-muted)",
        ink: {
          DEFAULT: "var(--color-ink)",
          secondary: "var(--color-ink-secondary)"
        },
        gold: {
          DEFAULT: "var(--color-gold)",
          bright: "var(--color-gold-bright)",
          dim: "var(--color-gold-dim)"
        }
      },
      boxShadow: {
        gold: "var(--shadow-gold)"
      }
    }
  },
  plugins: []
};

export default config;

