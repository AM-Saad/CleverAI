#!/usr/bin/env node
/**
 * check-ai-worker.cjs
 * Ensures that public/ai-worker.js exists and contains essential AI worker code.
 * Exits with non-zero code if missing to prevent accidental builds without the AI worker.
 */

const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '..', 'public', 'ai-worker.js');

try {
  const content = fs.readFileSync(workerPath, 'utf8');
  
  // Check for essential markers
  const hasTransformers = content.includes('@xenova/transformers') || content.includes('importScripts') || content.includes('ensureTransformers');
  const hasModelManagement = content.includes('ModelPipeline') || content.includes('modelInstances') || content.includes('getModel');
  const hasMessageHandler = content.includes('addEventListener');
  
  if (!hasTransformers || !hasModelManagement || !hasMessageHandler) {
    console.error('[check-ai-worker] ERROR: AI worker missing essential code');
    if (!hasTransformers) console.error('  - Missing Transformers.js loading logic');
    if (!hasModelManagement) console.error('  - Missing model management logic');
    if (!hasMessageHandler) console.error('  - Missing message event listener');
    process.exit(1);
  }
  
  console.log('[check-ai-worker] OK: AI worker validated.');
} catch (e) {
  console.error('[check-ai-worker] ERROR: Cannot read public/ai-worker.js:', e.message);
  process.exit(1);
}
