#!/bin/bash

# Improved Heroku deployment script for WhatsApp PDF Bot
set -e

echo "🚀 Starting Heroku deployment for WhatsApp PDF Merger Bot"

# Configuration
APP_NAME="whatsapp-bot-joy"

echo "📦 Adding Redis add-on (if not exists)..."
heroku addons:create heroku-redis:mini -a $APP_NAME || echo "✅ Redis add-on already exists"

echo "⚙️ Setting environment variables..."
heroku config:set NODE_ENV=production -a $APP_NAME
heroku config:set BOT_PREFIX=.pdf -a $APP_NAME

# Check Redis URL
echo "🔍 Checking Redis configuration..."
REDIS_URL=$(heroku config:get REDIS_URL -a $APP_NAME)
if [ -z "$REDIS_URL" ]; then
    echo "❌ REDIS_URL not found. Please check Redis add-on installation."
    exit 1
else
    echo "✅ Redis URL found and configured"
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Committing changes..."
git add .
git commit -m "Fix Redis configuration for redis-baileys compatibility" || echo "No changes to commit"

echo "🚀 Deploying to Heroku..."
git push heroku main

echo "📋 Checking deployment status..."
heroku ps -a $APP_NAME

echo "🔍 Checking environment variables..."
heroku config -a $APP_NAME | grep -E "(REDIS_URL|NODE_ENV|BOT_PREFIX)"

echo "📊 Starting logs monitoring..."
echo "Press Ctrl+C to stop log monitoring"
heroku logs --tail -a $APP_NAME
