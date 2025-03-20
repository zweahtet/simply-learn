import asyncio
import os
import pathlib
import time
import uuid
import json
import pymupdf
import pymupdf4llm
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Union, List, Dict, Any, Annotated
from pydantic import BaseModel
from fastapi import status, APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Request
from fastapi.responses import JSONResponse, StreamingResponse
from services.simplify import TextSimplificationAgent, simplification_progress
from utils.file_reader import PDFMarkdownReader
from utils.vector_store import AttachmentVectorSpace
from schemas import ChunkData, CognitiveProfile
from api.dependencies import RedisDep, CurrentActiveUserDep

router = APIRouter()

# Constants
FILE_UPLOAD_DIR = "./uploads"
IMAGE_DIR = "./images"
CHUNK_SIZE = 1000  # Characters per text chunk
MAX_CONCURRENT_ADAPTATIONS = 5
CACHE_TTL = 60 * 60 * 24 * 7  # 1 week

# Create directories if they don't exist
os.makedirs(FILE_UPLOAD_DIR, exist_ok=True)
os.makedirs(IMAGE_DIR, exist_ok=True)

# ----- API Endpoints -----
@router.post("/process-file")
async def process_file(
    background_tasks: BackgroundTasks,
    redis_client: RedisDep,
    current_user: CurrentActiveUserDep,
    file: Annotated[UploadFile, File(...)],
):
    """Process an uploaded PDF file and extract content"""   
    # Check file size
    if file.size > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds 10 MB limit")

    # Check file type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type. Only PDF files are supported.")

    # # Check if the file is empty
    # if file.file.read(0) == b"":
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty")

    # # Reset file pointer to the beginning
    # file.file.seek(0)

    # Create a unique ID for this file
    file_id = uuid.uuid4().hex[:8]  # Shortened UUID for simplicity

    # Senatize file name
    file_name: str = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename)

    # Cut off the file name if it exceeds 255 characters
    if len(file_name) > 255:
        file_name = file_name[:255]

    # Create a unique file path
    # Create a more organized directory structure
    # Main user directory with file-specific subdirectory
    user_file_dir = pathlib.Path(f"{FILE_UPLOAD_DIR}/{current_user.id}/files/{file_id}")

    # Define file path and image directory
    file_path = pathlib.Path(user_file_dir / file_name)
    image_path = user_file_dir / "images"

    try:
        # Check if the file already exists
        # if os.path.exists(file_path):
        #     # return the existing simplified file id
        #     return

        # Create directories if they don't exist
        os.makedirs(file_path.parent, exist_ok=True)

        # Save the file
        with open(file_path, "wb") as f:
            f.write(await file.read())

        reader = PDFMarkdownReader()

        # load pages into llama index documents
        page_docs = reader.load_data(file_path, image_path, {"user_id": current_user.id})

        # Store documents in vector database
        attachment_vs = AttachmentVectorSpace()
        ids = attachment_vs.store_documents_in_vector_db(page_docs)

        # (assuming that documents are stored in vector)
        # Start background processing of chunks
        # Add the simplification as a background task
        simplifier = TextSimplificationAgent(
            user_id=current_user.id,
            file_id=file_id,
            verbose=True
        )

        background_tasks.add_task(
            simplifier.process_documents,
            documents=page_docs,
            cognitive_profile=current_user.cognitive_profile,
        )

        return JSONResponse(
            content={
                "fileId": file_id,
                "filename": file_name,
                "title": file.filename,
                "totalPages": len(page_docs),
            },
            status_code=status.HTTP_201_CREATED,
        )
    except Exception as e:
        # Handle errors
        print(f"Error processing file: {e}")
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}",
        )


@router.get("/simplification-progress/{file_id}")
async def get_simplification_progress(request: Request, file_id: str):
    """
    Stream document simplification progress using Server-Sent Events
    """

    async def event_generator():
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            # Get current progress
            progress = simplification_progress.get_progress(file_id)

            if not progress:
                # File not found or processing hasn't started
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                await asyncio.sleep(1)
                continue

            # Send current progress
            yield f"data: {json.dumps(progress)}\n\n"

            # If completed or error, break the loop
            if progress["completed"] or progress["error"]:
                break

            await asyncio.sleep(0.5)  # Update every 500ms

    return StreamingResponse(event_generator(), media_type="text/event-stream")
