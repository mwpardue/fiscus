import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        mint: "rgb(var(--color-accent) / <alpha-value>)",
        plum: "rgb(var(--color-plum) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)"
      }
    }
  },
  plugins: []
};

export default config;
