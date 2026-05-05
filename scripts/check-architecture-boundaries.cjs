#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const modulesRoot = path.join(root, "server", "modules");

const forbiddenEverywhere = [
  {
    test: (specifier) =>
      specifier === "vue" ||
      specifier.startsWith("@vue/") ||
      specifier.startsWith("@vueuse/") ||
      specifier.startsWith("~/components") ||
      specifier.startsWith("@/components") ||
      specifier.startsWith("~/composables") ||
      specifier.startsWith("@/composables") ||
      specifier.startsWith("~/pages") ||
      specifier.startsWith("@/pages") ||
      specifier.includes("/app/"),
    message: "server modules must not import frontend UI/app code",
  },
  {
    test: (specifier) =>
      specifier.startsWith("@server/api") ||
      specifier.includes("/server/api/"),
    message: "server modules must not import API route adapters",
  },
];

const forbiddenInDomain = [
  {
    test: (specifier) =>
      specifier === "h3" ||
      specifier === "#imports" ||
      specifier === "#app" ||
      specifier === "ofetch" ||
      specifier === "@prisma/client" ||
      specifier.startsWith("@server/utils/prisma") ||
      specifier.includes("/server/utils/prisma"),
    message: "domain code must not depend on HTTP, Nuxt runtime, fetch, or Prisma",
  },
  {
    test: (specifier) =>
      specifier.includes("/infrastructure/") ||
      specifier.includes("/application/"),
    message: "domain code must not import application or infrastructure code",
  },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name)
      ? [full]
      : [];
  });
}

function moduleNameFor(file) {
  const rel = path.relative(modulesRoot, file).split(path.sep);
  return rel[0];
}

function layerFor(file) {
  const rel = path.relative(modulesRoot, file).split(path.sep);
  return rel[1];
}

function moduleSpecifierTarget(specifier) {
  const aliasPrefix = "@server/modules/";
  if (specifier.startsWith(aliasPrefix)) {
    const parts = specifier.slice(aliasPrefix.length).split("/");
    return { moduleName: parts[0], layer: parts[1] };
  }

  const relativeMatch = specifier.match(/^(\.\.?\/.*)$/);
  if (!relativeMatch) return null;
  return null;
}

function extractSpecifiers(source) {
  const specifiers = [];
  const importExport =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImport = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const regex of [importExport, dynamicImport]) {
    let match;
    while ((match = regex.exec(source))) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function checkFile(file) {
  const rel = path.relative(root, file);
  const source = fs.readFileSync(file, "utf8");
  const specifiers = extractSpecifiers(source);
  const currentModule = moduleNameFor(file);
  const currentLayer = layerFor(file);
  const violations = [];

  for (const specifier of specifiers) {
    for (const rule of forbiddenEverywhere) {
      if (rule.test(specifier)) {
        violations.push({ rel, specifier, message: rule.message });
      }
    }

    if (currentLayer === "domain") {
      for (const rule of forbiddenInDomain) {
        if (rule.test(specifier)) {
          violations.push({ rel, specifier, message: rule.message });
        }
      }
    }

    const target = moduleSpecifierTarget(specifier);
    if (
      target &&
      target.moduleName &&
      target.moduleName !== currentModule &&
      target.moduleName !== "shared-kernel" &&
      (target.layer === "infrastructure" || target.layer === "application")
    ) {
      violations.push({
        rel,
        specifier,
        message:
          "cross-module imports may target ports/domain/shared-kernel, not another module's application or infrastructure",
      });
    }
  }

  return violations;
}

const files = walk(modulesRoot);
const violations = files.flatMap(checkFile);

if (violations.length) {
  console.error("Architecture boundary check failed:\n");
  for (const violation of violations) {
    console.error(
      `- ${violation.rel}: ${violation.message}\n  import: ${violation.specifier}`
    );
  }
  process.exit(1);
}

console.log(
  `[arch-check] OK: ${files.length} server module files respect architecture boundaries.`
);
