#!/usr/bin/env node

/*
 * Interactive-state enforcement (`yarn design:states`).
 *
 * Keeps high-risk states consistent after migration:
 *   - focus rings use the opaque design-system focus token
 *   - pressed button feedback uses the canonical subtle scale
 *   - disabled opacity uses one readable convention
 *
 * Scope matches the design audit: product `.vue` files under app/, plus the
 * Nuxt UI theme config and state helper primitives. Demo/debug/marketing files
 * are intentionally excluded by the shared audit exclusions.
 *
 * Escape hatch: add `design-allow` to a line, or `design-allow-file` anywhere
 * in a file, only for a documented third-party/editor exception.
 */

const fs = require("node:fs");
const path = require("node:path");
const { walk, isExcluded, SRC } = require("./audit-design-usage.cjs");

const root = process.cwd();
const extraFiles = ["app/app.config.ts", "app/components/ui/variants.ts"];
const failures = [];

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function lineText(source, line) {
  return source.split("\n")[line - 1] ?? "";
}

function cleanBang(token) {
  return token.endsWith("!") ? token.slice(0, -1) : token;
}

function after(token, marker) {
  return token.slice(token.indexOf(marker) + marker.length);
}

function isAllowedFocusRing(token, sourceLine) {
  const suffix = cleanBang(after(token, ":ring-"));

  // Width/inset utilities are allowed; the actual visible color must be the DS
  // token below.
  if (suffix === "2") return true;
  if (suffix === "inset") return true;
  if (suffix === "0" && token.startsWith("focus:ring-")) return true;
  if (
    suffix === "0" &&
    token.startsWith("focus-visible:ring-") &&
    sourceLine.includes("focus-visible:outline-[var(--ds-focus-outline-color)]")
  ) {
    return true;
  }

  // The visible focus color: opaque and contrast-checked in `design:contrast`.
  if (suffix === "[var(--ds-focus-outline-color)]") return true;

  // Offset utilities keep the ring separated from same-colored surfaces.
  if (suffix === "offset-0") return true;
  if (suffix === "offset-background" || suffix === "offset-surface") return true;
  if (suffix.startsWith("offset-[var(--")) return true;

  return false;
}

function report(rel, source, index, label, value, suggest) {
  const line = lineOf(source, index);
  if (lineText(source, line).includes("design-allow")) return;
  failures.push({ rel, line, label, value, suggest });
}

function checkSource(rel, source) {
  if (source.includes("design-allow-file")) return;

  for (const match of source.matchAll(/\b(?:focus|focus-visible|focus-within):ring-[^\s"'`<>]+/g)) {
    const token = match[0];
    const line = lineOf(source, match.index ?? 0);
    if (isAllowedFocusRing(token, lineText(source, line))) continue;
    report(
      rel,
      source,
      match.index ?? 0,
      "non-token focus ring",
      token,
      "use one focus indicator: an inset ring-2 for fields or a tokenized outline for buttons",
    );
  }

  for (const match of source.matchAll(/\bactive:scale-[^\s"'`<>]+/g)) {
    const token = cleanBang(match[0]);
    if (token === "active:scale-[0.98]") continue;
    report(
      rel,
      source,
      match.index ?? 0,
      "non-canonical pressed scale",
      match[0],
      "use active:scale-[0.98]",
    );
  }

  for (const match of source.matchAll(/\b(?:disabled|aria-disabled):opacity-[^\s"'`<>]+/g)) {
    const token = cleanBang(match[0]);
    if (token.endsWith(":opacity-60")) continue;
    report(
      rel,
      source,
      match.index ?? 0,
      "non-canonical disabled opacity",
      match[0],
      "use disabled:opacity-60 / aria-disabled:opacity-60",
    );
  }

  // Computed disabled branches sometimes use `cursor-not-allowed` instead of a
  // native disabled pseudo-class. Keep their opacity aligned too.
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (!line.includes("cursor-not-allowed") || line.includes("design-allow")) return;
    for (const match of line.matchAll(/\bopacity-(\d+)\b/g)) {
      if (match[1] === "60") continue;
      failures.push({
        rel,
        line: index + 1,
        label: "non-canonical disabled branch opacity",
        value: match[0],
        suggest: "use opacity-60 for disabled-looking computed branches",
      });
    }
  });
}

for (const full of walk(SRC, [])) {
  if (isExcluded(full)) continue;
  checkSource(path.relative(root, full), fs.readFileSync(full, "utf8"));
}

for (const rel of extraFiles) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) checkSource(rel, fs.readFileSync(full, "utf8"));
}

if (failures.length) {
  console.error("Interactive-state check failed:\n");
  for (const f of failures) {
    console.error(`- ${f.rel}:${f.line}  ${f.label}: ${f.value}`);
    console.error(`  ${f.suggest}`);
  }
  console.error(
    `\n${failures.length} state violation(s) in ${new Set(failures.map((f) => f.rel)).size} file(s).` +
      "\nUse the state helpers in app/components/ui/variants.ts or add a justified design-allow comment.",
  );
  process.exit(1);
}

console.log("[design-states] OK: interactive focus, pressed, and disabled states follow convention.");
