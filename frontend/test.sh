#!/bin/bash
# Test script for OceanValue Frontend

echo "🌊 OceanValue Frontend - Test Script"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v20.11.1+"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Navigate to frontend directory
cd "C:\Users\Barbara.dias\Downloads\OceanValue\frontend" || {
    echo "❌ Frontend directory not found"
    exit 1
}

echo "✅ Frontend directory found"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Dependencies OK"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    echo "Please create .env with: VITE_MAPBOX_TOKEN=your_token"
    exit 1
fi

echo "✅ .env file found"
echo ""

# Check if public/data exists
if [ ! -d "public/data" ]; then
    echo "❌ public/data directory not found"
    exit 1
fi

echo "✅ Shapefile directory found"
echo ""

# List shapefiles
echo "📍 Shapefiles found:"
find public/data -name "*.shp" | while read file; do
    echo "   ✅ $(basename "$file")"
done

echo ""
echo "🚀 Starting dev server..."
echo "   Server will be available at: http://localhost:5174"
echo ""
echo "Test steps:"
echo "1. Open http://localhost:5174 in browser"
echo "2. Click menu button (☰)"
echo "3. Select risk type"
echo "4. Click 'Visualizar'"
echo "5. Check if heatmap appears"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start dev server
npm run dev
