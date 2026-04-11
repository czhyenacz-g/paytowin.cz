import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Theme soubory musí být zahrnuty, jinak JIT nevidí jejich Tailwind třídy
    "./lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
