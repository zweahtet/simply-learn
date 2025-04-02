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
from fastapi import (
    status,
    APIRouter,
    UploadFile,
    File,
    HTTPException,
    Depends,
    BackgroundTasks,
    Request,
    Form,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import JSONResponse, StreamingResponse
from services.simplify import TextSimplificationAgent, simplification_progress
from services.summarize import DocumentSummarizer
from utils.file_reader import PDFMarkdownReader
from utils.vector_store import AttachmentVectorSpace
from schemas import BaseRequest, BaseResponse
from api.dependencies import RedisDep, CurrentAuthContext, SupabaseAsyncClientDep
from celery_main import celery_app

logger = logging.getLogger(__name__)

# Initialize FastAPI router
router = APIRouter()

# Constants
TEMP_FILE_DIR = "./temp_files"
IMAGE_DIR = "./images"
CHUNK_SIZE = 1000  # Characters per text chunk
MAX_CONCURRENT_ADAPTATIONS = 5
CACHE_TTL = 3600  # 1 hour

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
    redis_client: RedisDep,
    auth_context: CurrentAuthContext,
    supabase_client: SupabaseAsyncClientDep,
    file_id: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
):
    """Upload a file, queue a processing task in celery, and return the file id for tracking"""
    current_user = auth_context.user
    await supabase_client.auth.set_session(auth_context.access_token, refresh_token="")

    try:
        # TODO: Sanitize file name
        filename = file.filename
        if not filename:
            # set the file id as the filename if not provided
            filename = file_id = file.content_type.split("/")[-1]

        # Store the file in a temporary directory
        logger.info(f"Saving file {file_id} to temporary location ...")
        temp_user_dir = pathlib.Path(f"{TEMP_FILE_DIR}/{current_user.id}")
        temp_file_dir = temp_user_dir / file_id
        os.makedirs(temp_file_dir, exist_ok=True)
        temp_file_path = temp_file_dir / filename
        with open(temp_file_path, "wb") as f:
            f.write(await file.read())
        logger.info(f"File saved at: {temp_file_path}")

        # Create storage path
        logger.info(f"Saving file {file_id} to Supabase storage ...")
        supabase_storage_path = f"{current_user.id}/{file_id}/{filename}"
        supabase_signed_upload_url = await supabase_client.storage.from_(
            "attachments"
        ).create_signed_upload_url(
            path=supabase_storage_path,
        )
        supabase_upload_response = await supabase_client.storage.from_(
            "attachments"
        ).upload_to_signed_url(
            path=supabase_signed_upload_url.get("path"),
            token=supabase_signed_upload_url.get("token"),
            file=temp_file_path,
            file_options={
                "upsert": "true",
                "content-type": file.content_type,
            },
        )
        logger.info(
            f"File uploaded to Supabase storage: {supabase_upload_response.path}"
        )

        # Set initial status in Redis
        file_processing_status_key = (
            f"document-processing:status:{current_user.id}:{file_id}"
        )
        redis_client.set(file_processing_status_key, "pending", ex=CACHE_TTL)

        # Queue the processing task in Celery
        try:
            # Define temp images path for the task
            temp_images_path = str(temp_file_dir / "images")

            # Queue document processing task
            task = celery_app.send_task(
                name="tasks.document_processing.process_document",
                args=[
                    str(temp_file_path),
                    temp_images_path,
                    file_id,
                    auth_context.access_token,
                ],
            )

            logger.info(f"Celery task {task.id} created for processing file: {file_id}")

            return JSONResponse(
                content={
                    "id": file_id,
                    "task_id": task.id,
                },
                status_code=status.HTTP_202_ACCEPTED,
            )
        except Exception as task_error:
            logger.error(f"Failed to queue task: {task_error}")
            redis_client.set(file_processing_status_key, "error", ex=CACHE_TTL)
            return JSONResponse(
                content={
                    "id": file_id,
                    "message": "Failed to queue processing task",
                },
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    except Exception as e:
        # Handle any errors that occur during file processing setup
        logger.error(f"Error in process_file endpoint: {e}")
        return JSONResponse(
            content={
                "id": file_id,
                "message": str(e),
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.post("/{file_id}/process")
async def process_file(
    background_tasks: BackgroundTasks,
    redis_client: RedisDep,
    auth_context: CurrentAuthContext,
    supabase_client: SupabaseAsyncClientDep,
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
        temp_file_path = pathlib.Path(temp_file_dir / filename)

        # Save the file in temporary directory
        # Save file using chunked reading to handle large files
        # chunk_size = 1024 * 1024  # 1MB chunks
        # with open(temp_file_path, "wb") as buffer:
        #     while content := await file.read(chunk_size):
        #         buffer.write(content)
        # logger.info(f"File saved at: {temp_file_path}")

        with open(temp_file_path, "wb") as f:
            f.write(await file.read())

        # Set initial status in Redis
        status_key = f"file:status:{current_user.id}:{file_id}"
        redis_client.set(status_key, "pending", ex=CACHE_TTL)

        # Define background task that handles processing
        async def process_file_task():
            try:
                # update status to processing
                redis_client.set(status_key, "processing", ex=CACHE_TTL)
                logger.info(f"Processing file: {file_id}")

                # define image path
                temp_image_dir = temp_file_dir / "images"

                # extract text from the PDF file
                logger.info(f"Extracting data from: {temp_file_path}")
                reader = PDFMarkdownReader()
                page_docs = reader.load_data(
                    temp_file_path,
                    temp_image_dir,
                    {"user_id": current_user.id, "file_id": file_id},
                )
                logger.info(f"Extracted {len(page_docs)} pages from file: {file_id}")

                # TODO: store the images in Supabase
                logger.info(
                    f"Creating Supabase Signed Upload Token for file ID: {file_id} ..."
                )

                # Set the client's session with the user's access token
                try:
                    await supabase_client.auth.set_session(
                        auth_context.access_token, refresh_token=""
                    )
                except Exception as e:
                    logger.error(f"Error setting Supabase session: {e}")
                    raise

                # Upload images to Supabase from image directory
                for image_file in os.listdir(temp_image_dir):
                    temp_image_path = temp_image_dir / image_file
                    if temp_image_path.is_file():
                        # generate signed upload url and token for secure upload
                        signed_upload_response = await supabase_client.storage.from_(
                            "attachments"
                        ).create_signed_upload_url(
                            path=f"{current_user.id}/{file_id}/images/{image_file}",
                        )

                        logger.info(
                            f"Uploading image {image_file} to Supabase Storage ..."
                        )
                        upload_response = await supabase_client.storage.from_(
                            "attachments"
                        ).upload_to_signed_url(
                            path=signed_upload_response.get("path"),
                            token=signed_upload_response.get("token"),
                            file=temp_image_path,
                            file_options={
                                "upsert": "true",
                                "content-type": "image/png",
                            },
                        )

                        if upload_response.path is None:
                            raise HTTPException(
                                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Failed to upload image to Supabase",
                            )

                        logger.info("Image uploaded to Supabase storage")

                # Store documents in vector database
                logger.info(
                    f"Storing documents in vector database for file: {file_id} ..."
                )
                attachment_vs = AttachmentVectorSpace()
                _ = attachment_vs.store_documents(page_docs)

                # set status as "processed" in Redis
                redis_client.set(status_key, "processed", ex=CACHE_TTL)
                logger.info(f"Successfully processed file: {file_id}")

            except Exception as e:
                # Log the error
                logger.error(f"Error in processing file task: {e}")

                # Set status to "error" in Redis
                redis_client.set(status_key, "error")

        # Run the summarization in the background
        background_tasks.add_task(process_file_task)
        logger.info(f"Background processing task started for file: {file_id}")

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
    supabase_client: SupabaseAsyncClientDep,
    file_id: str,
):
    """Generate a summary for a previously processed file"""
    current_user = auth_context.user

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

            # Store the summary in Supabase
            logger.info(
                f"Creating Supabase Signed Upload Token for file ID: {file_id} ..."
            )
            # Set the client's session with the user's access token
            try:
                await supabase_client.auth.set_session(
                    auth_context.access_token, refresh_token=""
                )
            except Exception as e:
                logger.error(f"Error setting Supabase session: {e}")
                raise

            # Generate signed upload URL and token for secure upload
            signed_upload_response = await supabase_client.storage.from_(
                "attachments"
            ).create_signed_upload_url(
                path=f"{current_user.id}/{file_id}/summary.json",
            )

            logger.info("signed upload response: %s", signed_upload_response)

            # Format your summary as a JSON structure
            summary_data = {
                "content": summary,  # The actual summary text/content
                "fileId": file_id,
                "createdAt": datetime.now().isoformat(),
            }

            # Create a json file with the summary
            temp_file_path = pathlib.Path(
                f"{TEMP_FILE_DIR}/{current_user.id}/{file_id}/summary.json"
            )
            with open(temp_file_path, "w", encoding="utf-8") as f:
                json.dump(summary_data, f, ensure_ascii=False, indent=4)
            logger.info(f"Summary saved locally at: {temp_file_path}")

            # Upload the summary to Supabase
            logger.info(f"Storing summary in Supabase for file ID: {file_id} ...")
            upload_summary_response = await supabase_client.storage.from_(
                "attachments"
            ).upload_to_signed_url(
                path=signed_upload_response.get("path"),
                token=signed_upload_response.get("token"),
                file=temp_file_path,
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
            logger.info(f"Summary uploaded to Supabase: {upload_summary_response.path}")

            # Update status in Redis to "completed"
            redis_client.set(summary_status_key, "completed")
            logger.info(f"Successfully summarized file ID: {file_id}")

            # Clean up local files
            os.remove(temp_file_path)

        except Exception as e:
            # Log the error
            logger.error(f"Error in summarization task: {e}")

            # Set status to "error" in Redis
            redis_client.set(summary_status_key, "error")

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


class DocumentSummaryProgress(BaseResponse):
    """
    Response schema for document summary progress.
    """

    id: str = Field(description="Unique identifier for the document")
    status: str = Field(description="Status of the document summary")
    message: Optional[str] = Field(description="Additional message or error details")
    download_url: Optional[str] = Field(
        None, description="Signed URL to download the summary when completed"
    )


@router.get("/{file_id}/summary-progress", response_model=DocumentSummaryProgress)
async def get_summary_progress(
    file_id: str,
    redis_client: RedisDep,
    auth_context: CurrentAuthContext,
    supabase_client: SupabaseAsyncClientDep,
):
    """Get the summary of a file"""
    current_user = auth_context.user

    # Set the client's session with the user's access token
    await supabase_client.auth.set_session(auth_context.access_token, refresh_token="")

    # Check status in Redis cache first
    status_key = f"summarization:status:{current_user.id}:{file_id}"
    task_status = redis_client.get(status_key)

    # if not found in Redis, check if summary exists in Supabase storage
    if task_status is None:
        try:
            # check if summary file exists in storage
            file_dir = f"{current_user.id}/{file_id}"
            file_exists_response = await supabase_client.storage.from_(
                "attachments"
            ).list(
                path=file_dir,
            )

            # if summary file exists, set status to "completed"
            summary_exists = any(
                item.get("name") == "summary.json" for item in file_exists_response
            )
            if summary_exists:
                task_status = "completed"
                # Restore the cache for future requests
                redis_client.set(status_key, task_status, ex=CACHE_TTL)
            else:
                # Still no summary found
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No summary found for file ID: {file_id}",
                )

        except Exception as e:
            logger.error(f"Error checking summary in Supabase storage: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error checking summary in Supabase storage",
            )

    # Handle cases where processing is not yet complete
    if task_status not in [
        "pending",
        "processing",
        "summarizing",
        "error",
        "completed",
    ]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected status",
        )

    status_message = {
        "pending": "File is queued for processing",
        "processing": "PDF parsing is in progress",
        "summarizing": "Creating summary of document content",
        "completed": "Summary is ready for download",
        "error": "An error occurred during processing",
    }.get(task_status, "Processing is in progress")

    response = {
        "id": file_id,
        "status": task_status,
        "message": status_message,
    }

    # if completed, include download URL
    if task_status == "completed":
        try:
            # generate signed download URL with expiration
            signed_download_url_response = await supabase_client.storage.from_(
                "attachments"
            ).create_signed_url(
                path=f"{current_user.id}/{file_id}/summary.json",
                expires_in=3600,  # 1 hour
                options={"download": "true"},
            )
            response["download_url"] = signed_download_url_response.get("signedURL")
        except Exception as e:
            logger.error(f"Error generating signed download URL: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error generating signed download URL",
            )

    return response


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
