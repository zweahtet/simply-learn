import asyncio
import os
import pathlib
import time
import uuid
import json
import pymupdf
import pymupdf4llm
import re
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Union, List, Dict, Any, Annotated
from pydantic import BaseModel, Field
from fastapi import status, APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks, Request, Form
from fastapi.responses import JSONResponse, StreamingResponse
from services.simplify import TextSimplificationAgent, simplification_progress
from services.summarize import DocumentSummarizer
from utils.file_reader import PDFMarkdownReader
from utils.vector_store import AttachmentVectorSpace
from schemas import BaseRequest, BaseResponse
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
class FileUploadResponse(BaseResponse):
    """
    Response schema for file upload.
    """

    status: str = Field(description="Status of the file upload")
    message: Optional[str] = Field(description="Additional message or error details")
    file_id: Optional[str] = Field(
        description="Unique identifier for the uploaded file"
    )


@router.post("/process-file")
async def process_file(
    background_tasks: BackgroundTasks,
    redis_client: RedisDep,
    current_user: CurrentActiveUserDep,
    file_id: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)]
):
    """Process an uploaded PDF file and extract content"""   
    try:
        # Create a unique ID for this file
        # file_id = uuid.uuid4().hex[:8]  # Shortened UUID for simplicity

        # Senatize file name
        # filename: str = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename)
        filename = file.filename

        # Cut off the file name if it exceeds 255 characters
        if len(filename) > 255:
            filename = filename[:255]

        # Main user directory with file-specific subdirectory
        user_file_dir = pathlib.Path(
            f"{FILE_UPLOAD_DIR}/{current_user.id}/files/{file_id}"
        )

        # Define file path and image directory
        file_path = pathlib.Path(user_file_dir / filename)
        image_path = user_file_dir / "images"

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
        # simplifier = TextSimplificationAgent(
        #     user_id=current_user.id,
        #     file_id=file_id,
        #     verbose=True
        # )

        # background_tasks.add_task(
        #     simplifier.process_documents,
        #     documents=page_docs,
        #     cognitive_profile=current_user.cognitive_profile,
        # )

        # Define a function to run summarization and store results
        async def summarize_and_store():
            try:
                # Set status as "in-progress" in Redis
                status_key = f"summarization:status:{current_user.id}:{file_id}"
                redis_client.set(status_key, "in_progress")

                # Create the summarizer
                summarizer = DocumentSummarizer(
                    user_id=current_user.id,
                    file_id=file_id,
                    verbose=True,
                )

                # Process the pages
                summary = summarizer.process_pages(pages=page_docs)

                # Store as a file in the same directory structure
                summary_file_path = user_file_dir / "summary.json"

                # Ensure directory exists
                os.makedirs(os.path.dirname(summary_file_path), exist_ok=True)

                # Create the summary data
                summary_data = {
                    "summary": summary,
                    "completed_at": datetime.now().isoformat(),
                    "file_id": file_id,
                    "filename": filename,
                }

                # Save to file
                with open(summary_file_path, "w", encoding="utf-8") as f:
                    json.dump(summary_data, f, ensure_ascii=False, indent=2)

                # Update status in Redis to "completed"
                redis_client.set(status_key, "completed")

            except Exception as e:
                # Log the error
                print(f"Error in summarization task: {e}")

                # Set status to "error" in Redis
                redis_client.set(status_key, "error")

                # Save error details to a file
                try:
                    error_file_path = user_file_dir / "summary_error.json"
                    error_data = {
                        "error": str(e),
                        "timestamp": datetime.now().isoformat()
                    }
                    with open(error_file_path, "w", encoding="utf-8") as f:
                        json.dump(error_data, f, ensure_ascii=False, indent=2)
                except Exception as write_error:
                    print(f"Error writing error file: {write_error}")

        # Run the summarization in the background
        background_tasks.add_task(summarize_and_store)
        return JSONResponse(
            content={
                "id": file_id,
                "name": filename,
                "type": file.content_type,
                "size": file.size,
            },
            status_code=status.HTTP_201_CREATED,
        )
    except Exception as e:
        # Handle any errors that occur during file processing
        return JSONResponse(
            content={
                "message": str(e),
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


@router.get("/{file_id}/summary", description="Get the summary of a file")
async def get_summary(
    file_id: str,
    redis_client: RedisDep,
    current_user: CurrentActiveUserDep
):
    # Check status in Redis
    status_key = f"summarization:status:{current_user.id}:{file_id}"
    task_status = redis_client.get(status_key)

    # User directory where files are stored
    user_file_dir = pathlib.Path(f"{FILE_UPLOAD_DIR}/{current_user.id}/files/{file_id}")
    summary_file_path = user_file_dir / "summary.json"

    # If still in progress
    if task_status == "in_progress":
        return JSONResponse(
            content={
                "status": "processing",
                "message": "Summarization is still in progress.",
            },
            status_code=status.HTTP_202_ACCEPTED,
        )

    # If completed, return the summary from the file
    elif task_status == "completed" and summary_file_path.exists():
        try:
            with open(summary_file_path, "r") as f:
                summary_data = json.load(f)

            return JSONResponse(
                content={
                    "status": "completed",
                    "fileId": file_id,
                    "summary": summary_data["summary"],
                    "completedAt": summary_data["completed_at"],
                },
                status_code=status.HTTP_200_OK,
            )
        except (FileNotFoundError, json.JSONDecodeError) as e:
            # Handle file reading errors
            return JSONResponse(
                content={
                    "status": "error",
                    "message": f"Error reading summary file: {str(e)}",
                },
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # If there was an error
    elif task_status == "error":
        error_file_path = user_file_dir / "summary_error.json"
        error_message = "Unknown error occurred"

        if error_file_path.exists():
            try:
                with open(error_file_path, "r") as f:
                    error_data = json.load(f)
                    error_message = error_data.get("error", error_message)
            except:
                pass

        return JSONResponse(
            content={"status": "error", "message": error_message},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # If not found or other issue
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No summarization found for file ID: {file_id}",
        )
