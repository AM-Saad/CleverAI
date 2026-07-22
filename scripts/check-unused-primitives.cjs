#!/usr/bin/env node

/* Fails when a design-system primitive has no live application consumer. */

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const app = path.join(root, "app");
const primitiveRoot = path.join(app, "components", "ui");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function pascal(value) {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function kebab(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const sources = walk(app).filter(
  (file) =>
    /\.(?:vue|ts)$/.test(file) &&
    file !== path.join(app, "pages", "design-system.vue"),
);
const primitives = walk(primitiveRoot).filter((file) => file.endsWith(".vue"));
const unused = [];

for (const primitive of primitives) {
  const basename = path.basename(primitive, ".vue");
  const name = basename.startsWith("Ui") ? basename : `Ui${pascal(basename)}`;
  const tag = kebab(name);
  const importLeaf = path.basename(primitive);
  const consumers = sources.filter((sourceFile) => {
    if (sourceFile === primitive) return false;
    const source = fs.readFileSync(sourceFile, "utf8");
    return (
      new RegExp(`<${name}(?:\\s|/?>)`).test(source) ||
      new RegExp(`<${tag}(?:\\s|/?>)`).test(source) ||
      source.includes(importLeaf)
    );
  });
  if (!consumers.length) unused.push(path.relative(root, primitive));
}

if (unused.length) {
  console.error("[design-primitives-unused] Unused design-system primitives:");
  for (const file of unused) console.error(`- ${file}`);
  process.exit(1);
}

console.log(
  `[design-primitives-unused] OK: all ${primitives.length} primitives have a live consumer.`,
);
