import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        paper: { DEFAULT: "#F7F1E3", 2: "#EFE5CC", 3: "#E6D9B8" },
        ink: { DEFAULT: "#1B1A16", soft: "#45413A", mute: "#7A7364", line: "#D8CCAE" },
        wheat: {
          50: "#FCF7EA",
          100: "#F6E9C6",
          200: "#EED597",
          300: "#E4BE64",
          400: "#D9A441",
          500: "#C38A25",
          600: "#A06D1B",
          700: "#7B5317",
        },
        field: { 50: "#EAF3EC", 100: "#CFE4D5", 500: "#2F6B45", 600: "#245437", 700: "#173A26" },
        alarm: { 50: "#FDECEC", 500: "#C92A2A", 600: "#A51D1D" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        paper: "0 1px 0 rgba(27,26,22,.04), 0 12px 32px -12px rgba(66,48,12,.25)",
        lift: "0 30px 60px -20px rgba(27,26,22,.45)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0) rotate(var(--r, 0deg))" },
          "50%": { transform: "translateY(-18px) rotate(calc(var(--r, 0deg) + 12deg))" },
        },
        "stamp-in": {
          "0%": { transform: "scale(2.2) rotate(-28deg)", opacity: "0" },
          "60%": { transform: "scale(.92) rotate(-12deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(-12deg)", opacity: "1" },
        },
        scan: {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        marquee: { to: { transform: "translateX(-50%)" } },
        "rise-in": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "stamp-in": "stamp-in .7s cubic-bezier(.2,.9,.3,1.2) both",
        scan: "scan 1.6s ease-in-out infinite alternate",
        "spin-slow": "spin-slow 24s linear infinite",
        marquee: "marquee 40s linear infinite",
        "rise-in": "rise-in .6s ease-out both",
      },
    },
  },
  plugins: [animate],
};

export default config;
