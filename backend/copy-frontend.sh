#!/bin/bash

# Script to build frontend and copy to backend static folder for deployment

set -e  # Exit on any error

echo "🏗️  Building frontend application..."

# Navigate to project root (parent of backend)
cd "$(dirname "$0")/.."

# Build the frontend using npm/yarn/bun
if command -v bun &> /dev/null; then
    echo "📦 Using Bun to build frontend..."
    bun run build
elif command -v yarn &> /dev/null; then
    echo "📦 Using Yarn to build frontend..."
    yarn build
else
    echo "📦 Using npm to build frontend..."
    npm run build
fi

echo "✅ Frontend build completed!"

# Check if dist directory was created
if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found after build"
    exit 1
fi

echo "📁 Copying frontend build to backend/static..."

# Clean and recreate backend static directory
rm -rf backend/static
mkdir -p backend/static

# Copy all files from dist to backend/static
cp -r dist/* backend/static/

echo "✅ Frontend files copied to backend/static/"

echo "📁 Backend static directory contents:"
ls -la backend/static/

echo ""
echo "🎯 Backend is now ready for deployment with embedded frontend!"
echo "🚀 You can now deploy the backend folder to Databricks Apps" 