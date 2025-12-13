/**
 * Generate Vercel Build Output API v3 config files.
 * 
 * This script creates the necessary config files that Nuxt doesn't generate
 * automatically for proper Vercel deployment.
 * 
 * Run after `yarn build`:
 *   node scripts/generate-vercel-config.cjs
 */
const fs = require('fs');
const path = require('path');

const outputDir = path.resolve('.vercel/output');
const functionsDir = path.join(outputDir, 'functions/__nitro.func');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  console.log('ℹ️  Creating .vercel/output directory...');
  fs.mkdirSync(outputDir, { recursive: true });
}

// Routing configuration - simple fallback routing
// 1. Try to serve from static files first
// 2. Everything else goes to the Nitro serverless function
const config = {
  "version": 3,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/__nitro" }
  ]
};

// Write config.json
const configPath = path.join(outputDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✅ Created:', configPath);

// Check if functions directory exists and add .vc-config.json if needed
if (fs.existsSync(functionsDir)) {
  const vcConfigPath = path.join(functionsDir, '.vc-config.json');
  
  // Only create if it doesn't exist
  if (!fs.existsSync(vcConfigPath)) {
    const vcConfig = {
      "runtime": "nodejs20.x",
      "handler": "index.mjs",
      "launcherType": "Nodejs",
      "shouldAddHelpers": true
    };
    fs.writeFileSync(vcConfigPath, JSON.stringify(vcConfig, null, 2));
    console.log('✅ Created:', vcConfigPath);
  } else {
    console.log('ℹ️  .vc-config.json already exists, skipping');
  }
} else {
  // Try alternative function directory name
  const altFunctionsDir = path.join(outputDir, 'functions/__fallback.func');
  if (fs.existsSync(altFunctionsDir)) {
    const vcConfigPath = path.join(altFunctionsDir, '.vc-config.json');
    if (!fs.existsSync(vcConfigPath)) {
      const vcConfig = {
        "runtime": "nodejs20.x",
        "handler": "index.mjs",
        "launcherType": "Nodejs",
        "shouldAddHelpers": true
      };
      fs.writeFileSync(vcConfigPath, JSON.stringify(vcConfig, null, 2));
      console.log('✅ Created:', vcConfigPath);
    }
  }
}

console.log('✅ Vercel config generation complete!');
