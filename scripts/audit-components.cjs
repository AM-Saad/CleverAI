#!/usr/bin/env node

/*
 * Component-system inventory & duplication audit (`yarn design:components`).
 *
 * One layer above the token audit: instead of raw values, it maps the COMPONENT
 * layer — what tier each .vue belongs to, whether it bypasses the primitive set
 * (raw <button>/<dialog>/<input>, ad-hoc modal overlays, hand-rolled card chrome,
 * direct Nuxt UI usage in feature code), and which duplication clusters exist.
 *
 * Outputs (docs/component-audit/):
 *   - components.json   machine-readable per-component records
 *   - components.md     per-tier map: primitives used + bypass flags + props
 *   - duplication.md    clusters of likely-duplicate components + candidates
 *
 * Read-only. Shares file walking + exclusion set with the token audit so the
 * two stay consistent.
 */

const fs = require("node:fs");
const path = require("node:path");
const { walk, isExcluded, SRC } = require("./audit-design-usage.cjs");

const root = process.cwd();
const OUT_DIR = path.join(root, "docs", "component-audit");

// ---------------------------------------------------------------------------
// Tier classification by location.
// ---------------------------------------------------------------------------
function tierOf(rel) {
  if (/\/components\/ui\//.test(rel)) return "primitive";
  if (/\/components\/patterns\//.test(rel)) return "pattern";
  if (/\/components\/icons\//.test(rel)) return "icon";
  if (/\/features\/[^/]+\/containers\//.test(rel)) return "container";
  if (/\/features\/[^/]+\/components\//.test(rel)) return "feature";
  if (/\/components\/shared\//.test(rel)) return "shared";
  if (/\/components\/modals\//.test(rel)) return "shared-modal";
  if (/\/pages\//.test(rel)) return "page";
  if (/\/layouts\//.test(rel)) return "layout";
  if (/\/components\//.test(rel)) return "component";
  return "other";
}

// Nuxt-style auto-import name: PascalCase of the path segments under components/.
function componentName(rel) {
  return path.basename(rel, ".vue");
}

// ---------------------------------------------------------------------------
// Signal detectors (run over the whole SFC source).
// ---------------------------------------------------------------------------
const COUNT = (re, s) => (s.match(re) || []).length;

function detectSignals(src, template) {
  const rawButton = COUNT(/<button[\s>]/g, template);
  const rawDialog = COUNT(/<dialog[\s>]/g, template);
  const rawInput = COUNT(/<input[\s>]/g, template);
  const rawLabel = COUNT(/<label[\s>]/g, template);
  const rawSelect = COUNT(/<select[\s>]/g, template);

  // Ad-hoc modal overlay: a fixed full-bleed layer with z-index + a backdrop.
  const hasFixedInset = /\bfixed\b[^"'`]*\binset-0\b|\binset-0\b[^"'`]*\bfixed\b/.test(template);
  const hasZ = /\bz-(?:\d{1,3}|\[)/.test(template);
  const hasBackdrop =
    /backdrop-blur|bg-black\/|bg-content-on-background\/|ds-backdrop|\/\d0\b.*backdrop/.test(template);
  const overlayScaffold = hasFixedInset && hasZ && hasBackdrop;

  // Hand-rolled card chrome: a border + tokenized radius + padding on styling —
  // the shape UiCard exists to provide.
  const cardChrome =
    /\bborder\b/.test(template) &&
    /rounded-\[var\(--radius-/.test(template) &&
    /\bp[xytrbl]?-\d/.test(template);

  return {
    rawButton,
    rawDialog,
    rawInput,
    rawLabel,
    rawSelect,
    overlayScaffold,
    cardChrome,
  };
}

// Nuxt UI primitives used directly (e.g. <UButton>, <UModal>). PascalCase tags.
function nuxtUiTags(template) {
  const set = new Set();
  for (const m of template.matchAll(/<(U[A-Z][A-Za-z0-9]*)/g)) set.add(m[1]);
  return [...set].sort();
}

// Ui* design-system primitives used (PascalCase <UiX> and kebab <ui-x>).
function uiPrimitiveTags(template) {
  const set = new Set();
  for (const m of template.matchAll(/<(Ui[A-Z][A-Za-z0-9]*)/g)) set.add(m[1]);
  for (const m of template.matchAll(/<(ui-[a-z][a-z0-9-]*)/g)) set.add(m[1]);
  return [...set].sort();
}

// Best-effort prop names from defineProps<{...}>() / withDefaults(defineProps<{}>).
function extractProps(script) {
  const m = script.match(/defineProps<\{([\s\S]*?)\}>\s*\(/);
  if (!m) return [];
  const body = m[1];
  const names = [];
  for (const line of body.split("\n")) {
    const pm = line.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/);
    if (pm) names.push(pm[1]);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Duplication clustering by name + structural signal.
// ---------------------------------------------------------------------------
const CLUSTER_RULES = [
  { key: "modal/dialog/drawer", name: /modal|dialog|drawer|slideover|sheet|overlay|popup/i, signal: (s) => s.overlayScaffold || s.rawDialog > 0 },
  { key: "icon/toolbar button", name: /toolbar.*button|icon.*button|button$/i },
  { key: "pill/chip/badge/tag", name: /pill|chip|badge|tag(?!iptap)/i },
  { key: "card/panel", name: /card|panel/i, signal: (s) => s.cardChrome },
  { key: "input/form field", name: /input|field|textarea|select|form(?!at)/i, signal: (s) => s.rawInput > 0 || s.rawSelect > 0 },
  { key: "empty-state", name: /empty|no-?results|placeholder/i },
  { key: "skeleton/loading", name: /skeleton|loading|loader|spinner|shimmer/i },
];

function clustersOf(name, signals) {
  const out = [];
  for (const rule of CLUSTER_RULES) {
    if (rule.name.test(name) || (rule.signal && rule.signal(signals))) out.push(rule.key);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build records.
// ---------------------------------------------------------------------------
function sectionBetween(src, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = src.match(re);
  return m ? m[1] : "";
}

const files = walk(SRC, []).filter((f) => !isExcluded(f));
const records = [];

for (const full of files) {
  const rel = path.relative(root, full);
  const src = fs.readFileSync(full, "utf8");
  const template = sectionBetween(src, "template") || src;
  const script = src;
  const name = componentName(rel);
  const tier = tierOf(rel);
  const signals = detectSignals(src, template);
  const nuxtUi = nuxtUiTags(template);
  const uiPrimitives = uiPrimitiveTags(template);
  const props = extractProps(script);

  // Bypass = a feature/page/shared file reinventing what a primitive provides.
  const isAppCode = ["feature", "container", "shared", "shared-modal", "page", "layout", "component"].includes(tier);
  const bypass = [];
  if (signals.rawButton) bypass.push(`raw <button> ×${signals.rawButton}`);
  if (signals.rawInput) bypass.push(`raw <input> ×${signals.rawInput}`);
  if (signals.rawDialog) bypass.push(`raw <dialog> ×${signals.rawDialog}`);
  if (signals.overlayScaffold) bypass.push("ad-hoc overlay");
  if (signals.cardChrome) bypass.push("hand-rolled card chrome");
  if (isAppCode && nuxtUi.length) bypass.push(`direct Nuxt UI: ${nuxtUi.join(",")}`);

  records.push({
    file: rel,
    name,
    tier,
    props,
    nuxtUi,
    uiPrimitives,
    signals,
    bypass,
    clusters: clustersOf(name, signals),
    isAppCode,
  });
}

records.sort((a, b) => a.tier.localeCompare(b.tier) || a.file.localeCompare(b.file));

// ---------------------------------------------------------------------------
// Rollups
// ---------------------------------------------------------------------------
const byTier = {};
for (const r of records) (byTier[r.tier] ||= []).push(r);

const clusterMembers = {};
for (const r of records) for (const c of r.clusters) (clusterMembers[c] ||= []).push(r);

// Same component name living in 2+ locations — usually a stale duplicate from
// the components/<feature>/ → features/<feature>/components/ migration. The most
// actionable consolidation: pick the canonical copy and delete/redirect the rest.
// Routes (pages/layouts) legitimately share names like `index` — only compare
// actual components.
const byName = {};
for (const r of records) {
  if (r.tier === "page" || r.tier === "layout") continue;
  (byName[r.name] ||= []).push(r);
}
const dupeNames = Object.entries(byName)
  .filter(([, rs]) => rs.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

const bypassFiles = records.filter((r) => r.bypass.length);
const directNuxtUi = records.filter((r) => r.isAppCode && r.nuxtUi.length);

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.writeFileSync(
  path.join(OUT_DIR, "components.json"),
  JSON.stringify(
    {
      generatedFrom: "scripts/audit-components.cjs",
      total: records.length,
      tiers: Object.fromEntries(Object.entries(byTier).map(([t, rs]) => [t, rs.length])),
      bypassCount: bypassFiles.length,
      records,
    },
    null,
    2
  )
);

// components.md — per-tier inventory
const c = [];
c.push("# Component Inventory\n");
c.push("> Generated by `yarn design:components`. Do not edit by hand.\n");
c.push(`- Components: **${records.length}** across ${Object.keys(byTier).length} tiers`);
c.push(`- Files with a primitive-bypass signal: **${bypassFiles.length}**`);
c.push(`- App-code files using Nuxt UI \`U*\` directly: **${directNuxtUi.length}**\n`);
c.push("Tiers: " + Object.entries(byTier).map(([t, rs]) => `${t} (${rs.length})`).join(" · ") + "\n");
for (const [tier, rs] of Object.entries(byTier)) {
  c.push(`\n## ${tier} (${rs.length})\n`);
  c.push("| Component | uses Ui* | uses U* | bypass signals | props |");
  c.push("|---|---|---|---|---|");
  for (const r of rs) {
    c.push(
      `| \`${r.name}\` | ${r.uiPrimitives.join(" ") || "—"} | ${r.nuxtUi.join(" ") || "—"} | ${r.bypass.join("; ") || "✅"} | ${r.props.slice(0, 8).join(", ") || "—"} |`
    );
  }
}
fs.writeFileSync(path.join(OUT_DIR, "components.md"), c.join("\n") + "\n");

// duplication.md — clusters
const d = [];
d.push("# Component Duplication & Consolidation Candidates\n");
d.push("> Generated by `yarn design:components`. Heuristic clustering by name + structure.\n");
d.push("Each cluster lists components that likely reimplement the same pattern. The");
d.push("target primitive is the consolidation candidate (see docs/COMPONENT_SYSTEM.md).\n");

d.push(`## ⚠️ Duplicate component names — ${dupeNames.length} (resolve location first)\n`);
d.push("Same name in multiple files — usually a stale `components/<feature>/` copy");
d.push("paralleling the canonical `features/<feature>/components/`. Pick one, delete the rest.\n");
if (dupeNames.length) {
  d.push("| Name | locations |");
  d.push("|---|---|");
  for (const [n, rs] of dupeNames) d.push(`| \`${n}\` | ${rs.map((r) => r.file).join("<br>")} |`);
} else {
  d.push("_none_");
}
d.push("");
const TARGET = {
  "modal/dialog/drawer": "UiModal / UiConfirmDialog / UiDrawer",
  "icon/toolbar button": "UiButton / UiIconButton",
  "pill/chip/badge/tag": "UiBadge / UiChip",
  "card/panel": "UiCard",
  "input/form field": "UiFormField (label+error+UInput)",
  "empty-state": "UiEmptyState",
  "skeleton/loading": "UiSkeleton",
};
for (const [cluster, rs] of Object.entries(clusterMembers).sort((a, b) => b[1].length - a[1].length)) {
  d.push(`\n## ${cluster} — ${rs.length} components → \`${TARGET[cluster] || "?"}\`\n`);
  d.push("| Component | tier | signals |");
  d.push("|---|---|---|");
  for (const r of rs.sort((a, b) => a.tier.localeCompare(b.tier))) {
    const sig = [
      r.signals.overlayScaffold && "overlay",
      r.signals.cardChrome && "card-chrome",
      r.signals.rawButton && `btn×${r.signals.rawButton}`,
      r.signals.rawInput && `input×${r.signals.rawInput}`,
    ].filter(Boolean).join(", ");
    d.push(`| \`${r.name}\` | ${r.tier} | ${sig || "—"} |`);
  }
}
fs.writeFileSync(path.join(OUT_DIR, "duplication.md"), d.join("\n") + "\n");

console.log(
  `[design-components] ${records.length} components · ${bypassFiles.length} with bypass signals · ` +
    `${Object.keys(clusterMembers).length} duplication clusters.`
);
console.log("[design-components] wrote docs/component-audit/{components.json,components.md,duplication.md}");
