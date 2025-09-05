#!/usr/bin/env node
/**
 * check-sw-placeholder.cjs
 * Ensures that public/sw.js contains the Workbox injection placeholder `self.__WB_MANIFEST`.
 * Exits with non-zero code if missing to prevent accidental builds without precache injection.
 */

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');

try {
  const content = fs.readFileSync(swPath, 'utf8');
  if (!content.includes('self.__WB_MANIFEST')) {
    console.error('[check-sw-placeholder] ERROR: Expected self.__WB_MANIFEST placeholder missing in public/sw.js');
    process.exit(1);
  }
  console.log('[check-sw-placeholder] OK: Placeholder present.');
} catch (e) {
  console.error('[check-sw-placeholder] ERROR: Cannot read public/sw.js:', e.message);
  process.exit(1);
}
