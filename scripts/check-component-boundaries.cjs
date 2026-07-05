#!/usr/bin/env node

/*
 * Component-boundary regression gate.
 *
 * This does not claim the component migration is finished. Instead it prevents
 * new drift beyond the current `yarn design:components` baseline:
 * - no new direct Nuxt UI `U*` usage in product code
 * - no new raw form/control elements
 * - no new ad-hoc overlays
 * - no new hand-rolled card chrome
 *
 * Escape hatch: `design-allow` on a line, or `design-allow-file` in a file.
 */

const fs = require("node:fs");
const path = require("node:path");
const { walk, isExcluded, SRC } = require("./audit-design-usage.cjs");

const root = process.cwd();
const baselinePath = path.join(root, "docs/component-audit/components.json");

if (!fs.existsSync(baselinePath)) {
  console.error("[component-boundary] Missing docs/component-audit/components.json. Run `yarn design:components` first.");
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const baselineByFile = new Map((baseline.records || []).map((record) => [record.file, record]));

const appTiers = new Set(["component", "container", "feature", "layout", "page", "shared", "shared-modal"]);

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

function sectionBetween(source, tag) {
  // Greedy: a root-level <template> may itself contain nested control-flow
  // <template v-if>/<template #slot> blocks, whose earlier closing tags a
  // non-greedy match would stop at. The real root closing tag is the last
  // </tag> in the file (verified file-wide: no SFC has stray "</template>"
  // text in its script/style sections).
  const match = source.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*)</${tag}>`, "i"));
  return match ? match[1] : source;
}

function stripAllowedLines(source) {
  return source
    .split("\n")
    .filter((line) => !line.includes("design-allow"))
    .join("\n");
}

// Dead/commented-out markup (e.g. `<!-- <UForm>...</UForm> -->`) shouldn't
// register as live usage. Leaves `design-allow` comments intact so
// stripAllowedLines' line-based filter still finds and removes them.
function stripHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (comment) =>
    comment.includes("design-allow") ? comment : "",
  );
}

function count(re, source) {
  return (source.match(re) || []).length;
}

function nuxtUiTags(template) {
  const set = new Set();
  // PascalCase (<UButton>) and kebab-case (<u-button>) both resolve to the
  // same Nuxt UI component at runtime — kebab-case must NOT match the design
  // system's own `<ui-*>` wrappers, hence the dash directly after `u`.
  for (const match of template.matchAll(/<(U[A-Z][A-Za-z0-9]*)/g)) set.add(match[1]);
  for (const match of template.matchAll(/<(u-[a-z][a-z0-9-]*)/g)) set.add(match[1]);
  return [...set].sort();
}

function signals(source) {
  const clean = stripAllowedLines(stripHtmlComments(source));
  const template = sectionBetween(clean, "template");
  const hasFixedInset = /\bfixed\b[^"'`]*\binset-0\b|\binset-0\b[^"'`]*\bfixed\b/.test(template);
  const hasZ = /\bz-(?:\d{1,4}|\[)/.test(template);
  const hasBackdrop = /backdrop-blur|bg-black\/|bg-content-on-background\/|ds-backdrop|\/\d0\b.*backdrop/.test(template);

  return {
    rawButton: count(/<button[\s>]/g, template),
    rawInput: count(/<input[\s>]/g, template),
    rawSelect: count(/<select[\s>]/g, template),
    rawTextarea: count(/<textarea[\s>]/g, template),
    rawDialog: count(/<dialog[\s>]/g, template),
    rawHeading: count(/<h[1-6][\s>]/g, template),
    overlayScaffold: hasFixedInset && hasZ && hasBackdrop,
    cardChrome: /\bborder\b/.test(template) && /rounded-\[var\(--radius-/.test(template) && /\bp[xytrbl]?-\d/.test(template),
    nuxtUi: nuxtUiTags(template),
  };
}

function baselineLimits(record) {
  const s = record?.signals || {};
  return {
    rawButton: s.rawButton || 0,
    rawInput: s.rawInput || 0,
    rawSelect: s.rawSelect || 0,
    rawTextarea: s.rawTextarea || 0,
    rawDialog: s.rawDialog || 0,
    rawHeading: s.rawHeading || 0,
    overlayScaffold: !!s.overlayScaffold,
    cardChrome: !!s.cardChrome,
    nuxtUi: new Set(record?.nuxtUi || []),
  };
}

function reportIfIncreased(violations, rel, label, current, allowed) {
  if (current > allowed) violations.push(`${rel}: new ${label} (${current}, baseline ${allowed})`);
}

const violations = [];

for (const full of walk(SRC, [])) {
  if (isExcluded(full)) continue;
  const rel = path.relative(root, full);
  const tier = tierOf(rel);
  if (!appTiers.has(tier)) continue;

  const source = fs.readFileSync(full, "utf8");
  if (source.includes("design-allow-file")) continue;

  const current = signals(source);
  const allowed = baselineLimits(baselineByFile.get(rel));

  reportIfIncreased(violations, rel, "raw <button>", current.rawButton, allowed.rawButton);
  reportIfIncreased(violations, rel, "raw <input>", current.rawInput, allowed.rawInput);
  reportIfIncreased(violations, rel, "raw <select>", current.rawSelect, allowed.rawSelect);
  reportIfIncreased(violations, rel, "raw <textarea>", current.rawTextarea, allowed.rawTextarea);
  reportIfIncreased(violations, rel, "raw <dialog>", current.rawDialog, allowed.rawDialog);
  reportIfIncreased(violations, rel, "raw <h1-6>", current.rawHeading, allowed.rawHeading);

  if (current.overlayScaffold && !allowed.overlayScaffold) {
    violations.push(`${rel}: new ad-hoc overlay scaffold`);
  }
  if (current.cardChrome && !allowed.cardChrome) {
    violations.push(`${rel}: new hand-rolled card/panel chrome`);
  }

  const newNuxtTags = current.nuxtUi.filter((tag) => !allowed.nuxtUi.has(tag));
  if (newNuxtTags.length) {
    violations.push(`${rel}: new direct Nuxt UI usage (${newNuxtTags.join(", ")})`);
  }
}

if (violations.length) {
  console.error("[component-boundary] New design-system boundary drift detected:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error("\nUse Ui* primitives/patterns, or add `design-allow` with a reason for legitimate native/editor/canvas cases.");
  process.exit(1);
}

console.log("[component-boundary] OK: no new primitive-boundary drift beyond baseline.");
