import type { Config } from "tailwindcss";

/**
 * Design tokens — "the notebook, after dark".
 * The approved notebook identity (paper, ink, ballpoint blue) carried into
 * a dark, cinematic universe. Every colour is a CSS variable in globals.css
 * so the signature accent can be swapped in one place.
 */
export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "rgb(var(--void) / <alpha-value>)",
        hull: "rgb(var(--hull) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        dust: "rgb(var(--dust) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        signal: "rgb(var(--signal) / <alpha-value>)",
        "signal-hi": "rgb(var(--signal-hi) / <alpha-value>)",
        alarm: "rgb(var(--alarm) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Fluid display scale, clamp(min, preferred, max)
        "d-1": ["clamp(3.25rem, 11.5vw, 13rem)", { lineHeight: "0.9", letterSpacing: "-0.012em" }],
        "d-2": ["clamp(2.5rem, 7vw, 7.5rem)", { lineHeight: "0.92", letterSpacing: "-0.015em" }],
        "d-3": ["clamp(1.9rem, 4vw, 3.75rem)", { lineHeight: "0.98", letterSpacing: "-0.025em" }],
        micro: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.18em" }],
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-quart": "cubic-bezier(0.76, 0, 0.24, 1)",
      },
      animation: {
        blink: "blink 1.1s steps(2, start) infinite",
        marquee: "marquee var(--duration, 40s) linear infinite",
      },
      keyframes: {
        blink: { to: { visibility: "hidden" } },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-50% - var(--gap, 0px) / 2))" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
