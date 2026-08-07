const themeTokens = [
  {
    name: "--font-sans",
    value: '"Saira", sans-serif',
    comment: "Primary UI font",
  },
  { name: "--radius-sm", value: "0.125rem", comment: "2px" },
  { name: "--radius-md", value: "0.25rem", comment: "4px" },
  { name: "--radius-lg", value: "0.375rem", comment: "6px" },
  { name: "--radius-xl", value: "0.5rem", comment: "8px" },
  { name: "--radius-2xl", value: "0.75rem", comment: "12px" },
  { name: "--radius-full", value: "9999px", comment: "Pills and circles" },
  { name: "--tracking-tighter", value: "-0.04em" },
  { name: "--tracking-tight", value: "-0.025em" },
  { name: "--tracking-normal", value: "0em" },
  { name: "--tracking-wide", value: "0.025em" },
  {
    name: "--font-size-caption",
    value: "0.8125rem",
    comment: "Metadata and captions",
  },
  { name: "--leading-tight", value: "1.25" },
  { name: "--leading-snug", value: "1.375" },
  { name: "--leading-normal", value: "1.5" },
  { name: "--leading-relaxed", value: "1.625" },
  {
    name: "--shadow-card",
    value: "0 1px 3px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)",
    comment: "Resting card elevation",
  },
  { name: "--shadow-card-hover", value: "0 8px 30px rgb(0 0 0 / 0.08)" },
  { name: "--shadow-dropdown", value: "0 4px 16px rgb(0 0 0 / 0.12)" },
  { name: "--shadow-modal", value: "0 20px 60px rgb(0 0 0 / 0.15)" },
  {
    name: "--shadow-primary-glow",
    value:
      "0 4px 12px color-mix(in srgb, var(--color-primary) 25%, transparent)",
  },
  {
    name: "--shadow-sheet",
    value: "0 -10px 40px rgb(0 0 0 / 0.2)",
    comment: "Bottom-sheet elevation",
  },
  { name: "--duration-fast", value: "120ms", comment: "Small state changes" },
  {
    name: "--duration-normal",
    value: "200ms",
    comment: "Default interaction motion",
  },
  {
    name: "--duration-slow",
    value: "320ms",
    comment: "Overlays and larger transitions",
  },
  {
    name: "--duration-spring",
    value: "420ms",
    comment: "Springy size/position changes",
  },
  {
    name: "--ease-standard",
    value: "cubic-bezier(0.2, 0, 0, 1)",
    comment: "Default easing",
  },
  {
    name: "--ease-emphasized",
    value: "cubic-bezier(0.2, 0, 0, 1.2)",
    comment: "Small emphasized entrance",
  },
  {
    name: "--ease-exit",
    // The other curves here are all decelerations: ~75% of the travel lands in
    // the first quarter of the duration. That is right for an entrance, and
    // wrong for a collapse — the surrounding content snaps most of the way and
    // then crawls. This one spreads the movement evenly with both ends eased,
    // so leaving elements and the layout they release move at one steady rate.
    value: "cubic-bezier(0.4, 0, 0.2, 1)",
    comment: "Collapse and dismissal — evenly paced, no snap",
  },
  {
    name: "--ease-spring",
    value: "cubic-bezier(0.32, 1.4, 0.45, 1)",
    comment: "Gentle overshoot",
  },
  {
    name: "--target-min",
    value: "1.5rem",
    comment: "WCAG 2.2 minimum target size",
  },
  { name: "--target-compact", value: "2rem", comment: "Compact controls" },
  {
    name: "--target-touch",
    value: "2.75rem",
    comment: "Preferred touch controls",
  },
  { name: "--z-drawer", value: "40" },
  { name: "--z-modal", value: "50" },
  { name: "--z-popover", value: "60" },
  { name: "--z-toast", value: "70" },
  { name: "--z-tooltip", value: "80" },
  { name: "--space-1", value: "0.25rem", comment: "4px" },
  { name: "--space-2", value: "0.5rem", comment: "8px" },
  { name: "--space-3", value: "0.75rem", comment: "12px" },
  { name: "--space-4", value: "1rem", comment: "16px" },
  { name: "--space-6", value: "1.5rem", comment: "24px" },
  { name: "--space-8", value: "2rem", comment: "32px" },
  { name: "--space-12", value: "3rem", comment: "48px" },
  { name: "--space-16", value: "4rem", comment: "64px" },
];

/* Plain `:root` variables rather than `@theme` entries.
 *
 * These are complete CSS values, not scale steps — Tailwind derives utilities
 * from recognised `@theme` namespaces (--color-*, --shadow-*, --ease-*, ...),
 * and there is no utility to generate from a gradient. Authoring them here
 * keeps them out of the utility surface while still governing the value. */
/* Two tokens rather than one parameterised template, deliberately.
 *
 * `linear-gradient(to var(--dir), ... black var(--end) ...)` authored here does
 * NOT pick up per-element overrides of `--dir`/`--end`: a custom property's
 * `var()`s resolve at computed-value time on the element that *declares* it, so
 * a `:root` template bakes in `:root`'s parameters and descendants inherit the
 * already-substituted result. Verified in-browser, not assumed.
 *
 * The two values are also genuinely different shapes, not drift — see each. */
const rootTokens = [
  {
    name: "--mask-fade-y",
    // A custom property can hold a whole gradient, so the fade is one token
    // instead of four stops repeated per consumer. Asymmetric on purpose:
    // `to top` puts 0% at the bottom, so this fades 18% at the bottom and only
    // 8% at the top — a scrolling pane hides its overflow without dimming the
    // first line of text. Apply to `mask-image` and `-webkit-mask-image` both.
    value:
      "linear-gradient(to top, transparent 0%, black 18%, black 92%, transparent 100%)",
    comment: "Vertical scroll-fade for scrollable panes (18% bottom, 8% top)",
  },
  {
    name: "--mask-fade-x",
    // Symmetric 18% at each end: a horizontally scrolling strip has no leading
    // edge to protect, so both sides fade equally.
    value:
      "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)",
    comment: "Horizontal edge fade for scrolling strips (18% both ends)",
  },
  {
    name: "--mask-fade-bottom",
    // Trailing edge only — the top stays solid. For clamped content where the
    // fade means "this is cut off, there is more", rather than the scroll fade
    // above where it means "this pane scrolls". Same 18% fade distance so the
    // two read as the same family.
    value: "linear-gradient(to bottom, black 0%, black 82%, transparent 100%)",
    comment: "Bottom-only fade for clamped/truncated content (18% tail)",
  },
];

module.exports = { themeTokens, rootTokens };
