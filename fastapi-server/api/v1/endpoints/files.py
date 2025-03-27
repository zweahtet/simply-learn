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
from api.dependencies import RedisDep, CurrentActiveUserDep, SupabaseAsyncClientDep

router = APIRouter()

# Constants
TEMP_FILE_DIR = "./temp_files"
IMAGE_DIR = "./images"
CHUNK_SIZE = 1000  # Characters per text chunk
MAX_CONCURRENT_ADAPTATIONS = 5
CACHE_TTL = 60 * 60 * 24 * 7  # 1 week

# Create directories if they don't exist
os.makedirs(TEMP_FILE_DIR, exist_ok=True)
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


@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    redis_client: RedisDep,
    supabase_client: SupabaseAsyncClientDep,
    current_user: CurrentActiveUserDep,
    file_id: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
):
    """Process an uploaded PDF file and extract content"""   
    try:
        # Senatize file name
        # filename: str = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename)
        filename = file.filename

        # Cut off the file name if it exceeds 255 characters
        if len(filename) > 255:
            filename = filename[:255]

        # create a temp directory for the user
        temp_user_dir = pathlib.Path(f"{TEMP_FILE_DIR}/{current_user.id}")
        temp_file_dir = temp_user_dir / file_id
        os.makedirs(temp_file_dir, exist_ok=True)

        # Define file path
        file_path = pathlib.Path(temp_file_dir / filename)

        # Create directories if they don't exist
        os.makedirs(file_path.parent, exist_ok=True)

        # Save the file in temporary directory
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Store the file in Supabase storage
        supabase_upload_response = await supabase_client.storage.from_(
            "attachments"
        ).upload(
            path=f"attachments/{current_user.id}/{file_id}/{filename}",
            file=file_path,
        )

        if supabase_upload_response.path is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to Supabase",
            )

        # Set initial status in Redis
        status_key = f"summarization:status:{current_user.id}:{file_id}"
        redis_client.set(status_key, "pending")

        # Define background task that handles all processing
        async def process_file():
            try:
                # update status to processing
                redis_client.set(status_key, "processing")

                # define image path
                image_path = temp_file_dir / "images"

                # extract text from the PDF file
                reader = PDFMarkdownReader()
                page_docs = reader.load_data(
                    file_path, image_path, {"user_id": current_user.id}
                )

                # Store documents in vector database
                attachment_vs = AttachmentVectorSpace()
                ids = attachment_vs.store_documents_in_vector_db(page_docs)

                # set status as "summarizing" in Redis
                redis_client.set(status_key, "summarizing")

                # Create the summarizer
                summarizer = DocumentSummarizer(
                    user_id=current_user.id,
                    file_id=file_id,
                    verbose=True,
                )

                # Process the pages
                summary = summarizer.process_pages(pages=page_docs)

                # Store as a file in the same directory structure
                summary_file_path = temp_file_dir / "summary.json"

                # Ensure directory exists
                os.makedirs(os.path.dirname(summary_file_path), exist_ok=True)

                # Create the summary data
                summary_data = {
                    "file_id": file_id,
                    "summary": summary,
                    "completed_at": datetime.now().isoformat(),
                }

                # Store the summary in Supabase
                supabase_summary_response = await supabase_client.storage.from_(
                    "attachments"
                ).upload(
                    path=f"attachments/{current_user.id}/{file_id}/summary.json",
                    file=json.dumps(summary_data).encode("utf-8"),
                )
                if supabase_summary_response.path is None:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to upload summary to Supabase",
                    )

                # Update status in Redis to "completed"
                redis_client.set(status_key, "completed")

                # Clean up the temporary files
                os.unlink(file_path)
                for image_file in image_path.glob("*"):
                    os.unlink(image_file)
                os.rmdir(image_path)
                os.rmdir(temp_file_dir)

            except Exception as e:
                # Log the error
                print(f"Error in summarization task: {e}")

                # Set status to "error" in Redis
                redis_client.set(status_key, "error")

                # Save error details to a file
                try:
                    error_file_path = temp_file_dir / "summary_error.json"
                    error_data = {
                        "error": str(e),
                        "timestamp": datetime.now().isoformat()
                    }
                    with open(error_file_path, "w", encoding="utf-8") as f:
                        json.dump(error_data, f, ensure_ascii=False, indent=2)
                except Exception as write_error:
                    print(f"Error writing error file: {write_error}")

        # Run the summarization in the background
        background_tasks.add_task(process_file)
        return JSONResponse(
            content={
                "id": file_id,
                "status": "pending",
            },
            status_code=status.HTTP_202_ACCEPTED,
        )
    except Exception as e:
        # Handle any errors that occur during file processing
        return JSONResponse(
            content={
                "message": str(e),
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/{file_id}/summary", description="Get the summary of a file")
async def get_summary(
    file_id: str,
    redis_client: RedisDep,
    current_user: CurrentActiveUserDep,
    supabase_client: SupabaseAsyncClientDep,
):
    # Check status in Redis
    status_key = f"summarization:status:{current_user.id}:{file_id}"
    task_status = redis_client.get(status_key)

    if task_status is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No processing found for file ID: {file_id}",
        )

    # User directory where files are stored
    temp_file_dir = pathlib.Path(f"{TEMP_FILE_DIR}/{current_user.id}/files/{file_id}")
    summary_file_path = temp_file_dir / "summary.json"

    # Handle cases where processing is not yet complete
    if task_status in ["pending", "processing", "summarizing"]:
        status_message = {
            "pending": "File is queued for processing",
            "processing": "PDF parsing is in progress",
            "summarizing": "Creating summary of document content",
        }.get(task_status, "Processing is in progress")

        return JSONResponse(
            content={
                "status": task_status,
                "message": status_message,
                "fileId": file_id,
            },
            status_code=status.HTTP_202_ACCEPTED,
        )

    # If completed, return the summary
    elif task_status == "completed":
        # First try to read from local file if it exists
        if summary_file_path.exists():
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
                # If local file read fails, try fetching from Supabase
                pass

        # If we have Supabase client and local file doesn't exist or couldn't be read
        if supabase_client:
            try:
                # Try to get the file from Supabase storage
                file_path = f"attachments/{current_user.id}/{file_id}/summary.json"
                summary_bytes = await supabase_client.storage.from_(
                    "attachments"
                ).download(file_path)

                if summary_bytes:
                    summary_data = json.loads(summary_bytes.decode("utf-8"))
                    return JSONResponse(
                        content={
                            "status": "completed",
                            "fileId": file_id,
                            "summary": summary_data["summary"],
                            "completedAt": summary_data["completed_at"],
                        },
                        status_code=status.HTTP_200_OK,
                    )
            except Exception as e:
                return JSONResponse(
                    content={
                        "status": "error",
                        "message": f"Error retrieving summary file: {str(e)}",
                    },
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # If we get here, the summary couldn't be found
        return JSONResponse(
            content={
                "status": "error",
                "message": "Summary is marked as completed, but file could not be found",
            },
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # If there was an error
    elif task_status == "error":
        error_file_path = temp_file_dir / "summary_error.json"
        error_message = "Unknown error occurred during processing"

        if error_file_path.exists():
            try:
                with open(error_file_path, "r") as f:
                    error_data = json.load(f)
                    error_message = error_data.get("error", error_message)
            except Exception:
                pass

        # If local error file doesn't exist, we could also check Supabase here
        return JSONResponse(
            content={"status": "error", "message": error_message},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Fallback for unexpected status values
    else:
        return JSONResponse(
            content={
                "status": "unknown",
                "message": f"Unknown processing status: {task_status}",
                "fileId": file_id,
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# @router.get("/simplification-progress/{file_id}")
# async def get_simplification_progress(request: Request, file_id: str):
#     """
#     Stream document simplification progress using Server-Sent Events
#     """

#     async def event_generator():
#         while True:
#             # Check if client disconnected
#             if await request.is_disconnected():
#                 break

#             # Get current progress
#             progress = simplification_progress.get_progress(file_id)

#             if not progress:
#                 # File not found or processing hasn't started
#                 yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
#                 await asyncio.sleep(1)
#                 continue

#             # Send current progress
#             yield f"data: {json.dumps(progress)}\n\n"

#             # If completed or error, break the loop
#             if progress["completed"] or progress["error"]:
#                 break

#             await asyncio.sleep(0.5)  # Update every 500ms

#     return StreamingResponse(event_generator(), media_type="text/event-stream")
