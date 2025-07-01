#!/bin/bash

# Alternative Deployment using cURL
echo "🚀 Alternative deployment using direct API calls..."

# Function details
PROJECT_ID="6861b5e20027ba386475"
FUNCTION_ID="68617ea70030b8ef6bbe"
ENDPOINT="https://syd.cloud.appwrite.io/v1"

# Check if we have API key
if [ -z "$APPWRITE_API_KEY" ]; then
    echo "❌ APPWRITE_API_KEY environment variable not set"
    echo "💡 You can get your API key from:"
    echo "   https://cloud.appwrite.io/console/project-$PROJECT_ID/auth/api-keys"
    echo ""
    echo "Then run:"
    echo "export APPWRITE_API_KEY='your_api_key_here'"
    echo "./deploy_api.sh"
    exit 1
fi

echo "📦 Creating deployment archive..."

# Create deployment archive
tar -czf function.tar.gz src/ requirements.txt

# Create deployment using API
echo "🚀 Creating deployment via API..."

RESPONSE=$(curl -s -X POST \
    "$ENDPOINT/functions/$FUNCTION_ID/deployments" \
    -H "X-Appwrite-Project: $PROJECT_ID" \
    -H "X-Appwrite-Key: $APPWRITE_API_KEY" \
    -F "entrypoint=src/main.py" \
    -F "code=@function.tar.gz" \
    -F "activate=true")

echo "📋 API Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Clean up
rm -f function.tar.gz

echo ""
echo "✅ Deployment request sent!"
echo "🌐 Check status at: https://cloud.appwrite.io/console/project-$PROJECT_ID/functions/function-$FUNCTION_ID"
