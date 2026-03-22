import type { Config } from "tailwindcss";

// const config: Config = {
//   content: [
//     "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
//     "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
//     "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
//   ],
//   theme: {
//     extend: {
//       colors: {
//         background: "var(--background)",
//         foreground: "var(--foreground)",
//       },
//     },
//   },
//   plugins: [],
// };

// apps/web/tailwind.config.ts
const config = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'trust-blue':     'var(--color-bg)',
        'sidebar-bg':     'var(--color-sidebar)',
        'sidebar-alt':    'var(--color-sidebar-alt)',
        'accent-cyan':    '#25d1f4',
        'app-text':       'var(--color-text-primary)',
        'app-text-muted': 'var(--color-text-secondary)',
        'app-border':     'var(--color-border)',
        'app-card':       'var(--color-card)',
        'app-card-border':'var(--color-card-border)',
      },
      opacity: {
        '2': '0.02',
        '3': '0.03',
        '8': '0.08',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
};
export default config;
