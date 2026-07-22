const foundations = require("./foundations.cjs");
const semantic = require("./semantic.cjs");
const components = require("./components.cjs");
const editor = require("./editor.cjs");

function combine(key, layers) {
  const tokens = layers.flatMap((layer) => layer[key] || []);
  const seen = new Set();
  for (const token of tokens) {
    if (!token?.name || typeof token.value !== "string") {
      throw new TypeError(`[design-tokens] Invalid ${key} token entry.`);
    }
    if (seen.has(token.name)) {
      throw new Error(`[design-tokens] Duplicate ${key} token: ${token.name}`);
    }
    seen.add(token.name);
  }
  return tokens;
}

const layers = [foundations, semantic, components, editor];
const themeTokens = combine("themeTokens", layers);
const rootTokens = combine("rootTokens", layers);
const darkTokens = combine("darkTokens", layers);

const authoredNames = new Set(
  [...themeTokens, ...rootTokens].map((token) => token.name),
);
for (const token of darkTokens) {
  if (!authoredNames.has(token.name)) {
    throw new Error(
      `[design-tokens] Dark override has no authored token: ${token.name}`,
    );
  }
}

module.exports = { themeTokens, rootTokens, darkTokens };
