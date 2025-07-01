import json
import os
import tempfile
import base64
import traceback
from appwrite.client import Client
from appwrite.services.storage import Storage
from .utils import merge_pdfs

def main(context):
    """
    Appwrite Function entry point
    """
    # Enhanced CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-Project, X-Appwrite-Response-Format, X-Appwrite-Key, Authorization',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    # Log request details for debugging
    context.log(f"Method: {context.req.method}")
    context.log(f"Headers: {dict(context.req.headers)}")
    context.log(f"Body length: {len(context.req.body) if context.req.body else 0}")
    
    # Handle preflight OPTIONS request
    if context.req.method == 'OPTIONS':
        context.log("Handling OPTIONS preflight request")
        return context.res.empty(200, headers)
    
    try:
        # Only allow POST method
        if context.req.method != 'POST':
            context.log(f"Method not allowed: {context.req.method}")
            return context.res.json({
                'error': f'Method not allowed. Use POST. Current method: {context.req.method}'
            }, 405, headers)

        # Get and parse request body
        try:
            # Try different ways to get the request body
            if hasattr(context.req, 'body_json') and context.req.body_json:
                data = context.req.body_json
                context.log("Using body_json")
            elif hasattr(context.req, 'body') and context.req.body:
                data = json.loads(context.req.body)
                context.log("Parsing body as JSON")
            else:
                context.log("No body found in request")
                return context.res.json({
                    'error': 'No request body found'
                }, 400, headers)
                
        except json.JSONDecodeError as e:
            context.log(f"JSON decode error: {str(e)}")
            return context.res.json({
                'error': f'Invalid JSON in request body: {str(e)}'
            }, 400, headers)

        context.log(f"Request data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")

        # Validate required fields
        if not isinstance(data, dict):
            return context.res.json({
                'error': 'Request body must be a JSON object'
            }, 400, headers)
            
        if 'files' not in data:
            return context.res.json({
                'error': 'Field "files" is required. Provide array of base64 encoded PDF files.',
                'received_keys': list(data.keys())
            }, 400, headers)

        files_data = data['files']
        if not isinstance(files_data, list):
            return context.res.json({
                'error': 'Files must be an array'
            }, 400, headers)
            
        if len(files_data) == 0:
            return context.res.json({
                'error': 'Files array cannot be empty'
            }, 400, headers)

        context.log(f"Processing {len(files_data)} files")

        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            context.log(f"Created temp directory: {temp_dir}")
            input_files = []
            
            # Process each file
            for i, file_data in enumerate(files_data):
                context.log(f"Processing file {i+1}/{len(files_data)}")
                
                if not isinstance(file_data, dict):
                    return context.res.json({
                        'error': f'Invalid file data at index {i}. Expected object, got {type(file_data)}'
                    }, 400, headers)
                
                if 'content' not in file_data:
                    return context.res.json({
                        'error': f'Missing "content" field in file at index {i}',
                        'available_keys': list(file_data.keys())
                    }, 400, headers)

                filename = file_data.get('filename', f'file_{i}.pdf')
                if not filename.lower().endswith('.pdf'):
                    filename += '.pdf'

                try:
                    # Decode base64 content
                    file_content = base64.b64decode(file_data['content'])
                    context.log(f"Decoded file {i}, size: {len(file_content)} bytes")
                    
                    # Validate it's a PDF by checking header
                    if not file_content.startswith(b'%PDF'):
                        return context.res.json({
                            'error': f'File at index {i} is not a valid PDF'
                        }, 400, headers)
                    
                    # Save to temporary file
                    file_path = os.path.join(temp_dir, f"input_{i}_{filename}")
                    with open(file_path, 'wb') as f:
                        f.write(file_content)
                    
                    input_files.append(file_path)
                    context.log(f"Saved file {i} to {file_path}")
                    
                except Exception as e:
                    context.log(f"Error processing file {i}: {str(e)}")
                    return context.res.json({
                        'error': f'Failed to decode file at index {i}: {str(e)}'
                    }, 400, headers)

            # Create output file path
            output_path = os.path.join(temp_dir, 'merged_receipts.pdf')
            context.log(f"Output path: {output_path}")
            
            # Merge PDFs
            try:
                context.log("Starting PDF merge process")
                merge_pdfs(input_files, output_path)
                context.log("PDF merge completed successfully")
                
                # Verify output file exists and has content
                if not os.path.exists(output_path):
                    raise Exception("Output file was not created")
                    
                output_size = os.path.getsize(output_path)
                if output_size == 0:
                    raise Exception("Output file is empty")
                    
                context.log(f"Output file size: {output_size} bytes")
                
            except Exception as e:
                context.log(f"PDF merge error: {str(e)}")
                context.log(f"Traceback: {traceback.format_exc()}")
                return context.res.json({
                    'error': f'Failed to merge PDFs: {str(e)}'
                }, 500, headers)

            # Read merged PDF and encode to base64
            try:
                with open(output_path, 'rb') as f:
                    merged_content = f.read()
                
                context.log(f"Read merged file, size: {len(merged_content)} bytes")
                merged_base64 = base64.b64encode(merged_content).decode('utf-8')
                
                return context.res.json({
                    'success': True,
                    'message': f'Successfully merged {len(input_files)} PDFs',
                    'file': {
                        'filename': 'merged_receipts.pdf',
                        'content': merged_base64,
                        'size': len(merged_content)
                    }
                }, 200, headers)
                
            except Exception as e:
                context.log(f"File read error: {str(e)}")
                return context.res.json({
                    'error': f'Failed to read merged PDF: {str(e)}'
                }, 500, headers)

    except Exception as e:
        context.log(f"Unexpected error: {str(e)}")
        context.log(f"Traceback: {traceback.format_exc()}")
        return context.res.json({
            'error': f'Internal server error: {str(e)}'
        }, 500, headers)