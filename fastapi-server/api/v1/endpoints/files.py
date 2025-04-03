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
from core.config import settings

logger = logging.getLogger(__name__)

# Initialize FastAPI router
router = APIRouter()

# Constants
IMAGE_DIR = "./images"
CHUNK_SIZE = 1000  # Characters per text chunk
MAX_CONCURRENT_ADAPTATIONS = 5
CACHE_TTL = 3600  # 1 hour

# Create directories if they don't exist
os.makedirs(settings.TEMP_DIR, exist_ok=True)
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
        temp_user_dir = pathlib.Path(f"{settings.TEMP_DIR}/{current_user.id}")
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

        # Queue the processing task in Celery
        try:
            # Queue document processing task
            task = celery_app.send_task(
                name="tasks.document_processing.process_document_chain",
                args=[
                    auth_context.access_token,
                    str(temp_file_path),
                    file_id,
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


@router.post("/{file_id}/summarize", description="Create a summary of the file.")
async def summarize_file(
    auth_context: CurrentAuthContext,
    file_id: str,
):
    """Generate a summary for a previously processed file using Celery"""
    # Start Celery task
    try:
        from tasks.document_processing import summarize_document
        from celery.exceptions import CeleryError

        task = summarize_document.delay(auth_context.access_token, file_id)

    except CeleryError as ce:
        logger.error(f"Celery error when starting summarization task: {ce}")
        return JSONResponse(
            content={
                "id": file_id,
                "message": "Failed to start summarization task",
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        logger.error(f"Unexpected error in summarize endpoint: {e}")
        return JSONResponse(
            content={
                "id": file_id,
                "message": "An unexpected error occurred",
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Return task information to client
    return JSONResponse(
        content={
            "id": file_id,
            "task_id": task.id,  # Return Celery task ID for status tracking
            "message": "Summarization started with Celery",
        },
        status_code=status.HTTP_202_ACCEPTED,
    )


@router.get(
    "/{file_id}/summary", description="Get the summary of a file from Supabase storage"
)
async def get_summary(
    file_id: str,
    auth_context: CurrentAuthContext,
    supabase_client: SupabaseAsyncClientDep,
):
    """Get the summary of a file if it exists in Supabase storage"""
    current_user = auth_context.user
    # TODO: cache the summary file content in Redis
    
    # Set the client's session with the user's access token
    await supabase_client.auth.set_session(auth_context.access_token, refresh_token="")

    try:
        # Check if summary file exists in storage
        file_dir = f"{current_user.id}/{file_id}"
        file_list_response = await supabase_client.storage.from_("attachments").list(
            path=file_dir,
        )

        # if summary file exists, return it
        summary_exists = any(
            item.get("name") == "summary.json" for item in file_list_response
        )
        if not summary_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No summary found for file ID: {file_id}",
            )

        # generate signed download URL with expiration
        signed_download_url_response = await supabase_client.storage.from_(
            "attachments"
        ).create_signed_url(
            path=f"{current_user.id}/{file_id}/summary.json",
            expires_in=3600,  # 1 hour
            options={"download": "true"},
        )

        return JSONResponse(
            content={
                "id": file_id,
                "downloadUrl": signed_download_url_response.get("signedURL"),
            },
            status_code=status.HTTP_200_OK,
        )
    except Exception as e:
        logger.error(f"Error in get_summary endpoint: {e}")
        return JSONResponse(
            content={
                "id": file_id,
                "message": "An unexpected error occurred",
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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


@router.get("/tasks/{task_id}")
async def get_task_status(
    task_id: str,
    auth_context: CurrentAuthContext,
):
    """Get the status of a Celery task"""
    from celery.result import AsyncResult

    try:
        # Get task result
        task_result = AsyncResult(task_id)

        # Check if task exists
        if not task_result:
            return JSONResponse(
                content={
                    "error": "Task not found",
                    "task_id": task_id,
                },
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Get task state and info
        result = {
            "task_id": task_id,
            "status": task_result.status,
        }

        # Add result info if available
        if task_result.ready():
            if task_result.successful():
                result["result"] = task_result.result
            else:
                result["error"] = str(task_result.result)

            # Add progress info if available
            if hasattr(task_result, "info") and task_result.info:
                if isinstance(task_result.info, dict) and "stage" in task_result.info:
                    result["progress"] = task_result.info

            return result
    except Exception as e:
        logger.error(f"Unexpected error in get_task_status endpoint: {e}")
        return JSONResponse(
            content={
                "task_id": task_id,
                "error": "An unexpected error occurred",
                "details": str(e),
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/sse/tasks/{task_id}")
async def task_status_sse(request: Request, task_id: str):
    """Stream task status updates using Server-Sent Events"""
    from celery.result import AsyncResult

    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                # Get task result
                task_result = AsyncResult(task_id)

                # Prepare status data
                status_data = {
                    "task_id": task_id,
                    "status": task_result.status,
                }

                # Add progress info if available
                if hasattr(task_result, "info") and task_result.info:
                    if (
                        isinstance(task_result.info, dict)
                        and "stage" in task_result.info
                    ):
                        status_data["progress"] = task_result.info

                # Add result or error if task completed
                if task_result.ready():
                    if task_result.successful():
                        status_data["result"] = task_result.result
                    else:
                        status_data["error"] = str(task_result.result)

                    # Send final update and end stream
                    yield f"data: {json.dumps(status_data)}\n\n"
                    break

                # Send status update
                yield f"data: {json.dumps(status_data)}\n\n"

                # Wait before next poll
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"Error in SSE connection for task {task_id}: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
