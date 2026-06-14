#!/usr/bin/env node

/*
 * Design-system enforcement check (`yarn design:check`).
 *
 * Fails CI / pre-commit if any product file contains a hard design-system
 * violation — raw hex, Tailwind palette class, raw black/white class, or a
 * built-in radius/shadow utility. The violation set and detection logic are
 * shared with the audit (scripts/audit-design-usage.cjs) so the two never
 * drift: what the audit tags "violation" is exactly what this blocks.
 *
 * NOT blocked (intentionally): off-grid spacing, `rounded-full`, raw `rgba()`,
 * and legacy alias tokens — these are "review" items handled during migration.
 *
 * Escape hatch: put `design-allow` in a comment on the offending line to skip
 * that one violation (e.g. a brand logo's exact hex), or `design-allow-file`
 * anywhere in the file to exempt the whole file. Use sparingly and with a why.
 *
 * Scope: every product .vue file under app/, plus the theme config and global
 * CSS, minus the audit's exclusion set (demos, debug, examples, marketing).
 */

const fs = require("node:fs");
const path = require("node:path");
const { scanViolations, walk, isExcluded, SRC } = require("./audit-design-usage.cjs");

const root = process.cwd();

// Non-.vue files that still carry design styling and must stay token-pure.
const extraFiles = ["app/app.config.ts", "app/assets/css/main.css"];

// Token-system files that must exist for the pipeline to work.
const requiredFiles = [
  "app/design-system/tokens/index.cjs",
  "app/design-system/tokens.generated.css",
  "app/design-system/tokens.generated.ts",
  "scripts/generate-design-tokens.cjs",
  "scripts/audit-design-usage.cjs",
];

const violations = [];
const missing = [];

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) missing.push(rel);
}

function lineText(source, line) {
  return source.split("\n")[line - 1] ?? "";
}

function checkSource(rel, source) {
  if (source.includes("design-allow-file")) return;
  for (const v of scanViolations(source)) {
    if (lineText(source, v.line).includes("design-allow")) continue;
    violations.push({ rel, ...v });
  }
}

// All product .vue files in scope.
for (const full of walk(SRC, [])) {
  if (isExcluded(full)) continue;
  checkSource(path.relative(root, full), fs.readFileSync(full, "utf8"));
}
// Plus the theme config + global CSS.
for (const rel of extraFiles) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) checkSource(rel, fs.readFileSync(full, "utf8"));
}

if (missing.length || violations.length) {
  console.error("Design token check failed:\n");
  for (const rel of missing) console.error(`- MISSING required file: ${rel}`);
  for (const v of violations) {
    console.error(`- ${v.rel}:${v.line}  ${v.label}: ${v.value}`);
  }
  console.error(
    `\n${violations.length} violation(s) in ${new Set(violations.map((v) => v.rel)).size} file(s).` +
      "\nReplace with design-system tokens (see docs/DESIGN_SYSTEM.md), or add a" +
      "\n`design-allow` comment on the line for a justified exception."
  );
  process.exit(1);
}

console.log("[design-check] OK: no design-system violations across product files.");
