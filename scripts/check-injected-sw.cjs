#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

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
console.log("[check-injected-sw] OK: production manifest injected.");
