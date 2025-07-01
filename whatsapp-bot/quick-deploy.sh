#!/bin/bash

# Quick Heroku deployment script
echo "🚀 Quick Heroku Deploy for WhatsApp Bot"

# Check if app name provided
if [ -z "$1" ]; then
    echo "❌ Please provide app name:"
    echo "   ./quick-deploy.sh your-app-name"
    exit 1
fi

APP_NAME=$1

echo "📱 Deploying to: $APP_NAME"

# Create app if it doesn't exist
heroku create $APP_NAME --region us 2>/dev/null || echo "App already exists"

# Set git remote
heroku git:remote -a $APP_NAME

# Set default environment variables
echo "⚙️ Setting environment variables..."
heroku config:set NODE_ENV=production -a $APP_NAME
heroku config:set BOT_PREFIX=.pdf -a $APP_NAME
heroku config:set APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1 -a $APP_NAME
heroku config:set PDF_MERGER_FUNCTION_ID=68617ea70030b8ef6bbe -a $APP_NAME

echo "❗ IMPORTANT: Set your Appwrite credentials:"
echo "   heroku config:set APPWRITE_PROJECT_ID=6861b5e20027ba386475 -a $APP_NAME"
echo "   heroku config:set APPWRITE_API_KEY=your_api_key_here -a $APP_NAME"

# Deploy
echo "📦 Deploying..."
git add .
git commit -m "Deploy to Heroku" -m "$(date)" || echo "No changes to commit"
git push heroku HEAD:main

echo "✅ Deployment completed!"
echo "📊 View logs: heroku logs --tail -a $APP_NAME"
echo "🔗 App URL: https://$APP_NAME.herokuapp.com"
