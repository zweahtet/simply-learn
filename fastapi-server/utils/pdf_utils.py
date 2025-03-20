# simply-learn/fastapi-server/utils/pdf_utils.py

import os
import fitz
import base64
import pathlib
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from utils.groq_utils import get_image_description_from_groq

# Constants
UPLOAD_DIR = "./uploads"
IMAGE_DIR = "./images"
CHUNK_SIZE = 1000  # Characters per text chunk

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

def extract_text_chunks(text: str, chunk_size: int = CHUNK_SIZE) -> List[str]:
    """Split text into semantic chunks (paragraphs or sections)"""
    # First split by paragraphs
    paragraphs = [p for p in text.split("\n\n") if p.strip()]

    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        # If paragraph is very long, split it further
        if len(paragraph) > chunk_size * 1.5:
            sentences = paragraph.split(". ")
            for sentence in sentences:
                if len(current_chunk) + len(sentence) <= chunk_size:
                    current_chunk += sentence + ". "
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = sentence + ". "
        # Add paragraph as a chunk if it fits
        elif len(current_chunk) + len(paragraph) <= chunk_size:
            current_chunk += paragraph + "\n\n"
        # Otherwise start a new chunk
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = paragraph + "\n\n"

    # Add the last chunk if there's anything left
    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


def extract_tables(page: fitz.Page) -> List[Dict]:
    """Extract tables from a page using PyMuPDF"""
    tables = []
    # PyMuPDF doesn't have direct table extraction, so we'll use heuristics
    # This is a placeholder - you'd need more sophisticated logic for real table detection

    # Look for potential tables based on layout
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if "lines" in block:
            # Check if block might be a table (multiple lines with similar structure)
            lines = block.get("lines", [])
            if len(lines) > 2:  # At least 3 lines for a table
                # Simple heuristic: check if spans have similar x-positions
                x_positions = []
                for line in lines:
                    spans = line.get("spans", [])
                    if spans:
                        x_positions.append([span["bbox"][0] for span in spans])

                # If we have consistent x-positions across lines, it might be a table
                if len(x_positions) >= 3 and all(len(pos) > 1 for pos in x_positions):
                    # Extract table content
                    table_text = ""
                    for line in lines:
                        line_text = ""
                        for span in line.get("spans", []):
                            line_text += span.get("text", "")
                        table_text += line_text + "\n"

                    # Add to tables list
                    tables.append(
                        {
                            "type": "table",
                            "content": table_text.strip(),
                            "bbox": block["bbox"],
                        }
                    )

    return tables


def extract_images(
    doc: fitz.Document, page: fitz.Page, file_id: str, page_num: int
) -> List[Dict]:
    """Extract images from a page using PyMuPDF"""
    images = []
    image_list = page.get_images(full=True)

    for img_idx, img_info in enumerate(image_list):
        xref = img_info[0]

        # Extract image
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]

        # Generate a unique filename
        image_ext = base_image["ext"]
        image_filename = f"{file_id}_page{page_num}_img{img_idx}.{image_ext}"
        image_path = pathlib.Path(IMAGE_DIR) / image_filename

        # Save the image
        with open(image_path, "wb") as img_file:
            img_file.write(image_bytes)

        # Get image description using Groq
        image_description = get_image_description_from_groq(image_path)

        # Convert image to base64 for frontend preview
        with open(image_path, "rb") as img_file:
            img_data = img_file.read()
            base64_img = base64.b64encode(img_data).decode("utf-8")

        images.append(
            {
                "type": "image",
                "path": image_path,
                "filename": image_filename,
                "description": image_description,
                "base64": f"data:image/{image_ext};base64,{base64_img}",
            }
        )

    return images
