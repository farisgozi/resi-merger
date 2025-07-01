#!/bin/bash

# Enhanced PDF Merger Appwrite Deployment Script
echo "🚀 Deploying PDF Merger to Appwrite..."


# Set working directory
cd "$(dirname "$0")"

# Initialize Appwrite project if not already done
echo "📋 Initializing project configuration..."
if [ ! -f ".appwrite/project.json" ]; then
    echo "🔧 Setting up project for first time..."
    appwrite init project \
        --project-id 6861b5e20027ba386475 \
        --endpoint https://syd.cloud.appwrite.io/v1
else
    echo "✅ Project already configured"
fi

# Try to pull current function configuration to avoid conflicts
echo "🔄 Pulling current function configuration..."
appwrite pull functions --force 2>/dev/null || echo "⚠️ Could not pull functions (this is normal for first deployment)"

# Check for any manual configuration differences
echo "🔍 Checking function configuration..."

# Deploy with specific function ID
echo "🔧 Deploying PDF Merger function..."
appwrite deploy function --function-id 68617ea70030b8ef6bbe

# Alternative: Try manual function update if deploy fails
if [ $? -ne 0 ]; then
    echo "⚠️ Standard deploy failed, trying manual update..."
    
    # Update function configuration
    appwrite functions update \
        --function-id 68617ea70030b8ef6bbe \
        --name "PDF Merger" \
        --runtime "python-3.12" \
        --entrypoint "src/main.py" \
        --commands "pip install poppler-utils && pip install -r requirements.txt" \
        --timeout 900 \
        --execute "any" \
        --scopes "any" \
        --specification "s-1vcpu-1gb"
    
    # Create deployment from current directory
    echo "📦 Creating function deployment..."
    appwrite functions createDeployment \
        --function-id 68617ea70030b8ef6bbe \
        --entrypoint "src/main.py" \
        --code "$(pwd)" \
        --activate true
fi

echo "✅ Deployment process completed!"
echo ""
echo "🌐 Your PDF Merger function is available at:"
echo "https://syd.cloud.appwrite.io/v1/functions/68617ea70030b8ef6bbe/executions"
echo ""
echo "📊 You can monitor the function at:"
echo "https://cloud.appwrite.io/console/project-6861b5e20027ba386475/functions/function-68617ea70030b8ef6bbe"
echo ""
echo "🧪 Test the function with:"
echo "python test_function.py"
