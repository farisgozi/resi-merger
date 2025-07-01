#!/bin/bash

# Fix Appwrite Configuration Script
echo "🔧 Fixing Appwrite configuration conflicts..."

# Set project configuration explicitly
echo "📋 Setting project configuration..."
appwrite client \
    --project-id 6861b5e20027ba386475 \
    --endpoint https://syd.cloud.appwrite.io/v1

# Update function to match local configuration
echo "⚙️ Updating function configuration to match local settings..."

appwrite functions update \
    --function-id 68617ea70030b8ef6bbe \
    --name "PDF Merger" \
    --runtime "python-3.12" \
    --entrypoint "src/main.py" \
    --commands "apt-get update && apt-get install -y poppler-utils && pip install -r requirements.txt" \
    --timeout 900 \
    --execute "any" \
    --scopes "any" \
    --specification "s-1vcpu-1gb" \
    --enabled true \
    --logging true

if [ $? -eq 0 ]; then
    echo "✅ Function configuration updated successfully!"
    echo ""
    echo "Now you can deploy with:"
    echo "./deploy_enhanced.sh"
    echo ""
    echo "Or test with:"
    echo "python3 test_function.py"
else
    echo "❌ Failed to update function configuration"
    echo "Please check your permissions and try again"
fi
