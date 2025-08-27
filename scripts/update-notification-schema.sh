#!/bin/bash

# Database Schema Update Script for MongoDB
# This script updates the Prisma schema for MongoDB (no migrations needed)

echo "🔄 Updating Prisma schema for enhanced notifications (MongoDB)..."

# Generate Prisma client with new schema
echo "📦 Generating Prisma client..."
npx prisma generate --schema=server/prisma/schema.prisma

# Push schema changes to MongoDB (no migrations for MongoDB)
echo "🚀 Pushing schema changes to MongoDB..."
npx prisma db push --schema=server/prisma/schema.prisma

echo "✅ Schema update completed!"
echo "💡 Note: MongoDB doesn't use migrations - changes are applied directly via db push"
