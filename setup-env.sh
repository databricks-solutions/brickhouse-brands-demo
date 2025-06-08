#!/bin/bash

# Brickhouse Brands - Environment Setup Script

echo "🔧 Setting up Brickhouse Brands Development Environment"
echo "====================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    echo "💡 If using ASDF: asdf install nodejs"
    exit 1
fi

if ! command_exists python3; then
    echo "❌ Python 3 is not installed. Please install Python 3.10+ and try again."
    echo "💡 If using ASDF: asdf install python"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Setup Backend Environment
echo ""
echo "🐍 Setting up Backend Environment..."
cd backend

if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists"
fi

echo "🔧 Activating virtual environment and installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit backend/.env with your database credentials"
else
    echo "✅ .env file already exists"
fi

echo "✅ Backend environment setup complete"

cd ..

# Setup Frontend Environment
echo ""
echo "⚛️  Setting up Frontend Environment..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
else
    echo "✅ Node modules already installed"
fi

echo "✅ Frontend environment setup complete"

cd ..

echo ""
echo "🎉 Environment setup completed successfully!"
echo "=========================================="
echo "🐍 Backend: Python virtual environment created in backend/venv"
echo "⚛️  Frontend: Node modules installed in frontend/node_modules"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your database credentials (if needed)"
echo "2. Run './start-dev.sh' to start the development servers" 