#!/bin/bash

# Brickhouse Brands - Environment Setup Script

# Ensure we're in the script's directory (project root)
cd "$(dirname "$0")"

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

if ! command_exists rustc; then
    echo "⚠️  Rust is not installed. Traffic Simulator will be unavailable."
    echo "💡 If using ASDF: asdf install rust"
    echo "💡 Or install via rustup: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "✅ You can continue without Rust - it's optional for the main application"
else
    echo "✅ Rust compiler found"
fi

echo "✅ Prerequisites check passed"

# Check for centralized environment file
echo ""
echo "📄 Checking centralized environment configuration..."

if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        echo "⚠️  No .env file found at project root. Creating from env.example..."
        cp env.example .env
        echo "📝 Please edit .env with your actual configuration values"
    else
        echo "❌ No .env or env.example file found at project root"
        echo "💡 Please create a .env file with your configuration"
        exit 1
    fi
else
    echo "✅ Centralized .env file found"
fi

# Function to copy centralized env file to subdirectories
copy_env_to_subdir() {
    local subdir=$1
    echo "📋 Copying .env to ${subdir}/"
    if [ -d "$subdir" ]; then
        cp .env "${subdir}/.env"
        echo "✅ Environment file copied to ${subdir}/"
    else
        echo "⚠️  Directory ${subdir}/ not found, skipping..."
    fi
}

# Setup Database Environment
echo ""
echo "🗄️  Setting up Database Environment..."

# Copy centralized environment file first
copy_env_to_subdir "database"

cd database

if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment for database..."
    python3 -m venv venv
else
    echo "✅ Database virtual environment already exists"
fi

echo "🔧 Activating virtual environment and installing database dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Database environment setup complete"
deactivate

cd ..

# Setup Backend Environment
echo ""
echo "🐍 Setting up Backend Environment..."

# Copy centralized environment file first
copy_env_to_subdir "backend"

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

# Copy centralized environment file
cd ..
copy_env_to_subdir "frontend"

echo "✅ Frontend environment setup complete"

# Setup Traffic Simulator Environment
echo ""
echo "🦀 Setting up Traffic Simulator Environment..."

# Ensure we're in the project root
cd "$(dirname "$0")"

# Copy centralized environment file
copy_env_to_subdir "traffic-simulator"

if command_exists rustc; then
    echo "✅ Traffic Simulator environment setup complete"
else
    echo "⚠️  Traffic Simulator environment configured (Rust compiler needed to build)"
fi

echo ""
echo "🎉 Environment setup completed successfully!"
echo "=========================================="
echo "📄 Centralized .env file copied to all components"
echo "🗄️  Database: Python virtual environment created in database/venv"
echo "🐍 Backend: Python virtual environment created in backend/venv"
echo "⚛️  Frontend: Node modules installed in frontend/node_modules"
echo "🦀 Traffic Simulator: Environment file copied (Rust compiler: $(command_exists rustc && echo "✅ Found" || echo "⚠️  Not found"))"
echo ""
echo "Next steps:"
echo "1. Edit the root .env file with your actual configuration values"
echo "2. Run database setup (if needed): cd database && source venv/bin/activate && python demo_setup.py"
echo "3. Run './start-dev.sh' to start the development servers"
echo "4. Run traffic simulation (if Rust installed): cd traffic-simulator && ./run_simulation.sh" 