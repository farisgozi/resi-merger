#!/bin/bash

# PDF Merger Appwrite Deployment Script
echo "🚀 Deploying PDF Merger to Appwrite..."

# Check if Appwrite CLI is installed
if ! command -v appwrite &> /dev/null; then
    echo "❌ Appwrite CLI is not installed. Please install it first:"
    echo "npm install -g appwrite-cli"
    exit 1
fi

# Check if logged in
if ! appwrite account get &> /dev/null; then
    echo "❌ Please login to Appwrite first:"
    echo "appwrite login"
    exit 1
fi

# Set project configuration
echo "📋 Setting project..."
appwrite client --project-id 6861b5e20027ba386475 --endpoint https://syd.cloud.appwrite.io/v1

# Pull current configuration first to sync
echo "🔄 Syncing configuration..."
appwrite pull functions --force

# Deploy functions
echo "🔧 Deploying functions..."
appwrite push functions

echo "✅ Deployment completed!"
echo "🌐 Your PDF Merger function is now available at:"
echo "https://syd.cloud.appwrite.io/v1/functions/68617ea70030b8ef6bbe/executions"
