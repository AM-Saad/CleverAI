#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const etag = require("etag");

const sw = path.resolve(process.cwd(), ".output/public/sw.js");
const source = fs.readFileSync(sw, "utf8");
if (source.includes("self.__WB_MANIFEST")) {
  console.error("[check-injected-sw] Workbox manifest placeholder was not injected.");
  process.exit(1);
}
if (!/url:\s*["']/.test(source)) {
  console.error("[check-injected-sw] Injected service worker contains no precache entries.");
  process.exit(1);
}
const nitroManifest = path.resolve(process.cwd(), ".output/server/chunks/nitro/nitro.mjs");
const nitroSource = fs.readFileSync(nitroManifest, "utf8");
const entryStart = nitroSource.indexOf('"/sw.js": {');
const entryEnd = nitroSource.indexOf("\n  },", entryStart);
const entry = entryStart >= 0 && entryEnd > entryStart ? nitroSource.slice(entryStart, entryEnd) : "";
const stat = fs.statSync(sw);
const expectedEtag = JSON.stringify(etag(fs.readFileSync(sw)));
if (!entry || !entry.includes(`"etag": ${expectedEtag}`) || !entry.includes(`"mtime": ${JSON.stringify(stat.mtime.toISOString())}`) || !entry.includes(`"size": ${stat.size}`)) {
  console.error("[check-injected-sw] Nitro public-asset metadata for /sw.js is stale; production would serve a truncated or stale worker.");
  process.exit(1);
}
console.log("[check-injected-sw] OK: production manifest injected.");
