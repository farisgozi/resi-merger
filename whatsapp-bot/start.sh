#!/bin/bash

# WhatsApp PDF Merger Bot - Start Script with Appwrite Integration

echo "🤖 Starting WhatsApp PDF Merger Bot with Appwrite Integration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your Appwrite credentials before running again."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create auth_info directory if it doesn't exist
if [ ! -d "auth_info" ]; then
    echo "📁 Creating auth_info directory..."
    mkdir -p auth_info
fi

# Create temp directory if it doesn't exist
if [ ! -d "temp" ]; then
    echo "📁 Creating temp directory..."
    mkdir -p temp
fi

echo ""
echo "🔧 Configuration Status:"
echo "  • Appwrite Project: $(grep APPWRITE_PROJECT_ID .env | cut -d'=' -f2)"
echo "  • PDF Function ID: $(grep PDF_MERGER_FUNCTION_ID .env | cut -d'=' -f2)"
echo "  • Bot Prefix: $(grep BOT_PREFIX .env | cut -d'=' -f2)"
echo ""

# Check if session exists
if [ -f "auth_info/creds.json" ]; then
    echo "✅ WhatsApp session found - attempting reconnect"
else
    echo "📱 No session found - QR code will be displayed for first-time setup"
fi

echo ""
echo "🚀 Starting WhatsApp PDF Bot..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the bot
npm start
