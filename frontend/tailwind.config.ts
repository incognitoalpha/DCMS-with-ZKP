import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#fbf7f0",
          100: "#f5ecd9",
          200: "#ecdcb8",
          300: "#dcc38a",
        },
        forest: {
          50: "#eef5ee",
          100: "#cfe1cf",
          400: "#5a8a5d",
          500: "#3f7244",
          600: "#2f5a36",
          700: "#234628",
          800: "#1a341e",
        },
        wood: {
          400: "#a87c52",
          500: "#8a5e36",
          600: "#6e4827",
          700: "#523319",
        },
        bark: "#3a2a1a",
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", "serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(58, 42, 26, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
