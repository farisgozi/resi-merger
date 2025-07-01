#!/usr/bin/env python3
"""
Test script for PDF Merger Appwrite Function
"""

import base64
import json
import requests
import os

# Configuration
PROJECT_ID = "6861b5e20027ba386475"
FUNCTION_ID = "68617ea70030b8ef6bbe"
ENDPOINT = "https://syd.cloud.appwrite.io/v1"

def read_pdf_as_base64(file_path):
    """Read PDF file and convert to base64"""
    with open(file_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def test_pdf_merger():
    """Test the PDF merger function"""
    
    # Function execution URL
    url = f"{ENDPOINT}/functions/{FUNCTION_ID}/executions"
    
    # Headers
    headers = {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': PROJECT_ID,
    }
    
    # Test data - you'll need to provide actual PDF files
    test_files = []
    
    # Add sample PDFs if they exist
    sample_dir = "samples"
    if os.path.exists(sample_dir):
        for filename in os.listdir(sample_dir):
            if filename.lower().endswith('.pdf'):
                file_path = os.path.join(sample_dir, filename)
                pdf_content = read_pdf_as_base64(file_path)
                test_files.append({
                    'filename': filename,
                    'content': pdf_content
                })
    
    if not test_files:
        # Create a minimal test case with dummy data
        print("⚠️  No sample PDFs found. Creating test with dummy data...")
        test_files = [
            {
                'filename': 'test1.pdf',
                'content': 'JVBERi0xLjQKJcOkw7zDtsOgLgoKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCgoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovS2lkcyBbMyAwIFJdCi9Db3VudCAxCj4+CmVuZG9iagoKMyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDIgMCBSCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDQgMCBSCj4+Cj4+Ci9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iagoKNSAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVAovRjEgMTIgVGYKNzIgNzIwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQ1IDAwMDAwIG4gCjAwMDAwMDAzMjQgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MTcKJSVFT0Y='
            }
        ]
    
    # Request payload
    payload = {
        'files': test_files
    }
    
    print(f"🧪 Testing PDF Merger with {len(test_files)} files...")
    print(f"📍 URL: {url}")
    
    try:
        # Make request
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"📊 Status Code: {response.status_code}")
        print(f"📝 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"📄 Message: {result.get('message', 'No message')}")
            
            if 'file' in result:
                file_info = result['file']
                print(f"📁 Output file: {file_info.get('filename')}")
                print(f"📏 File size: {file_info.get('size')} bytes")
                
                # Optionally save the result
                output_path = "merged_output.pdf"
                if 'content' in file_info:
                    with open(output_path, 'wb') as f:
                        f.write(base64.b64decode(file_info['content']))
                    print(f"💾 Saved merged PDF to: {output_path}")
        else:
            print("❌ Error!")
            try:
                error_data = response.json()
                print(f"🔍 Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"🔍 Error response: {response.text}")
                
    except requests.exceptions.Timeout:
        print("⏰ Request timed out")
    except requests.exceptions.RequestException as e:
        print(f"🌐 Network error: {e}")
    except Exception as e:
        print(f"💥 Unexpected error: {e}")

if __name__ == "__main__":
    test_pdf_merger()
