import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E6F1FB",
          100: "#B5D4F4",
          200: "#85B7EB",
          400: "#378ADD",
          500: "#1A73E8",
          600: "#185FA5",
          700: "#0D47A1",
          800: "#0C447C",
          900: "#042C53",
        },
        accent: {
          50: "#FFF3E0",
          400: "#FF6D00",
          600: "#E65100",
        },
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"', // 韩文优化
          '"Noto Sans SC"',       // 中文优化
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
