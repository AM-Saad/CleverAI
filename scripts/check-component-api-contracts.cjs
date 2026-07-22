#!/usr/bin/env node

/* Rejects removed design-system components, props, tones, sizes, and variants. */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const app = path.join(root, "app");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const checks = [
  [
    /<(?:UiButton|ui-button)\b[^>]*\b(?:color|active-color|activeColor)=/gs,
    "legacy UiButton color prop",
  ],
  [/<(?:UiButton|ui-button)\b[^>]*\bpill(?:\s|=|>)/gs, "pill UiButton prop"],
  [
    /<(?:UiButton|ui-button)\b[^>]*\btone=["'](?:secondary|success|warning|info)["']/gs,
    "unsupported action tone",
  ],
  [
    /<(?:UiButton|ui-button)\b[^>]*\bsize=["']xl["']/gs,
    "removed control size xl",
  ],
  [
    /<(?:UiBadge|ui-badge|UiProgress|ui-progress)\b[^>]*\bcolor=/gs,
    "legacy semantic color prop",
  ],
  [
    /<(?:UiBadge|ui-badge)\b[^>]*\bvariant=["']solid["']/gs,
    "removed UiBadge solid variant",
  ],
  [
    /<(?:UiAlert|ui-alert)\b[^>]*\bvariant=["'](?:solid|outline)["']/gs,
    "removed UiAlert variant",
  ],
  [
    /<(?:UiInteractiveCard|ui-interactive-card)\b[^>]*\bvariant=["'](?:ghost|surface)["']/gs,
    "removed UiInteractiveCard variant",
  ],
  [
    /<(?:UiItemCard|ui-item-card)\b[^>]*\bvariant=["']ghost["']/gs,
    "removed UiItemCard ghost variant",
  ],
  [
    /<(?:UiInput|ui-input|UiSelect|ui-select|UiSelectMenu|ui-select-menu|UiTextarea|ui-textarea)\b[^>]*\b(?:variant|tone|highlight)=/gs,
    "removed field appearance prop",
  ],
  [
    /<(?:UiCheckbox|ui-checkbox)\b[^>]*\b(?:tone|color)=/gs,
    "removed checkbox tone prop",
  ],
  [
    /<(?:UiCheckbox|ui-checkbox)\b[^>]*\bvariant=["']card["']/gs,
    "removed checkbox card variant",
  ],
  [
    /<(?:UiSwitch|ui-switch)\b[^>]*\b(?:tone|color)=/gs,
    "removed switch tone prop",
  ],
  [
    /<(?:UiButtonGroup|ui-button-group|shared-empty-state|ui-card-stack|ui-flip-card|SharedDialogModal|shared-dialog-modal|DeleteConfirmationModal|delete-confirmation-modal)\b/gs,
    "removed component usage",
  ],
];

const violations = [];
for (const file of walk(app).filter((candidate) =>
  candidate.endsWith(".vue"),
)) {
  const source = fs.readFileSync(file, "utf8");
  for (const [pattern, label] of checks) {
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${path.relative(root, file)}:${line} ${label}`);
    }
  }
}

if (violations.length) {
  console.error("[design-component-api] Removed API usage detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  "[design-component-api] OK: component call sites use the supported API surface.",
);
