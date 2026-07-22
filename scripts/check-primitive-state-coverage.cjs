#!/usr/bin/env node

/*
 * Primitive state-matrix coverage (`yarn design:primitives`).
 *
 * This is a structural regression gate: it verifies that every canonical
 * interactive primitive still exposes the agreed state API, that every button
 * tone × variant combination is explicitly themed, and that the living catalog
 * retains the full field/selection/menu matrix.
 */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function requireText(rel, source, text, label = text) {
  if (!source.includes(text)) failures.push(`${rel}: missing ${label}`);
}

const configRel = "app/app.config.ts";
const config = read(configRel);
const tones = ["primary", "neutral", "error"];
const buttonVariants = ["solid", "soft", "ghost", "link"];
const fieldVariants = ["outline"];

for (const tone of tones) {
  for (const variant of buttonVariants) {
    requireText(
      configRel,
      config,
      `{ color: "${tone}", variant: "${variant}"`,
      `button matrix entry ${tone}/${variant}`,
    );
  }
}

for (const primitive of [
  "input",
  "textarea",
  "select",
  "checkbox",
  "switch",
  "button",
  "dropdownMenu",
  "popover",
]) {
  requireText(
    configRel,
    config,
    `${primitive}: {`,
    `${primitive} theme section`,
  );
}

for (const variant of fieldVariants) {
  requireText(configRel, config, `${variant}:`, `field variant ${variant}`);
}

for (const stateClass of [
  "focus-visible:outline-[var(--ds-focus-outline-color)]!",
  "focus:ring-[var(--ds-focus-outline-color)]!",
  "disabled:opacity-60!",
  "data-disabled:opacity-60",
  "text-error-text",
]) {
  requireText(
    configRel,
    config,
    stateClass,
    `canonical state class ${stateClass}`,
  );
}

const wrapperRequirements = {
  "app/components/ui/UiButton.vue": [
    "loadingAuto?: boolean",
    "active?: boolean",
    "activeVariant?:",
    ':disabled="disabled"',
    ':loading="loading"',
  ],
  "app/components/ui/UiInput.vue": [
    "readonly?: boolean",
    "loading?: boolean",
    "error?: boolean | string",
    ":aria-invalid=",
  ],
  "app/components/ui/UiTextarea.vue": [
    "readonly?: boolean",
    "loading?: boolean",
    "error?: boolean | string",
  ],
  "app/components/ui/UiSelect.vue": [
    "loading?: boolean",
    "error?: boolean | string",
    ':content="content"',
  ],
  "app/components/ui/UiCheckbox.vue": [
    'boolean | "indeterminate"',
    'indicator?: "start" | "end" | "hidden"',
    "error?: boolean | string",
  ],
  "app/components/ui/UiSwitch.vue": [
    "loading?: boolean",
    "checkedIcon?: string",
    "uncheckedIcon?: string",
    "error?: boolean | string",
  ],
};

for (const [rel, requirements] of Object.entries(wrapperRequirements)) {
  const source = read(rel);
  for (const requirement of requirements) requireText(rel, source, requirement);
}

const catalogRel = "app/pages/design-system.vue";
const catalog = read(catalogRel);
for (const marker of [
  "Form controls",
  "Field states",
  "Checkbox and switch states",
  "Segmented control",
  "Action-menu states",
  'ref<boolean | "indeterminate">("indeterminate")',
]) {
  requireText(catalogRel, catalog, marker);
}

if (failures.length) {
  console.error("Primitive state coverage check failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(
    `\n${failures.length} missing primitive-state contract item(s).`,
  );
  process.exit(1);
}

console.log(
  `[design-primitives] OK: ${tones.length * buttonVariants.length} button combinations, ` +
    `${fieldVariants.length} field appearance, wrapper state APIs, and catalog states are covered.`,
);
