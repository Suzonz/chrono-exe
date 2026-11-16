import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["var(--font-pixel)", "ui-monospace", "monospace"],
        read: ["var(--font-read)", "ui-monospace", "monospace"]
      },
      colors: {
        background: "#15121b",
        surface: "#15121b",
        "surface-dim": "#15121b",
        "surface-container-lowest": "#100d16",
        "surface-container-low": "#1d1a24",
        "surface-container": "#221e28",
        "surface-container-high": "#2c2833",
        "surface-container-highest": "#37333e",
        "surface-bright": "#3c3742",
        "surface-variant": "#37333e",
        outline: "#958da1",
        "outline-variant": "#4a4455",
        primary: "#d2bbff",
        "primary-container": "#7c3aed",
        "primary-fixed": "#eaddff",
        "primary-fixed-dim": "#d2bbff",
        "on-primary": "#3f008e",
        "on-primary-container": "#ede0ff",
        "on-primary-fixed": "#25005a",
        "inverse-primary": "#732ee4",
        secondary: "#ffffff",
        "secondary-container": "#15ffd1",
        "secondary-fixed": "#15ffd1",
        "secondary-fixed-dim": "#00e0b7",
        "on-secondary": "#00382c",
        "on-secondary-container": "#00725c",
        "on-secondary-fixed": "#002019",
        tertiary: "#ffb784",
        "tertiary-container": "#a15100",
        "tertiary-fixed": "#ffdcc6",
        "tertiary-fixed-dim": "#ffb784",
        "on-tertiary": "#4f2500",
        "on-tertiary-container": "#ffe0cd",
        "on-tertiary-fixed": "#301400",
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        "on-background": "#e8dfee",
        "on-surface": "#e8dfee",
        "on-surface-variant": "#ccc3d8",
        "inverse-surface": "#e8dfee",
        "inverse-on-surface": "#332f39"
      },
      borderRadius: {
        DEFAULT: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px"
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "widget-gutter": "12px",
        "container-margin": "20px",
        unit: "4px"
      },
      fontSize: {
        "ui-small": ["8px", { lineHeight: "10px", letterSpacing: "0em" }],
        label: ["10px", { lineHeight: "12px", letterSpacing: "0.05em" }],
        body: ["12px", { lineHeight: "20px", letterSpacing: "0.02em" }],
        /** VT323 sizes (readable sentences / lists). */
        read: ["20px", { lineHeight: "24px" }],
        "read-sm": ["17px", { lineHeight: "20px" }],
        h2: ["18px", { lineHeight: "24px", letterSpacing: "0em" }],
        h1: ["24px", { lineHeight: "32px", letterSpacing: "-0.05em" }]
      }
    }
  },
  plugins: []
};

export default config;
