#!/bin/bash

# WhatsApp Bot Deployment Script for Appwrite

echo "🚀 Deploying WhatsApp PDF Merger Bot to Appwrite..."

# Configuration
FUNCTION_NAME="whatsapp-pdf-bot"
RUNTIME="node-18.0"
TIMEOUT=300
MEMORY=512

# Check if Appwrite CLI is installed
if ! command -v appwrite &> /dev/null; then
    echo "❌ Appwrite CLI is not installed."
    echo "📦 Install it with: npm install -g appwrite-cli"
    echo "🔗 Or visit: https://appwrite.io/docs/command-line"
    exit 1
fi

# Check if logged in to Appwrite
if ! appwrite client --version &> /dev/null; then
    echo "❌ Not logged in to Appwrite CLI."
    echo "🔑 Run: appwrite login"
    exit 1
fi

# Prepare deployment package
echo "📦 Preparing deployment package..."

# Create deployment directory
DEPLOY_DIR="./deploy"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy necessary files
cp package.json $DEPLOY_DIR/
cp index.js $DEPLOY_DIR/
cp -r node_modules $DEPLOY_DIR/ 2>/dev/null || echo "⚠️  node_modules not found, will install during deployment"

# Create Appwrite function configuration
cat > $DEPLOY_DIR/appwrite.json << EOF
{
    "projectId": "$APPWRITE_PROJECT_ID",
    "functions": {
        "$FUNCTION_NAME": {
            "name": "WhatsApp PDF Merger Bot",
            "runtime": "$RUNTIME",
            "execute": ["any"],
            "events": [],
            "schedule": "",
            "timeout": $TIMEOUT,
            "enabled": true,
            "logging": true,
            "entrypoint": "index.js",
            "commands": "npm install",
            "ignore": [".git", "README.md", "test.js", "deploy"]
        }
    }
}
EOF

# Create environment variables template
cat > $DEPLOY_DIR/.env.example << EOF
APPWRITE_PROJECT_ID=\$APPWRITE_PROJECT_ID
APPWRITE_API_KEY=\$APPWRITE_API_KEY
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
FUNCTION_ID=pdf-merger
BOT_PREFIX=.pdf
MAX_FILE_SIZE_MB=25
NODE_ENV=production
EOF

echo "✅ Deployment package prepared"

# Deploy to Appwrite
echo "🚀 Deploying to Appwrite..."

cd $DEPLOY_DIR

# Initialize Appwrite project if needed
if [ ! -f ".appwrite/project.json" ]; then
    echo "📋 Initializing Appwrite project..."
    appwrite init project
fi

# Deploy function
echo "📤 Uploading function..."
appwrite functions createDeployment \
    --functionId=$FUNCTION_NAME \
    --code="." \
    --activate=true

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    echo ""
    echo "🔧 Next steps:"
    echo "1. Set environment variables in Appwrite Console"
    echo "2. Configure function permissions"
    echo "3. Test function execution"
    echo ""
    echo "🌐 Appwrite Console: https://cloud.appwrite.io/console"
else
    echo "❌ Deployment failed!"
    exit 1
fi

# Cleanup
cd ..
rm -rf $DEPLOY_DIR

echo "🎉 Deployment completed!"
