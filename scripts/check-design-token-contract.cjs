#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  themeTokens,
  rootTokens,
  darkTokens,
} = require("../app/design-system/tokens/index.cjs");

const root = process.cwd();
const appRoot = path.join(root, "app");
const generated = new Set([
  "app/design-system/tokens.generated.css",
  "app/design-system/tokens.generated.ts",
]);
const usageExclusions = new Set(["app/pages/design-system.vue"]);
const externallyDefined = [
  /^--tw-/,
  /^--ui-/,
  /^--container-/,
  /^--text-/,
  /^--animate-/,
  /^--reka-/,
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(?:vue|css|scss|ts|tsx|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function references(source) {
  const clean = source
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/\/\*([\s\S]*?)\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...clean.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(
    (match) => match[1],
  );
}

function declarations(source) {
  return new Set([
    ...[...source.matchAll(/["']?(--[a-z0-9-]+)["']?\s*:/gim)].map(
      (match) => match[1],
    ),
    ...[...source.matchAll(/setProperty\(\s*["'](--[a-z0-9-]+)/gim)].map(
      (match) => match[1],
    ),
  ]);
}

function utilityUses(source, tokenName) {
  if (tokenName.startsWith("--color-")) {
    const suffix = tokenName
      .slice("--color-".length)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(?:bg|text|border|ring|outline|fill|stroke|from|via|to|divide|shadow)-${suffix}(?:[!\\s/:'\"\\]]|$)`,
    ).test(source);
  }
  if (tokenName.startsWith("--tracking-")) {
    return source.includes(`tracking-${tokenName.slice(11)}`);
  }
  if (tokenName.startsWith("--leading-")) {
    return source.includes(`leading-${tokenName.slice(10)}`);
  }
  if (tokenName === "--font-sans") return source.includes("font-sans");
  return false;
}

const authored = [...themeTokens, ...rootTokens];
const authoredNames = new Set(authored.map((token) => token.name));
const files = walk(appRoot).filter((file) => !generated.has(rel(file)));
const undefinedReferences = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const local = declarations(source);
  for (const name of references(source)) {
    if (
      authoredNames.has(name) ||
      local.has(name) ||
      externallyDefined.some((rule) => rule.test(name))
    )
      continue;
    const line = source.slice(0, source.indexOf(name)).split("\n").length;
    undefinedReferences.push(`${rel(file)}:${line} ${name}`);
  }
}

const liveSources = files
  .filter((file) => !usageExclusions.has(rel(file)))
  .map((file) => fs.readFileSync(file, "utf8"));
const direct = new Set();
for (const token of authored) {
  if (token.external) {
    direct.add(token.name);
    continue;
  }
  if (
    liveSources.some(
      (source) =>
        source.includes(token.name) || utilityUses(source, token.name),
    )
  ) {
    direct.add(token.name);
  }
}

// A used token keeps every authored dependency in its value alive.
let changed = true;
while (changed) {
  changed = false;
  for (const token of authored) {
    if (!direct.has(token.name)) continue;
    for (const dependency of references(token.value)) {
      if (authoredNames.has(dependency) && !direct.has(dependency)) {
        direct.add(dependency);
        changed = true;
      }
    }
  }
}

const unused = authored
  .filter((token) => !direct.has(token.name))
  .map((token) => token.name);

if (undefinedReferences.length || unused.length) {
  if (undefinedReferences.length) {
    console.error(
      "[design-token-contract] Undefined governed custom properties:",
    );
    undefinedReferences.forEach((entry) => console.error(`- ${entry}`));
  }
  if (unused.length) {
    console.error("[design-token-contract] Unreachable authored tokens:");
    unused.forEach((name) => console.error(`- ${name}`));
  }
  process.exit(1);
}

// Loading the index already validates cross-layer duplicates and dark overrides.
void darkTokens;
console.log(
  `[design-token-contract] OK: ${authored.length} authored tokens are defined and reachable.`,
);
