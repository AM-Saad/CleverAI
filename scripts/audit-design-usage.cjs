#!/usr/bin/env node

/*
 * Design-system usage audit.
 *
 * Scans every product `.vue` file and extracts the design-relevant values it
 * uses (color / spacing / radius / shadow / typography), tagging each as:
 *   - ok       : already a design-system token utility or token CSS var
 *   - violation: raw value the design system forbids (hex, palette class,
 *                built-in radius/shadow) — must be migrated
 *   - review   : off-grid spacing, arbitrary value, or rounded-full — needs a
 *                human decision
 *   - legacy   : a legacy alias token that should be retired after migration
 *
 * Outputs (docs/design-audit/):
 *   - audit.json   machine-readable per-file records
 *   - audit.md     human map: one section per file, every value + tag
 *   - summary.md   rollups + distinct raw-value histogram (drives Phase 2)
 *
 * Read-only. Run with: yarn design:audit
 */

const fs = require("node:fs");
const path = require("node:path");
const { themeTokens } = require("../app/design-system/tokens/index.cjs");

const root = process.cwd();
const SRC = path.join(root, "app");
const OUT_DIR = path.join(root, "docs", "design-audit");

// Files/areas excluded from the audit (Phase 0 scope freeze): legacy snapshots,
// demos, debug, examples, and marketing — they are not the live product UI.
const EXCLUDE = [
  /\.old\.vue$/,
  /\.refactored\.vue$/,
  /\/pages\/demo\//,
  /\/pages\/debug.*\.vue$/,
  /\/components\/debug\//,
  /\/components\/examples\//,
  /\/components\/landing\//,
];

// ---------------------------------------------------------------------------
// Token vocabulary derived from the token source (stays in sync automatically).
// ---------------------------------------------------------------------------
const colorTokenNames = themeTokens
  .filter((t) => t.name.startsWith("--color-"))
  .map((t) => t.name.replace("--color-", ""));

// hex value -> token name(s), to suggest a migration target for each raw hex.
const hexToToken = {};
for (const t of themeTokens) {
  if (t.name.startsWith("--color-") && /^#[0-9a-fA-F]{3,8}$/.test(t.value)) {
    const hex = t.value.toLowerCase();
    const name = t.name.replace("--color-", "");
    (hexToToken[hex] ||= []).push(name);
  }
}
function expandHex(hex) {
  const h = hex.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(h)) {
    return "#" + h.slice(1).split("").map((c) => c + c).join("");
  }
  return h;
}

const colorUtilPrefixes =
  "bg|text|border|ring|divide|fill|stroke|placeholder|caret|from|via|to|outline|decoration|accent";

// On-grid spacing steps the design system allows (4px grid subset).
const GRID_STEPS = new Set(["0", "px", "0.5", "1", "2", "3", "4", "6", "8", "10", "12", "16", "20", "24", "px"]);
// DESIGN.md core grid; values outside flagged as review.
const CORE_GRID = new Set(["0", "px", "1", "2", "3", "4", "6", "8", "12", "16"]);

// ---------------------------------------------------------------------------
// Detectors. Each returns {value, category, status, suggest?}.
// ---------------------------------------------------------------------------
const PALETTES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RE = {
  hex: /#[0-9a-fA-F]{3,8}\b/g,
  colorFn: /\b(?:rgba?|hsla?)\([^)]*\)/g,
  paletteClass: new RegExp(
    `\\b(?:${colorUtilPrefixes})-(?:${PALETTES})(?:-\\d{1,3})?(?:\\/\\d{1,3})?\\b`,
    "g"
  ),
  blackWhiteClass: new RegExp(`\\b(?:${colorUtilPrefixes})-(?:black|white)(?:\\/\\d{1,3})?\\b`, "g"),
  tokenColorClass: new RegExp(
    `\\b(?:${colorUtilPrefixes})-(?:${colorTokenNames.join("|")})(?:\\/\\d{1,3})?\\b`,
    "g"
  ),
  colorVar: /var\(--(?:color|ui|ds|syntax)-[a-z0-9-]+\)/g,
  // Bare `rounded` and built-in sizes, but NOT `rounded-full` (allowed pill) or
  // `rounded-[var(...)]` (token). The trailing (?!-) stops the bare-`rounded`
  // alternative from matching the `rounded` inside `rounded-full`/`rounded-[`.
  builtinRadius: /\brounded(?:-(?:sm|md|lg|xl|2xl|3xl))?\b(?!-)/g,
  roundedFull: /\brounded-full\b/g,
  arbitraryRadiusRaw: /\brounded(?:-[a-z]+)?-\[(?!var\(--radius-)[^\]]+\]/g,
  tokenRadius: /\brounded(?:-[a-z]+)?-\[var\(--(?:radius|component)-[a-z0-9-]+\)\]/g,
  builtinShadow: /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/g,
  tokenShadow: /\bshadow-\[var\(--(?:shadow|component)-[a-z0-9-]+\)\]/g,
  spacingUtil: /\b(?:p|m|gap|space-[xy])[trblxy]?-(\d+(?:\.\d+)?|px)\b/g,
  arbitrarySpacing: /\b[pmg](?:[trblxy]|ap)?-\[[^\]]+\]/g,
  spaceVar: /var\(--space-\d+\)/g,
  legacySpaceVar: /var\(--(?:spacing|padding|margin)-(?:xs|sm|md|lg|xl|2xl)\)/g,
  textSize: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g,
  fontWeight: /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
  leadingTracking: /\b(?:leading|tracking)-(?:tight|tighter|snug|normal|relaxed|loose|wide|wider|widest|none)\b/g,
};

function uniqCount(matches) {
  const m = new Map();
  for (const v of matches) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].map(([value, count]) => ({ value, count }));
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

// Blank out valid token references (var(--…), token utility classes, and bare
// `--token` identifiers) length-preservingly, so indices still map to source
// lines. Used so palette-name substrings inside token names aren't flagged.
function maskTokenRefs(source) {
  let scratch = source;
  for (const v of new Set([
    ...(source.match(RE.colorVar) || []),
    ...(source.match(RE.tokenColorClass) || []),
  ])) {
    scratch = scratch.split(v).join(" ".repeat(v.length));
  }
  return scratch.replace(/--[a-z][a-z0-9-]*/g, (m) => " ".repeat(m.length));
}

// Line-tracked hard violations only (hex / palette / built-in radius & shadow) —
// the exact set the audit tags "violation". Excludes review (rgba, rounded-full,
// off-grid spacing) and legacy aliases. Shared by `yarn design:check`.
function scanViolations(source) {
  const out = [];
  const masked = maskTokenRefs(source);
  const run = (re, target, category, label) => {
    for (const m of target.matchAll(re)) {
      out.push({ category, value: m[0], line: lineOf(target, m.index ?? 0), label });
    }
  };
  run(RE.hex, masked, "color", "raw hex");
  run(RE.paletteClass, masked, "color", "palette class");
  run(RE.blackWhiteClass, masked, "color", "raw black/white class");
  run(RE.builtinRadius, source, "radius", "built-in radius");
  run(RE.arbitraryRadiusRaw, source, "radius", "arbitrary radius");
  run(RE.builtinShadow, source, "shadow", "built-in shadow");
  return out;
}

function analyze(source) {
  const findings = [];
  const push = (value, category, status, suggest) =>
    findings.push({ value, category, status, ...(suggest ? { suggest } : {}) });

  // note() appends a per-file ×count so audit.md stays informative, while the
  // suggest token text itself stays clean for the histogram rollup.
  const note = (text, count) => (count > 1 ? `${text} ×${count}` : text);

  // Colors — ok (record first, then mask so token references aren't re-flagged
  // as raw violations — e.g. `var(--color-accent-purple)` contains the substring
  // `accent-purple`, and `color-mix(... var(--syntax-string) ...)` contains a
  // `rgb`-free token. Masking makes color detection non-overlapping.)
  const okColorClasses = source.match(RE.tokenColorClass) || [];
  const colorVars = source.match(RE.colorVar) || [];
  for (const { value, count } of uniqCount(okColorClasses)) {
    push(value, "color", "ok", note("", count));
  }
  for (const { value, count } of uniqCount(colorVars)) {
    push(value, "color", "ok", note("", count));
  }
  let scratch = source;
  for (const v of new Set([...colorVars, ...okColorClasses])) {
    scratch = scratch.split(v).join(" ".repeat(v.length));
  }
  // Also blank every CSS custom-property identifier (`--color-accent-blue`,
  // `--syntax-string`, ...) wherever it appears — including bare JS token keys
  // like designTokenValues["--color-accent-blue"]. Raw color violations never
  // start with `--`, so this only removes legitimate token references.
  scratch = scratch.replace(/--[a-z][a-z0-9-]*/g, (m) => " ".repeat(m.length));

  // Colors — violations (scanned on the masked copy)
  for (const { value, count } of uniqCount(scratch.match(RE.hex) || [])) {
    const full = expandHex(value);
    const token = hexToToken[full] ? hexToToken[full].join(" / ") : "";
    push(value, "color", "violation", note(token || "no exact token", count));
  }
  for (const { value, count } of uniqCount((scratch.match(RE.colorFn) || []))) {
    push(value, "color", "review", note("raw color fn", count));
  }
  for (const { value, count } of uniqCount(scratch.match(RE.paletteClass) || [])) {
    push(value, "color", "violation", note("palette class", count));
  }
  for (const { value, count } of uniqCount(scratch.match(RE.blackWhiteClass) || [])) {
    push(value, "color", "violation", note("use surface/content token", count));
  }

  // Radius
  for (const { value, count } of uniqCount(source.match(RE.builtinRadius) || [])) {
    push(value, "radius", "violation", note("use rounded-[var(--radius-*)]", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.arbitraryRadiusRaw) || [])) {
    push(value, "radius", "violation", note("arbitrary radius", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.roundedFull) || [])) {
    push(value, "radius", "review", note("pill — avatars/dots only", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.tokenRadius) || [])) {
    push(value, "radius", "ok", note("", count));
  }

  // Shadow
  for (const { value, count } of uniqCount(source.match(RE.builtinShadow) || [])) {
    push(value, "shadow", "violation", note("use shadow-[var(--shadow-*)]", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.tokenShadow) || [])) {
    push(value, "shadow", "ok", note("", count));
  }

  // Spacing
  let m;
  const spacingSeen = new Map();
  RE.spacingUtil.lastIndex = 0;
  while ((m = RE.spacingUtil.exec(source))) {
    const step = m[1];
    const key = m[0];
    spacingSeen.set(key, { step, count: (spacingSeen.get(key)?.count || 0) + 1 });
  }
  for (const [value, { step, count }] of spacingSeen) {
    const status = CORE_GRID.has(step) ? "ok" : "review";
    push(value, "spacing", status, status === "ok" ? note("", count) : note("off-grid", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.arbitrarySpacing) || [])) {
    push(value, "spacing", "review", note("arbitrary spacing", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.spaceVar) || [])) {
    push(value, "spacing", "ok", note("", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.legacySpaceVar) || [])) {
    push(value, "spacing", "legacy", note("legacy alias", count));
  }

  // Typography (recorded for role mapping; not violations on their own)
  for (const { value, count } of uniqCount(source.match(RE.textSize) || [])) {
    push(value, "typography", "ok", note("size", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.fontWeight) || [])) {
    push(value, "typography", "ok", note("weight", count));
  }
  for (const { value, count } of uniqCount(source.match(RE.leadingTracking) || [])) {
    push(value, "typography", "ok", note("", count));
  }

  // Typography component adoption: raw tags vs Ui* wrappers
  const rawHeadings = (source.match(/<h[1-6][\s>]/g) || []).length;
  const rawParagraphs = (source.match(/<p[\s>]/g) || []).length;
  const rawLabels = (source.match(/<label[\s>]/g) || []).length;
  const uiTypo =
    (source.match(/<Ui(?:Title|Subtitle|Paragraph|Label)\b/g) || []).length;

  return {
    findings,
    typography: { rawHeadings, rawParagraphs, rawLabels, uiTypo },
  };
}

// ---------------------------------------------------------------------------
// Walk files
// ---------------------------------------------------------------------------
function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith(".vue")) acc.push(full);
  }
  return acc;
}

// True for files outside the enforced scope (legacy snapshots, demos, debug,
// examples, marketing). Accepts an absolute or repo-relative path.
function isExcluded(file) {
  const rel = path.isAbsolute(file) ? path.relative(root, file) : file;
  return EXCLUDE.some((re) => re.test("/" + rel));
}

// Reusable across this script and scripts/check-design-tokens.cjs.
module.exports = { analyze, scanViolations, walk, isExcluded, SRC, root, RE };

// Everything below only runs when invoked directly (`yarn design:audit`),
// not when required as a module by the enforcement check.
if (require.main !== module) return;

const allFiles = walk(SRC, []);
const files = allFiles.filter((f) => !isExcluded(f));
const excludedCount = allFiles.length - files.length;

const records = [];
for (const full of files) {
  const rel = path.relative(root, full);
  const source = fs.readFileSync(full, "utf8");
  const { findings, typography } = analyze(source);
  const counts = { ok: 0, violation: 0, review: 0, legacy: 0 };
  for (const f of findings) counts[f.status]++;
  records.push({ file: rel, counts, typography, findings });
}

records.sort(
  (a, b) =>
    b.counts.violation - a.counts.violation ||
    b.counts.review - a.counts.review ||
    a.file.localeCompare(b.file)
);

// ---------------------------------------------------------------------------
// Rollups
// ---------------------------------------------------------------------------
const totals = { ok: 0, violation: 0, review: 0, legacy: 0 };
const byCategory = {};
const rawHistogram = new Map(); // raw value -> {count, files:Set, suggest}
let filesWithViolations = 0;

for (const r of records) {
  if (r.counts.violation) filesWithViolations++;
  for (const f of r.findings) {
    totals[f.status]++;
    byCategory[f.category] ||= { ok: 0, violation: 0, review: 0, legacy: 0 };
    byCategory[f.category][f.status]++;
    if (f.status === "violation") {
      const key = f.value;
      const entry = rawHistogram.get(key) || { count: 0, files: new Set(), category: f.category };
      entry.count++;
      entry.files.add(r.file);
      rawHistogram.set(key, entry);
    }
  }
}

// Derive a clean migration suggestion from the raw value itself.
function suggestFor(value, category) {
  const hex = value.match(/^#[0-9a-fA-F]{3,8}$/);
  if (hex) {
    const mapped = hexToToken[expandHex(value)];
    return mapped ? mapped.join(" / ") : "(no exact token — decide)";
  }
  if (category === "radius") return "rounded-[var(--radius-*)]";
  if (category === "shadow") return "shadow-[var(--shadow-*)]";
  if (/^(?:bg|text|border|ring|from|via|to|fill|stroke|divide)-(?:black|white)/.test(value))
    return "surface / content token";
  return "semantic color token";
}

const histogram = [...rawHistogram.entries()]
  .map(([value, e]) => ({
    value,
    occurrences: e.count,
    files: e.files.size,
    suggest: suggestFor(value, e.category),
  }))
  .sort((a, b) => b.files - a.files || b.occurrences - a.occurrences);

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.writeFileSync(
  path.join(OUT_DIR, "audit.json"),
  JSON.stringify(
    {
      generatedFrom: "scripts/audit-design-usage.cjs",
      scanned: files.length,
      excluded: excludedCount,
      totals,
      byCategory,
      records,
    },
    null,
    2
  )
);

// summary.md
const sLines = [];
sLines.push("# Design Audit — Summary\n");
sLines.push("> Generated by `yarn design:audit`. Do not edit by hand.\n");
sLines.push(`- Files scanned: **${files.length}** (excluded ${excludedCount} demo/debug/legacy/marketing)`);
sLines.push(`- Files with violations: **${filesWithViolations}**`);
sLines.push(
  `- Findings: **${totals.violation} violation**, ${totals.review} review, ${totals.legacy} legacy, ${totals.ok} ok\n`
);
sLines.push("## By category\n");
sLines.push("| Category | violation | review | legacy | ok |");
sLines.push("|---|---|---|---|---|");
for (const [cat, c] of Object.entries(byCategory)) {
  sLines.push(`| ${cat} | ${c.violation} | ${c.review} | ${c.legacy} | ${c.ok} |`);
}
sLines.push("\n## Top offender files (by violation count)\n");
sLines.push("| File | violations | review |");
sLines.push("|---|---|---|");
for (const r of records.filter((r) => r.counts.violation).slice(0, 30)) {
  sLines.push(`| ${r.file} | ${r.counts.violation} | ${r.counts.review} |`);
}
sLines.push("\n## Distinct raw values (migration targets)\n");
sLines.push("Sorted by how many files use them. `suggest` = candidate token.\n");
sLines.push("| Raw value | files | occurrences | suggested token |");
sLines.push("|---|---|---|---|");
for (const h of histogram) {
  sLines.push(`| \`${h.value}\` | ${h.files} | ${h.occurrences} | ${h.suggest || "—"} |`);
}
fs.writeFileSync(path.join(OUT_DIR, "summary.md"), sLines.join("\n") + "\n");

// audit.md — full per-file map
const aLines = [];
aLines.push("# Design Audit — Component → Value Map\n");
aLines.push("> Generated by `yarn design:audit`. One section per file.\n");
aLines.push("Status legend: ✅ ok · ❌ violation · ⚠️ review · 🕒 legacy\n");
const STATUS_ICON = { ok: "✅", violation: "❌", review: "⚠️", legacy: "🕒" };
for (const r of records) {
  const t = r.typography;
  const flag = r.counts.violation ? "❌" : r.counts.review ? "⚠️" : "✅";
  aLines.push(`\n## ${flag} ${r.file}`);
  aLines.push(
    `_violation ${r.counts.violation} · review ${r.counts.review} · legacy ${r.counts.legacy} · ok ${r.counts.ok}_ · ` +
      `typo: ${t.uiTypo} Ui* / raw h${t.rawHeadings} p${t.rawParagraphs} label${t.rawLabels}`
  );
  if (!r.findings.length) {
    aLines.push("\n_no design values detected_");
    continue;
  }
  aLines.push("\n| | category | value | note |");
  aLines.push("|---|---|---|---|");
  for (const f of r.findings) {
    aLines.push(`| ${STATUS_ICON[f.status]} | ${f.category} | \`${f.value}\` | ${f.suggest || ""} |`);
  }
}
fs.writeFileSync(path.join(OUT_DIR, "audit.md"), aLines.join("\n") + "\n");

console.log(
  `[design-audit] scanned ${files.length} files (excluded ${excludedCount}). ` +
    `violations=${totals.violation} review=${totals.review} legacy=${totals.legacy} ` +
    `across ${filesWithViolations} files.`
);
console.log(`[design-audit] wrote docs/design-audit/{audit.json,audit.md,summary.md}`);
