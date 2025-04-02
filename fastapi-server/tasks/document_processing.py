import logging
import os
import json
from celery import Task
from celery_main import celery_app
from utils.file_reader import PDFMarkdownReader
from utils.vector_store import AttachmentVectorSpace

logger = logging.getLogger(__name__)


# Base task class with error handling
class BaseTask(Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Task {task_id} failed: {exc}")


@celery_app.task(
    bind=True, name="tasks.document_processing.process_document", base=BaseTask
)
def process_document(
    self, temp_file_path: str, temp_images_path: str, user_id: str, file_id: str
):
    """
    Process a document by extracting text and images, then store in vector database.

    Args:
        temp_file_path: Path to the temporary file
        temp_images_path: Path to store extracted images
        user_id: ID of the user who uploaded the file
        file_id: ID of the file being processed
    """
    # Update task state to STARTED with metadata
    self.update_state(
        state="STARTED",
        meta={"file_id": file_id, "user_id": user_id, "stage": "initializing"},
    )

    try:
        logger.info(f"Starting document processing for file: {file_id}")

        # Ensure images directory exists
        os.makedirs(temp_images_path, exist_ok=True)

        # Update state to extracting content
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "extracting_content",
                "progress": 25,
            },
        )

        # Extract text and images from PDF
        logger.info(f"Extracting content from file: {temp_file_path}")
        reader = PDFMarkdownReader()
        page_docs = reader.load_data(
            temp_file_path,
            temp_images_path,
            {"user_id": user_id, "file_id": file_id},
        )
        logger.info(f"Extracted {len(page_docs)} pages from file: {file_id}")

        # Update state to storing in vector database
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "storing_in_vector_db",
                "progress": 75,
                "pages": len(page_docs),
            },
        )

        # Store documents in vector database
        logger.info(f"Storing documents in vector database for file: {file_id}")
        attachment_vs = AttachmentVectorSpace()
        _ = attachment_vs.store_documents(page_docs)

        logger.info(f"Successfully processed file: {file_id}")

        # Return successful result - this automatically sets state to SUCCESS
        return {
            "status": "success",
            "file_id": file_id,
            "user_id": user_id,
            "pages_processed": len(page_docs),
        }

    except Exception as e:
        logger.error(f"Error processing document {file_id}: {str(e)}")
        # Re-raise for Celery to handle - will set state to FAILURE
        raise
