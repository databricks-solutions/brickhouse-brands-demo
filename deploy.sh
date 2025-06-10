#!/bin/bash

# Brickhouse Brands Deployment Script
# This script builds the frontend and deploys the full application to Databricks Apps

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROFILE="DEFAULT"
TARGET="dev"

# Function to show usage
show_usage() {
    echo -e "${YELLOW}💡 Usage: ./deploy.sh [OPTIONS]${NC}"
    echo -e "${YELLOW}${NC}"
    echo -e "${YELLOW}Options:${NC}"
    echo -e "${YELLOW}  --profile, -p    Databricks CLI profile (default: DEFAULT)${NC}"
    echo -e "${YELLOW}  --target, -t     Databricks Asset Bundle target (default: dev)${NC}"
    echo -e "${YELLOW}  --help           Show this help message${NC}"
    echo -e "${YELLOW}${NC}"
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "${YELLOW}  ./deploy.sh${NC}"
    echo -e "${YELLOW}  ./deploy.sh --profile DEFAULT --target dev${NC}"
    echo -e "${YELLOW}  ./deploy.sh -p DEFAULT -t dev${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --profile|-p)
            PROFILE="$2"
            shift 2
            ;;
        --target|-t)
            TARGET="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Starting Brickhouse Brands Deployment${NC}"
echo -e "${BLUE}📋 Profile: ${PROFILE}${NC}"
echo -e "${BLUE}📋 Target: ${TARGET}${NC}"
echo ""

# Get workspace host from Databricks CLI profile
echo -e "${BLUE}🔍 Getting workspace information from profile: ${PROFILE}${NC}"

# Check if databricks CLI is available
if ! command -v databricks &> /dev/null; then
    echo -e "${RED}❌ Error: Databricks CLI not found. Please install it first.${NC}"
    echo -e "${BLUE}💡 Install with: pip install databricks-cli${NC}"
    exit 1
fi

# Get workspace host from profile
WORKSPACE_HOST=$(databricks auth describe --profile ${PROFILE} 2>/dev/null | grep "Host:" | cut -d' ' -f2)

if [ -z "$WORKSPACE_HOST" ]; then
    echo -e "${RED}❌ Error: Could not get workspace host from profile '${PROFILE}'${NC}"
    echo -e "${BLUE}💡 Please check that the profile exists and is configured properly${NC}"
    echo -e "${BLUE}💡 Run: databricks auth describe --profile ${PROFILE}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Workspace Host: ${WORKSPACE_HOST}${NC}"

# Step 1: Build Frontend
echo -e "${YELLOW}🏗️  Building frontend application...${NC}"

# Navigate to frontend directory
cd frontend

# Build the frontend using available package manager
ENV_BACKUP=""
if [ -f ".env" ]; then
    echo -e "${BLUE}📋 Temporarily moving .env file for production build...${NC}"
    ENV_BACKUP=".env.backup.$(date +%s)"
    mv .env "$ENV_BACKUP"
fi

if command -v bun &> /dev/null; then
    echo -e "${BLUE}📦 Using Bun to build frontend...${NC}"
    bun run build --mode production
elif command -v yarn &> /dev/null; then
    echo -e "${BLUE}📦 Using Yarn to build frontend...${NC}"
    yarn build --mode production
else
    echo -e "${BLUE}📦 Using npm to build frontend...${NC}"
    npm run build -- --mode production
fi

# Restore .env file if it was backed up
if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
    echo -e "${BLUE}🔄 Restoring .env file...${NC}"
    mv "$ENV_BACKUP" .env
fi

echo -e "${GREEN}✅ Frontend build completed!${NC}"

# Navigate back to project root
cd ..

# Check if dist directory was created in frontend
if [ ! -d "frontend/dist" ]; then
    echo -e "${RED}❌ Error: frontend/dist directory not found after build${NC}"
    exit 1
fi

# Step 2: Copy Frontend to Backend Static
echo -e "${YELLOW}📁 Copying frontend build to backend/static...${NC}"

# Clean and recreate backend static directory
rm -rf backend/static
mkdir -p backend/static

# Copy all files from frontend/dist to backend/static
cp -r frontend/dist/* backend/static/

echo -e "${GREEN}✅ Frontend files copied to backend/static/${NC}"

echo -e "${BLUE}📁 Backend static directory contents:${NC}"
ls -la backend/static/

echo ""

# Step 3: Deploy to Databricks
echo -e "${YELLOW}🚀 Deploying to Databricks Apps...${NC}"

# Deploy the bundle
echo -e "${BLUE}📦 Deploying bundle to ${TARGET} environment...${NC}"
databricks bundle deploy -t ${TARGET} --profile ${PROFILE}

echo -e "${GREEN}✅ Bundle deployed successfully!${NC}"

# Run the application
echo -e "${BLUE}🏃‍♂️ Starting application...${NC}"
databricks bundle run -t ${TARGET} brickhouse_brands --profile ${PROFILE}

echo -e "${GREEN}✅ Application started successfully!${NC}"

echo ""
echo -e "${GREEN}🎯 Deployment completed successfully!${NC}"
echo -e "${BLUE}📍 Your Brickhouse Brands application is now running on Databricks Apps${NC}"
echo -e "${BLUE}🌐 Check your Databricks workspace for the application URL${NC}"
echo ""
echo -e "${YELLOW}💡 Usage: ./deploy.sh [OPTIONS]${NC}"
echo -e "${YELLOW}   Default profile: DEFAULT${NC}"
echo -e "${YELLOW}   Default target: dev${NC}"
echo -e "${YELLOW}   Example: ./deploy.sh --profile DEFAULT --target dev${NC}" 