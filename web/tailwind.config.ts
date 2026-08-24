import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#4B4FD1",
          soft: "#E7E7FB",
        },
        status: {
          todo: "#8A8FA6",
          progress: "#2E7BD6",
          done: "#2E9E6D",
          risk: "#D6482F",
        },
      },
    },
  },
  plugins: [],
};

export default config;
