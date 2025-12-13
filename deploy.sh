#!/bin/bash
set -e

echo "🚀 Starting CleverAI deployment process..."

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
fi

# Clean build caches to avoid VueUse import issues
echo "🧹 Cleaning build caches..."
rm -rf .nuxt .vercel node_modules/.cache node_modules/.vite

# Regenerate Nuxt configs to clear stale auto-imports
echo "🔧 Regenerating Nuxt configuration..."
npx nuxi prepare

# Generate Prisma client with serverless binary targets
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=server/prisma/schema.prisma

# Build the application with Vercel preset
echo "📦 Building application with Vercel preset..."
NITRO_PRESET=vercel yarn build

# Verify Vercel output exists
if [ ! -d ".vercel/output" ]; then
    echo "❌ Error: .vercel/output directory not found"
    echo "Creating from .output..."
    
    # Convert Nuxt output to Vercel Build Output API format
    mkdir -p .vercel/output/static
    mkdir -p .vercel/output/functions/__nitro.func
    
    # Copy static files
    cp -r .output/public/* .vercel/output/static/
    
    # Copy server files
    cp -r .output/server/* .vercel/output/functions/__nitro.func/
    
    # Create function config
    cat > .vercel/output/functions/__nitro.func/.vc-config.json << 'EOF'
{
  "runtime": "nodejs20.x",
  "handler": "index.mjs",
  "launcherType": "Nodejs",
  "shouldAddHelpers": true
}
EOF
fi

# Generate Vercel config.json
echo "📝 Generating Vercel config files..."
node scripts/generate-vercel-config.cjs

# Verify config exists
if [ ! -f ".vercel/output/config.json" ]; then
    echo "❌ Error: Build output config not found at .vercel/output/config.json"
    exit 1
fi

echo "✅ Build completed successfully!"

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
npx vercel deploy --prebuilt --prod

echo "✅ Deployment complete!"
