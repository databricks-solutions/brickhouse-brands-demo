#!/bin/bash

# Brickhouse Brands - Development Startup Script

echo "🚀 Starting Brickhouse Brands Development Environment"
echo "=================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please run './setup-env.sh' first."
    exit 1
fi

if ! command_exists python3; then
    echo "❌ Python 3 is not installed. Please run './setup-env.sh' first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Check if environments are set up
if [ ! -d "backend/venv" ] || [ ! -d "frontend/node_modules" ]; then
    echo "⚠️  Environment not fully set up. Running setup script..."
    ./setup-env.sh
    if [ $? -ne 0 ]; then
        echo "❌ Environment setup failed. Please check the errors above."
        exit 1
    fi
fi

# Start backend in background
echo ""
echo "🐍 Starting FastAPI Backend..."
cd backend

echo "🔧 Activating virtual environment..."
source venv/bin/activate

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp env.example .env
    echo "📝 Please edit backend/.env with your database credentials before starting the backend"
fi

echo "🌐 Starting FastAPI server on http://localhost:8000"
python startup.py &
BACKEND_PID=$!

cd ..

# Start frontend
echo ""
echo "⚛️  Starting React Frontend..."
cd frontend

echo "🌐 Starting React development server on http://localhost:5173"
npm run dev &
FRONTEND_PID=$!

cd ..

# Wait and show status
sleep 3
echo ""
echo "🎉 Development environment started successfully!"
echo "=================================================="
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait 