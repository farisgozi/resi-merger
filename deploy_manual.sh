#!/bin/bash

# Simple PDF Merger Deployment Script
echo "🚀 Simple deployment for PDF Merger..."

# Create a simple tarball of source files
echo "📦 Creating deployment package..."

# Create temp directory for deployment files
TEMP_DIR=$(mktemp -d)
echo "📁 Using temp directory: $TEMP_DIR"

# Copy source files
cp -r src/ "$TEMP_DIR/"
cp requirements.txt "$TEMP_DIR/"
cp appwrite.json "$TEMP_DIR/"

echo "📋 Files prepared for deployment:"
find "$TEMP_DIR" -type f

echo ""
echo "🎯 Manual deployment steps:"
echo "1. Go to https://cloud.appwrite.io/console/project-6861b5e20027ba386475/functions/function-68617ea70030b8ef6bbe"
echo "2. Click 'Create Deployment'"
echo "3. Upload the following files:"
echo "   - src/main.py"
echo "   - src/utils.py" 
echo "   - requirements.txt"
echo "4. Set entrypoint to: src/main.py"
echo "5. Set build commands to: apt-get update && apt-get install -y poppler-utils && pip install -r requirements.txt"
echo "6. Click 'Deploy'"

echo ""
echo "📝 Function configuration should be:"
echo "- Runtime: Python 3.12"
echo "- Timeout: 900 seconds"
echo "- Memory: 1GB"
echo "- Execute permissions: any"
echo "- Scopes: any"

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Deployment package prepared!"
echo "🌐 Function URL: https://syd.cloud.appwrite.io/v1/functions/68617ea70030b8ef6bbe/executions"
