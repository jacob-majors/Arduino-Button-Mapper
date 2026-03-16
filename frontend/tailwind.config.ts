import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "pulse-border": "pulse-border 1.5s ease-in-out infinite",
      },
      keyframes: {
        "pulse-border": {
          "0%, 100%": { borderColor: "rgb(59 130 246)" },
          "50%": { borderColor: "rgb(168 85 247)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
