#!/usr/bin/env python3
"""
Simple Appwrite Function Deployment via Requests
Menggunakan HTTP API langsung
"""

import os
import requests
import tarfile
import tempfile
import json

# Konfigurasi
PROJECT_ID = "6861b5e20027ba386475"
API_KEY = "standard_5ed75f529bfd4878d9a2e24a7716c9d5be40f20e30b14a96e337ec421d06f9d4f0db9cd10233b7209d708b2b234bf814b1cbc53a2c6a3784d05fb205e2d2da8d54ed65604b3c21bfa125ccf2eabd9da5618403dfa49a1a115d0b9c986fc7fe1d7f4a70c60873efe6864b18291f7415c530f6de496d960491ca6c184e6acc4268"
ENDPOINT = "https://syd.cloud.appwrite.io/v1"
FUNCTION_ID = "68617ea70030b8ef6bbe"

def create_deployment():
    """Create deployment using direct HTTP API"""
    
    print("🚀 PDF Merger - Direct API Deployment")
    print("=" * 50)
    
    headers = {
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': API_KEY,
    }
    
    try:
        # Get function info first
        print("📋 Getting function information...")
        func_url = f"{ENDPOINT}/functions/{FUNCTION_ID}"
        response = requests.get(func_url, headers=headers)
        
        if response.status_code == 200:
            function = response.json()
            print(f"✅ Function found: {function['name']}")
            print(f"🔧 Runtime: {function['runtime']}")
            print(f"⏱️ Timeout: {function['timeout']}s")
        else:
            print(f"❌ Failed to get function: {response.text}")
            return False
        
        # Update function configuration
        print("\n⚙️ Updating function configuration...")
        update_data = {
            'name': 'PDF Merger',
            'runtime': 'python-3.12',
            'execute': ['any'],
            'events': [],
            'schedule': '',
            'timeout': 900,
            'enabled': True,
            'logging': True,
            'entrypoint': 'src/main.py',
            'commands': 'apt-get update && apt-get install -y poppler-utils && pip install -r requirements.txt',
            'scopes': ['any']
        }
        
        update_response = requests.put(func_url, headers=headers, json=update_data)
        if update_response.status_code == 200:
            print("✅ Function configuration updated")
        else:
            print(f"⚠️ Function update failed: {update_response.text}")
            print("📋 Continuing with deployment...")
        
        # Create deployment archive
        print("\n📦 Creating deployment archive...")
        archive_path = create_function_archive()
        
        # Create deployment
        print("🚀 Creating new deployment...")
        deploy_url = f"{ENDPOINT}/functions/{FUNCTION_ID}/deployments"
        
        files = {
            'code': ('deployment.tar.gz', open(archive_path, 'rb'), 'application/gzip'),
        }
        
        data = {
            'entrypoint': 'src/main.py',
            'activate': 'true'
        }
        
        deploy_headers = {
            'X-Appwrite-Project': PROJECT_ID,
            'X-Appwrite-Key': API_KEY,
        }
        
        deploy_response = requests.post(deploy_url, headers=deploy_headers, files=files, data=data)
        
        if deploy_response.status_code in [200, 201]:
            deployment = deploy_response.json()
            print(f"✅ Deployment created successfully!")
            print(f"📋 Deployment ID: {deployment['$id']}")
            
            if 'status' in deployment:
                print(f"📊 Status: {deployment['status']}")
            if 'size' in deployment:
                print(f"📦 Size: {deployment['size']} bytes")
                
            print(f"\n🌐 Function URL:")
            print(f"   {ENDPOINT}/functions/{FUNCTION_ID}/executions")
            print(f"\n📊 Monitor at:")
            print(f"   https://cloud.appwrite.io/console/project-{PROJECT_ID}/functions/function-{FUNCTION_ID}")
            
            # Clean up
            os.unlink(archive_path)
            files['code'][1].close()
            
            # Test the deployment
            print("\n⏳ Waiting for deployment to process...")
            import time
            time.sleep(10)
            
            test_deployment()
            
            return True
            
        else:
            print(f"❌ Deployment failed: {deploy_response.status_code}")
            print(f"Response: {deploy_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error during deployment: {str(e)}")
        return False

def create_function_archive():
    """Create tar.gz archive with function files"""
    
    # Create temporary archive
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        archive_path = tmp.name
    
    with tarfile.open(archive_path, 'w:gz') as tar:
        # Add source files
        if os.path.exists('src/'):
            tar.add('src/', arcname='src/')
        if os.path.exists('requirements.txt'):
            tar.add('requirements.txt', arcname='requirements.txt')
        
        print(f"📁 Added files to archive:")
        for member in tar.getnames():
            print(f"   - {member}")
    
    file_size = os.path.getsize(archive_path)
    print(f"📦 Archive created: {archive_path} ({file_size} bytes)")
    return archive_path

def test_deployment():
    """Test the deployed function"""
    
    print("\n🧪 Testing deployed function...")
    
    headers = {
        'X-Appwrite-Project': PROJECT_ID,
        'Content-Type': 'application/json'
    }
    
    test_data = {
        "files": [
            {
                "filename": "test.pdf",
                "content": "JVBERi0xLjQKJcOkw7zDtsOgLgoKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCgoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDQgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoKNSAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNzIgNzIwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQ1IDAwMDAwIG4gCjAwMDAwMDAzMjQgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MTcKJSVFT0Y="
            }
        ]
    }
    
    try:
        exec_url = f"{ENDPOINT}/functions/{FUNCTION_ID}/executions"
        response = requests.post(exec_url, headers=headers, json=test_data, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Test execution successful!")
            print(f"📋 Response: {result}")
        else:
            print(f"⚠️ Test failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Test error: {str(e)}")

if __name__ == "__main__":
    success = create_deployment()
    
    if success:
        print("\n" + "=" * 50)
        print("🎉 Deployment completed successfully!")
        print("Your PDF Merger function is ready to use!")
    else:
        print("\n" + "=" * 50)
        print("❌ Deployment failed!")
        print("Please check the error messages and try again.")
