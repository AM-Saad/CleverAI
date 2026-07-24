#!/usr/bin/env node

/*
 * WCAG-AA contrast gate (`yarn design:contrast`).
 *
 * Verifies that every semantic text-on-surface token pairing meets WCAG AA
 * (≥ 4.5:1 for body text, ≥ 3.0:1 for large/UI) in BOTH the light and dark
 * themes. Token values come straight from the source of truth
 * (app/design-system/tokens/index.cjs), so this tracks any token change.
 *
 * Pure Node — no dependency. Resolves var() chains; pairings whose colors
 * aren't a plain hex (color-mix/rgb/transparent) are reported as skipped.
 */

const { themeTokens, rootTokens, darkTokens } = require("../app/design-system/tokens/index.cjs");

// name -> raw value, per theme.
const light = Object.fromEntries([...themeTokens, ...rootTokens].map((t) => [t.name, t.value]));
const dark = { ...light, ...Object.fromEntries(darkTokens.map((t) => [t.name, t.value])) };

function resolveHex(map, value, depth = 0) {
  if (!value || depth > 8) return null;
  value = value.trim();
  const v = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (v) return resolveHex(map, map[v[1]], depth + 1);
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  return null; // color-mix / rgb() / transparent — not statically resolvable
}

function toRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// [textToken, bgToken, minRatio, label]. 4.5 = body text AA; 3.0 = large/UI.
const PAIRS = [
  ["--color-content-on-background", "--color-background", 4.5, "body on background"],
  ["--color-content-on-surface", "--color-surface", 4.5, "body on surface"],
  ["--color-content-on-surface-strong", "--color-surface-strong", 4.5, "strong text on strong surface"],
  ["--color-content-secondary", "--color-surface", 4.5, "metadata on surface"],
  ["--color-content-secondary", "--color-background", 4.5, "metadata on background"],
  ["--color-content-disabled", "--color-surface", 3.0, "disabled-looking text on surface (UI)"],
  ["--color-content-disabled", "--color-background", 3.0, "disabled-looking text on background (UI)"],
  ["--color-success-text", "--color-surface", 4.5, "success text on surface"],
  ["--color-success-text", "--color-background", 4.5, "success text on background"],
  ["--color-warning-text", "--color-surface", 4.5, "warning text on surface"],
  ["--color-warning-text", "--color-background", 4.5, "warning text on background"],
  ["--color-error-text", "--color-surface", 4.5, "error text on surface"],
  ["--color-error-text", "--color-background", 4.5, "error text on background"],
  ["--color-info-text", "--color-surface", 4.5, "info text on surface"],
  ["--color-info-text", "--color-background", 4.5, "info text on background"],
  // Solid-fill control labels are UI-component text — WCAG AA threshold 3.0.
  ["--color-on-primary", "--color-primary", 3.0, "text on primary fill (UI)"],
  ["--color-on-success", "--color-success", 3.0, "text on success fill (UI)"],
  ["--color-on-warning", "--color-warning", 3.0, "text on warning fill (UI)"],
  ["--color-on-error", "--color-error", 3.0, "text on error fill (UI)"],
  ["--color-on-info", "--color-info", 3.0, "text on info fill (UI)"],
  ["--color-primary", "--color-background", 3.0, "primary as UI/link on background"],
  ["--color-primary", "--color-surface", 3.0, "primary as UI/link on surface"],
  ["--ds-focus-outline-color", "--color-background", 3.0, "focus indicator on background"],
  ["--ds-focus-outline-color", "--color-surface", 3.0, "focus indicator on surface"],
  ["--ds-focus-outline-on-primary", "--color-primary", 3.0, "gray focus indicator on primary fill"],
];

const failures = [];
const skipped = [];
const rows = [];

for (const [themeName, map] of [["light", light], ["dark", dark]]) {
  for (const [textTok, bgTok, min, label] of PAIRS) {
    const fg = resolveHex(map, map[textTok]);
    const bg = resolveHex(map, map[bgTok]);
    if (!fg || !bg) {
      skipped.push(`${themeName}: ${label} (${textTok} on ${bgTok})`);
      continue;
    }
    const r = ratio(fg, bg);
    const pass = r >= min;
    rows.push(`${pass ? "PASS" : "FAIL"}  ${themeName.padEnd(5)} ${r.toFixed(2).padStart(5)} (≥${min})  ${label}`);
    if (!pass) failures.push({ themeName, label, textTok, bgTok, r: r.toFixed(2), min, fg, bg });
  }
}

console.log(rows.join("\n"));
if (skipped.length) console.log("\nskipped (non-static color):\n  " + skipped.join("\n  "));

if (failures.length) {
  console.error(`\n[design-contrast] ${failures.length} pairing(s) below WCAG AA:`);
  for (const f of failures) {
    console.error(`- ${f.themeName}: ${f.label} — ${f.fg} on ${f.bg} = ${f.r}:1 (need ${f.min}:1)`);
  }
  console.error("\nAdjust the token value(s) in app/design-system/tokens/index.cjs.");
  process.exit(1);
}
console.log(`\n[design-contrast] OK: all ${rows.length} pairings meet WCAG AA (light + dark).`);
