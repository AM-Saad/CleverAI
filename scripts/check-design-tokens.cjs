#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();

const strictFiles = [
  "app/app.config.ts",
  "app/assets/css/main.css",
  "app/components/ui/UiCard.vue",
  "app/components/ui/Input.vue",
  "app/components/ui/TextArea.vue",
  "app/components/ui/Drawer.vue",
  "app/components/shared/LocalSyncStatus.vue",
  "app/components/shared/DialogModal.vue",
];

const generatedOrTokenSources = [
  "app/design-system/tokens/index.cjs",
  "app/design-system/tokens.generated.css",
  "app/design-system/tokens.generated.ts",
  "scripts/generate-design-tokens.cjs",
  "scripts/check-design-tokens.cjs",
];

const rawValuePattern =
  /(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(?:bg|text|border|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:[/-]\d+|\/\d+)?\b|\bshadow-(?:sm|md|lg|xl|2xl)\b|\brounded-(?:sm|md|lg|xl|2xl|3xl)\b|rounded-\[(?!var\(--radius-))/g;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function lineFor(source, index) {
  return source.slice(0, index).split("\n").length;
}

const violations = [];

for (const rel of strictFiles) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const source = read(rel);
  for (const match of source.matchAll(rawValuePattern)) {
    violations.push({
      rel,
      line: lineFor(source, match.index ?? 0),
      value: match[0],
    });
  }
}

for (const rel of generatedOrTokenSources) {
  if (!fs.existsSync(path.join(root, rel))) {
    violations.push({ rel, line: 0, value: "missing required design-token file" });
  }
}

if (violations.length) {
  console.error("Design token check failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation.rel}:${violation.line} uses ${violation.value}`);
  }
  console.error("\nUse semantic/component tokens or add a deliberate migration exception.");
  process.exit(1);
}

console.log(`[design-check] OK: ${strictFiles.length} migrated files use design-system tokens.`);
