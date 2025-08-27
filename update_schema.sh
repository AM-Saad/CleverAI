#!/bin/bash

# This script updates the database schema with the freemium quota tracking models

# Push schema changes
echo "Pushing schema changes to database..."
npx prisma db push --schema=./server/prisma/schema.prisma

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate --schema=./server/prisma/schema.prisma

echo "Database schema updated successfully!"
