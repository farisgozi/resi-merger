#!/bin/bash

# Heroku deployment script for WhatsApp PDF Merger Bot
# Make sure you have Heroku CLI installed: https://devcenter.heroku.com/articles/heroku-cli

set -e

echo "🚀 Starting Heroku deployment for WhatsApp PDF Merger Bot"

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ You are not logged in to Heroku. Please run:"
    echo "   heroku login"
    exit 1
fi

# App name (you can change this)
APP_NAME=${1:-"bot-$(date +%s)"}

echo "📱 Creating Heroku app: $APP_NAME"

# Create Heroku app
heroku create $APP_NAME --region us

# Add Node.js buildpack
heroku buildpacks:set heroku/nodejs --app $APP_NAME

# Set environment variables (you'll need to update these)
echo "⚙️ Setting up environment variables..."
echo "❗ IMPORTANT: You need to set these environment variables manually:"
echo "   heroku config:set APPWRITE_PROJECT_ID=your_project_id --app $APP_NAME"
echo "   heroku config:set APPWRITE_API_KEY=your_api_key --app $APP_NAME"
echo "   heroku config:set APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 --app $APP_NAME"
echo "   heroku config:set PDF_MERGER_FUNCTION_ID=68617ea70030b8ef6bbe --app $APP_NAME"
echo "   heroku config:set BOT_PREFIX=.pdf --app $APP_NAME"
echo "   heroku config:set NODE_ENV=production --app $APP_NAME"

# Set some default config vars
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set BOT_PREFIX=.pdf --app $APP_NAME
heroku config:set APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 --app $APP_NAME
heroku config:set PDF_MERGER_FUNCTION_ID=68617ea70030b8ef6bbe --app $APP_NAME

# Add git remote
heroku git:remote --app $APP_NAME

echo "📦 Deploying to Heroku..."

# Deploy to Heroku
git add .
git commit -m "Deploy WhatsApp PDF Merger Bot to Heroku" || echo "No changes to commit"
git push heroku main || git push heroku master

echo "📋 Checking deployment status..."
heroku ps --app $APP_NAME

echo "📊 Opening logs..."
echo "You can view logs with: heroku logs --tail --app $APP_NAME"

echo ""
echo "🎉 Deployment completed!"
echo "📱 App URL: https://$APP_NAME.herokuapp.com"
echo "📋 App Dashboard: https://dashboard.heroku.com/apps/$APP_NAME"
echo ""
echo "📱 To see QR code and logs, run:"
echo "   heroku logs --tail --app $APP_NAME"
echo ""
echo "❗ Don't forget to set your Appwrite credentials:"
echo "   heroku config:set APPWRITE_PROJECT_ID=your_project_id --app $APP_NAME"
echo "   heroku config:set APPWRITE_API_KEY=your_api_key --app $APP_NAME"
