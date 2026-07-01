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
  // Garantuje generování těchto tříd i když jsou poprvé použity jen v MapMenuStrip
  // nebo v dynamicky sestavených fieldStyles stringách v lib/themes/*.ts
  safelist: [
    "sm:hidden", "sm:flex",
    // auction field — všechny varianty přes témata
    "border-amber-400", "bg-amber-800", "text-amber-200",
    "border-amber-500", "bg-amber-200", "text-amber-900",
    "border-amber-600", "bg-amber-300", "text-amber-950",
  ],
  plugins: [],
} satisfies Config;
