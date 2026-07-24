const rootTokens = [
  { name: "--ui-container", value: "var(--container-8xl)", external: true },
  { name: "--ui-primary", value: "var(--color-primary)", external: true },
  { name: "--ui-bg", value: "var(--color-background)", external: true },
  {
    name: "--ui-bg-muted",
    value: "var(--color-surface-subtle)",
    external: true,
  },
  {
    name: "--ui-bg-accented",
    value: "var(--color-surface-strong)",
    external: true,
  },
  {
    name: "--ui-text",
    value: "var(--color-content-on-background)",
    external: true,
  },
  {
    name: "--ui-text-muted",
    value: "var(--color-content-secondary)",
    external: true,
  },
  { name: "--ui-border", value: "var(--color-secondary)", external: true },
  {
    name: "--ds-brand-gradient",
    value:
      "linear-gradient(90deg, rgb(49 165 217) 0%, rgb(248 54 145) 46%, rgb(255 184 0) 100%)",
  },
  { name: "--ds-focus-outline-color", value: "var(--color-primary)" },
  { name: "--ds-focus-outline-on-primary", value: "#606771" },
  { name: "--ds-backdrop-strong", value: "rgb(2 6 23 / 0.8)" },
  { name: "--ds-backdrop-dim", value: "rgb(0 0 0 / 0.4)" },
  { name: "--ds-sheet-scrim", value: "rgb(2 6 23 / 0.45)" },
  { name: "--ds-surface-card", value: "var(--color-white)" },
  {
    name: "--ds-gradient-fab",
    value: "linear-gradient(135deg, #051a39, #173b6c)",
  },
  {
    name: "--ds-gradient-due",
    value: "linear-gradient(150deg, #051a39, #173b6c)",
  },
  { name: "--component-card-radius", value: "var(--radius-lg)" },
  { name: "--component-card-padding-xs", value: "var(--space-1)" },
  { name: "--component-card-padding-sm", value: "var(--space-2)" },
  { name: "--component-card-padding-md", value: "var(--space-3)" },
  { name: "--component-card-padding-lg", value: "var(--space-4)" },
  {
    name: "--component-card-padding-xl",
    value: "calc(var(--space-4) + var(--space-1))",
  },
  { name: "--component-toast-shadow", value: "var(--shadow-modal)" },
  { name: "--component-drawer-shadow", value: "var(--shadow-dropdown)" },
];

const darkTokens = [
  { name: "--ds-surface-card", value: "var(--color-surface)" },
  { name: "--ds-focus-outline-on-primary", value: "#4b5563" },
];

module.exports = { rootTokens, darkTokens };
