import os
import tempfile
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

def merge_pdfs(input_files, output_file, rows=3, cols=2, h_padding=20, v_padding=20):
    """
    Merge multiple PDF files into a single PDF with receipts arranged in a grid layout
    Uses PyPDF2 for better serverless compatibility
    """
    try:
        # Import PyPDF2 for fallback
        from PyPDF2 import PdfReader, PdfWriter
        from io import BytesIO
        
        print(f"Processing {len(input_files)} files for merging")
        
        # Try pdf2image first, fall back to PyPDF2 if not available
        try:
            from pdf2image import convert_from_path
            from PIL import Image
            use_pdf2image = True
            print("Using pdf2image for processing")
        except ImportError as e:
            print(f"pdf2image not available: {e}, falling back to simple merge")
            use_pdf2image = False
        
        if use_pdf2image:
            return merge_pdfs_with_images(input_files, output_file, rows, cols, h_padding, v_padding)
        else:
            return merge_pdfs_simple(input_files, output_file)
            
    except Exception as e:
        print(f"Error in merge_pdfs: {e}")
        raise

def merge_pdfs_with_images(input_files, output_file, rows=3, cols=2, h_padding=20, v_padding=20):
    """
    Merge PDFs with image processing and grid layout
    """
    from pdf2image import convert_from_path
    from PIL import Image
    
    c = canvas.Canvas(output_file, pagesize=A4)
    page_width, page_height = A4

    cell_width = (page_width - (cols + 1) * h_padding) / cols
    cell_height = (page_height - (rows + 1) * v_padding) / rows

    current_receipts_on_page = []
    processed_count = 0

    for input_file in input_files:
        try:
            print(f"Processing {input_file}")
            
            # Convert PDF to images with optimized settings for serverless
            images = convert_from_path(
                input_file, 
                dpi=150,  # Reduced DPI for better performance
                first_page=1, 
                last_page=1,
                fmt='png',
                thread_count=1  # Single thread for serverless
            )
            
            if not images:
                print(f"⚠️ No images found in {input_file}. Skipping.")
                continue

            page_image = images[0]
            img_w, img_h = page_image.size
            print(f"Original image size: {img_w}x{img_h}")

            # Crop settings (customize as needed)
            crop_width = img_w // 2
            crop_ratio = 0.7275
            crop_height = int(img_h * crop_ratio)

            # Crop the image
            cropped_image = page_image.crop((0, 0, crop_width, crop_height))
            if cropped_image.mode != "RGB":
                cropped_image = cropped_image.convert("RGB")

            # Calculate scaling
            cropped_w, cropped_h = cropped_image.size
            scale_factor = min(cell_width / cropped_w, cell_height / cropped_h)
            enlargement_factor = 1.08
            scaled_w = cropped_w * scale_factor * enlargement_factor
            scaled_h = cropped_h * scale_factor * enlargement_factor

            current_receipts_on_page.append((cropped_image, scaled_w, scaled_h))
            processed_count += 1
            print(f"Added receipt {processed_count} to page")

            # When page is full, draw and start new page
            if len(current_receipts_on_page) == rows * cols:
                draw_receipts_on_page(
                    c, current_receipts_on_page, rows, cols,
                    cell_width, cell_height, h_padding, v_padding,
                    page_width, page_height
                )
                c.showPage()
                current_receipts_on_page = []
                print("Page completed, starting new page")

        except Exception as e:
            print(f"❌ Failed to process {input_file}: {e}")
            continue

    # Draw remaining receipts if any
    if current_receipts_on_page:
        print(f"Drawing final page with {len(current_receipts_on_page)} receipts")
        draw_receipts_on_page(
            c, current_receipts_on_page, rows, cols,
            cell_width, cell_height, h_padding, v_padding,
            page_width, page_height
        )

    c.save()
    print(f"✅ Successfully merged {processed_count} receipts into '{output_file}'")

def merge_pdfs_simple(input_files, output_file):
    """
    Simple PDF merge without image processing - fallback method
    """
    from PyPDF2 import PdfReader, PdfWriter
    
    writer = PdfWriter()
    processed_count = 0
    
    for input_file in input_files:
        try:
            print(f"Adding {input_file} to merge")
            reader = PdfReader(input_file)
            
            # Add all pages from this PDF
            for page in reader.pages:
                writer.add_page(page)
                processed_count += 1
                
        except Exception as e:
            print(f"❌ Failed to process {input_file}: {e}")
            continue
    
    # Write merged PDF
    with open(output_file, 'wb') as output:
        writer.write(output)
    
    print(f"✅ Successfully merged {len(input_files)} PDFs with {processed_count} total pages")

def draw_receipts_on_page(c, receipts, rows, cols,
                          cell_width, cell_height,
                          h_padding, v_padding,
                          page_width, page_height):
    """
    Draw receipts on a single page with proper positioning
    """
    num_receipts = len(receipts)
    current_rows = (num_receipts + cols - 1) // cols
    current_cols = min(num_receipts, cols)

    # Calculate centering offsets
    total_width = current_cols * cell_width + (current_cols - 1) * h_padding
    total_height = current_rows * cell_height + (current_rows - 1) * v_padding

    offset_x = (page_width - total_width) / 2
    offset_y = (page_height - total_height) / 2

    # Create a list to store temp files for cleanup
    temp_files = []

    try:
        for i, (img, scaled_w, scaled_h) in enumerate(receipts):
            row = i // cols
            col = i % cols

            # Calculate position
            x = offset_x + col * (cell_width + h_padding) + (cell_width - scaled_w) / 2
            y = page_height - (offset_y + (row + 1) * (cell_height + v_padding)) + v_padding + (cell_height - scaled_h) / 2

            # Save image to temporary file with optimization
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
                tmp_path = tmp.name
                # Optimize image saving for serverless
                img.save(tmp_path, "PNG", optimize=True, compress_level=6)
                temp_files.append(tmp_path)

            # Draw image on canvas
            c.drawImage(tmp_path, x, y, width=scaled_w, height=scaled_h)

    finally:
        # Clean up temporary files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception as e:
                print(f"Warning: Could not clean up temp file {temp_file}: {e}")