import asyncio
import os
import pathlib
import time
import uuid
import json
import pymupdf
import pymupdf4llm
import re
import logging
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
from api.dependencies import RedisDep, CurrentAuthContext, SupabaseAsyncClientDep

logger = logging.getLogger(__name__)

# Initialize FastAPI router
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


@router.post("/{file_id}/process")
async def process_file(
    background_tasks: BackgroundTasks,
    redis_client: RedisDep,
    auth_context: CurrentAuthContext,
    file_id: str,
    file: Annotated[UploadFile, File(...)],
):
    """Process an uploaded PDF file and extract content"""
    current_user = auth_context.user

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

        # Set initial status in Redis
        status_key = f"file:status:{current_user.id}:{file_id}"
        redis_client.set(status_key, "pending")

        # Define background task that handles processing
        async def process_file_task():
            try:
                # update status to processing
                redis_client.set(status_key, "processing")

                # define image path
                image_path = temp_file_dir / "images"

                # extract text from the PDF file
                reader = PDFMarkdownReader()
                page_docs = reader.load_data(
                    file_path,
                    image_path,
                    {"user_id": current_user.id, "file_id": file_id},
                )

                # TODO: store the images in Supabase

                # Store documents in vector database
                attachment_vs = AttachmentVectorSpace()
                ids = attachment_vs.store_documents_in_vector_db(page_docs)

                # set status as "processed" in Redis
                redis_client.set(status_key, "processed")

                # Store metadata in Redis for later use by summarization
                meta_key = f"file:metadata:{current_user.id}:{file_id}"
                redis_client.set(
                    meta_key,
                    json.dumps(
                        {
                            "filename": filename,
                            "path": str(file_path),
                            "image_path": str(image_path),
                            "created_at": datetime.now().isoformat(),
                        }
                    ),
                )

            except Exception as e:
                # Log the error
                logger.error(f"Error in processing file task: {e}")

                # Set status to "error" in Redis
                redis_client.set(status_key, "error")

                # Save error details to a file
                try:
                    error_file_path = temp_file_dir / "summary_error.json"
                    error_data = {
                        "error": str(e),
                        "timestamp": datetime.now().isoformat(),
                    }
                    with open(error_file_path, "w", encoding="utf-8") as f:
                        json.dump(error_data, f, ensure_ascii=False, indent=2)
                except Exception as write_error:
                    logger.error(f"Error writing error file: {write_error}")

        # Run the summarization in the background
        background_tasks.add_task(process_file_task)
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


@router.post("/{file_id}/summarize")
async def summarize_file(
    background_tasks: BackgroundTasks,
    redis_client: RedisDep,
    auth_context: CurrentAuthContext,
    file_id: str,
):
    """Generate a summary for a previously processed file"""
    current_user = auth_context.user
    supabase_client = auth_context.supabase

    logger.info(f"User ID type: {type(current_user.id)}, Value: {current_user.id}")

    # Check if the file has been processed
    status_key = f"file:status:{current_user.id}:{file_id}"
    file_status = redis_client.get(status_key)

    if not file_status or file_status == "error":
        return JSONResponse(
            content={
                "status": "error",
                "message": "File not found or processing failed. Process the file first.",
            },
            status_code=status.HTTP_404_NOT_FOUND,
        )

    if file_status in ["pending", "processing"]:
        return JSONResponse(
            content={
                "status": "pending",
                "message": "File is still being processed. Try again when processing is complete.",
            },
            status_code=status.HTTP_409_CONFLICT,
        )

    # Set up summarization status
    summary_status_key = f"summarization:status:{current_user.id}:{file_id}"
    redis_client.set(summary_status_key, "pending")

    # Define background task for summarization
    async def summarize_content():
        try:
            # Update status
            redis_client.set(summary_status_key, "summarizing")

            # Get file metadata
            meta_key = f"file:metadata:{current_user.id}:{file_id}"
            metadata = json.loads(redis_client.get(meta_key) or "{}")

            if not metadata:
                raise Exception("File metadata not found")

            # Retrieve documents from vector store
            logger.info(f"Retrieving documents for file ID: {file_id}")
            attachment_vs = AttachmentVectorSpace()
            page_docs = attachment_vs.get_documents_by_file_id(file_id)

            if not page_docs:
                raise Exception("No document content found in vector store")

            # Create the summarizer
            summarizer = DocumentSummarizer(
                user_id=current_user.id,
                file_id=file_id,
                verbose=True,
            )

            # Process the pages
            logger.info(f"Processing {len(page_docs)} pages for summarization")
            summary = summarizer.process_pages(pages=page_docs)

            # Create the summary data
            summary_data = {
                "file_id": file_id,
                "summary": summary,
                "created_at": datetime.now().isoformat(),
            }

            # Store the summary in Supabase
            logger.info(
                f"Creating Supabase Signed Upload Token for file ID: {file_id} ..."
            )
            _, _, token, path = await supabase_client.storage.from_(
                "attachments"
            ).create_signed_upload_url(
                path=f"{current_user.id}/{file_id}/summary.json",
            )
            logger.info(f"Supabase Signed Upload Token created.")
            logger.info(f"Storing summary in Supabase for file ID: {file_id} ...")
            upload_summary_response = await supabase_client.storage.from_(
                "attachments"
            ).upload(
                path=path,
                token=token,
                file=json.dumps(summary_data).encode("utf-8"),
                file_options={
                    "upsert": "true",
                    "content-type": "application/json",
                },
            )
            if upload_summary_response.path is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upload summary to Supabase",
                )

            # Update status in Redis to "completed"
            logger.info(f"Summary uploaded to Supabase: {upload_summary_response.path}")
            redis_client.set(summary_status_key, "completed")

            logger.info(f"Successfully summarized file ID: {file_id}")
        except Exception as e:
            # Log the error
            logger.error(f"Error in summarization task: {e}")

            # Set status to "error" in Redis
            redis_client.set(summary_status_key, "error")

            # Save error details
            try:
                temp_file_dir = pathlib.Path(
                    f"{TEMP_FILE_DIR}/{current_user.id}/{file_id}"
                )
                error_file_path = temp_file_dir / "summary_error.json"
                os.makedirs(os.path.dirname(error_file_path), exist_ok=True)
                error_data = {"error": str(e), "timestamp": datetime.now().isoformat()}
                with open(error_file_path, "w", encoding="utf-8") as f:
                    json.dump(error_data, f, ensure_ascii=False, indent=2)
            except Exception as write_error:
                logger.error(f"Error writing error file: {write_error}")

    # Run the summarization in the background
    logger.info(f"Starting background summarization task for file ID: {file_id}")
    background_tasks.add_task(summarize_content)
    return JSONResponse(
        content={
            "id": file_id,
            "status": "pending",
            "message": "Summarization started",
        },
        status_code=status.HTTP_202_ACCEPTED,
    )


@router.get("/{file_id}/summary", description="Get the summary of a file")
async def get_summary(
    file_id: str,
    redis_client: RedisDep,
    auth_context: CurrentAuthContext,
):
    """Get the summary of a file"""
    current_user = auth_context.user
    supabase_client = auth_context.supabase

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
        try:
            # Try to get the file from Supabase storage
            file_path = f"{current_user.id}/{file_id}/summary.json"
            summary_bytes = await supabase_client.storage.from_("attachments").download(
                file_path
            )

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

            # the summary couldn't be found
            return JSONResponse(
                content={
                    "status": "error",
                    "message": "Summary is marked as completed, but file could not be found",
                },
                status_code=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return JSONResponse(
                content={
                    "status": "error",
                    "message": f"Error retrieving summary file: {str(e)}",
                },
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # If there was an error
    elif task_status == "error":
        # log the error
        logger.error(f"Error getting summary for file ID: {file_id} - {task_status}")
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
