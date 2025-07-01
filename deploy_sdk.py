#!/usr/bin/env python3
"""
Direct Appwrite Function Deployment via SDK
Menggunakan konfigurasi yang sama dengan MCP
"""

import os
import base64
import tarfile
import tempfile
import json
from appwrite.client import Client
from appwrite.services.functions import Functions

# Konfigurasi dari MCP settings
PROJECT_ID = "6861b5e20027ba386475"
API_KEY = "standard_5ed75f529bfd4878d9a2e24a7716c9d5be40f20e30b14a96e337ec421d06f9d4f0db9cd10233b7209d708b2b234bf814b1cbc53a2c6a3784d05fb205e2d2da8d54ed65604b3c21bfa125ccf2eabd9da5618403dfa49a1a115d0b9c986fc7fe1d7f4a70c60873efe6864b18291f7415c530f6de496d960491ca6c184e6acc4268"
ENDPOINT = "https://syd.cloud.appwrite.io/v1"
FUNCTION_ID = "68617ea70030b8ef6bbe"

def create_deployment():
    """Create function deployment using Appwrite SDK"""
    
    print("🚀 Starting direct Appwrite deployment...")
    
    # Initialize Appwrite client
    client = Client()
    client.set_endpoint(ENDPOINT)
    client.set_project(PROJECT_ID)
    client.set_key(API_KEY)
    
    functions = Functions(client)
    
    try:
        # Get current function info
        print("📋 Getting function information...")
        function = functions.get(FUNCTION_ID)
        print(f"✅ Function found: {function['name']}")
        print(f"📊 Function ID: {function['$id']}")
        print(f"🔧 Runtime: {function['runtime']}")
        
        # Show current function details
        print("\n📋 Current function configuration:")
        for key, value in function.items():
            if key in ['name', 'runtime', 'timeout', 'enabled', 'entrypoint', 'execute', 'scopes']:
                print(f"   {key}: {value}")
        print()
        
        # Update function configuration first
        print("⚙️ Updating function configuration...")
        try:
            updated_function = functions.update(
                function_id=FUNCTION_ID,
                name="PDF Merger",
                runtime="python-3.12",
                execute=["any"],
                events=[],
                schedule="",
                timeout=900,
                enabled=True,
                logging=True,
                entrypoint="src/main.py",
                commands="apt-get update && apt-get install -y poppler-utils && pip install -r requirements.txt",
                scopes=["any"],
                install_dependencies=True
            )
            print("✅ Function configuration updated")
        except Exception as update_error:
            print(f"⚠️ Function update failed: {update_error}")
            print("📋 Continuing with deployment...")
        
        # Create deployment archive
        print("📦 Creating deployment archive...")
        archive_path = create_function_archive()
        
        # Create deployment
        print("🚀 Creating new deployment...")
        
        # Read archive as bytes
        with open(archive_path, 'rb') as f:
            archive_data = f.read()
        
        # Create deployment using proper file upload
        from appwrite.input_file import InputFile
        
        deployment = functions.create_deployment(
            function_id=FUNCTION_ID,
            code=InputFile.from_bytes(archive_data, filename="deployment.tar.gz"),
            activate=True,
            entrypoint="src/main.py"
        )
        
        print(f"✅ Deployment created successfully!")
        print(f"📋 Deployment ID: {deployment['$id']}")
        
        # Show deployment details
        if 'status' in deployment:
            print(f"📊 Status: {deployment['status']}")
        if 'buildLogs' in deployment:
            print(f"🔨 Build logs available")
        if 'size' in deployment:
            print(f"📦 Size: {deployment['size']} bytes")
            
        print(f"🌐 Function URL: {ENDPOINT}/functions/{FUNCTION_ID}/executions")
        
        # Clean up
        os.unlink(archive_path)
        
        return deployment
        
    except Exception as e:
        print(f"❌ Deployment failed: {str(e)}")
        return None

def create_function_archive():
    """Create tar.gz archive with function files"""
    
    # Create temporary archive
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        archive_path = tmp.name
    
    with tarfile.open(archive_path, 'w:gz') as tar:
        # Add source files
        tar.add('src/', arcname='src/')
        tar.add('requirements.txt', arcname='requirements.txt')
        
        print(f"📁 Added files to archive:")
        for member in tar.getnames():
            print(f"   - {member}")
    
    print(f"📦 Archive created: {archive_path}")
    return archive_path

def test_function():
    """Test the deployed function"""
    
    print("\n🧪 Testing deployed function...")
    
    client = Client()
    client.set_endpoint(ENDPOINT)
    client.set_project(PROJECT_ID)
    client.set_key(API_KEY)
    
    functions = Functions(client)
    
    try:
        # Create test execution
        test_data = {
            "files": [
                {
                    "filename": "test.pdf",
                    "content": "JVBERi0xLjQKJcOkw7zDtsOgLgoKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCgoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDQgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoKNSAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNzIgNzIwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQ1IDAwMDAwIG4gCjAwMDAwMDAzMjQgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MTcKJSVFT0Y="
                }
            ]
        }
        
        execution = functions.create_execution(
            function_id=FUNCTION_ID,
            body=json.dumps(test_data),
            async_execution=False,
            xpath="/",
            method="POST",
            headers={"content-type": "application/json"}
        )
        
        print(f"✅ Test execution completed!")
        print(f"📋 Execution ID: {execution['$id']}")
        print(f"📊 Status: {execution['status']}")
        print(f"⏱️ Duration: {execution['duration']}ms")
        
        if execution['status'] == 'completed':
            print("🎉 Function is working correctly!")
        else:
            print(f"⚠️ Execution status: {execution['status']}")
            if 'errors' in execution:
                print(f"❌ Errors: {execution['errors']}")
        
        return execution
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return None

if __name__ == "__main__":
    print("🚀 PDF Merger - Direct Appwrite Deployment")
    print("=" * 50)
    
    # Create deployment
    deployment = create_deployment()
    
    if deployment:
        print("\n" + "=" * 50)
        print("✅ Deployment completed successfully!")
        print("\n🌐 Your function is available at:")
        print(f"   {ENDPOINT}/functions/{FUNCTION_ID}/executions")
        print("\n📊 Monitor at:")
        print(f"   https://cloud.appwrite.io/console/project-{PROJECT_ID}/functions/function-{FUNCTION_ID}")
        
        # Wait a moment for deployment to process
        import time
        print("\n⏳ Waiting for deployment to process...")
        time.sleep(5)
        
        # Test the function
        test_function()
        
    else:
        print("\n❌ Deployment failed!")
        print("Please check the error messages above and try again.")
