import logging
import os
import pathlib
import json
from celery import Task
from celery_main import celery_app
from utils.file_reader import PDFMarkdownReader
from utils.vector_store import AttachmentVectorSpace
from utils.supabase import get_supabase_client
from datetime import datetime
from core.config import settings

logger = logging.getLogger(__name__)

# Base task class with error handling
class BaseTask(Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Task {task_id} failed: {exc}")


# Task 1: Extract content from document
@celery_app.task(
    bind=True, name="tasks.document_processing.extract_content", base=BaseTask
)
def extract_content(self, user_jwt: str, temp_file_path: str, file_id: str):
    """
    Extract content from document files.

    Args:
        user_jwt: JWT token for the user
        temp_file_path: Path to the temporary file
        file_id: ID of the file being processed
    """
    try:
        logger.info(f"Starting content extraction for file: {file_id}")

        # Authenticate with Supabase
        supabase_client = get_supabase_client()
        supabase_auth_response = supabase_client.auth.set_session(
            access_token=user_jwt, refresh_token=""
        )
        user_id = supabase_auth_response.user.id

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "stage": "Reading document",
                "progress": 25,
            },
        )

        # Extract content from document
        temp_file_path_obj = pathlib.Path(temp_file_path)
        temp_images_dir = str(temp_file_path_obj.parent / "images")
        reader = PDFMarkdownReader()
        page_docs = reader.load_data(
            temp_file_path,
            temp_images_dir,
            {"user_id": user_id, "file_id": file_id},
        )

        logger.info(f"Extracted {len(page_docs)} pages from file: {file_id}")

        # store images in supabase storage
        logger.info(f"Storing images in Supabase storage for file: {file_id}")
        uploaded_images = []

        for image_file in os.listdir(temp_images_dir):
            temp_image_path = pathlib.Path(temp_images_dir) / image_file
            if temp_image_path.is_file():
                try:
                    supabase_signed_upload_response = supabase_client.storage.from_(
                        "attachments"
                    ).create_signed_upload_url(
                        path=f"{user_id}/{file_id}/images/{image_file}",
                    )

                    supabase_upload_response = supabase_client.storage.from_(
                        "attachments"
                    ).upload_to_signed_url(
                        path=supabase_signed_upload_response.get("path"),
                        token=supabase_signed_upload_response.get("token"),
                        file=temp_image_path,
                        file_options={
                            "upsert": "true",
                            "content-type": "image/png",
                        },
                    )
                    uploaded_images.append(image_file)
                except Exception as e:
                    logger.error(f"Error uploading image {image_file}: {str(e)}")
                    # Continue with other images even if one fails

        logger.info(
            f"Successfully stored {len(uploaded_images)} images in Supabase storage for file: {file_id}"
        )

        # Convert LlamaIndexDocument objects to serializable dictionaries
        serializable_docs = [doc.model_dump_json(indent=4) for doc in page_docs]

        return {
            "serializable_docs": serializable_docs,
            "temp_images_dir": temp_images_dir,
            "file_id": file_id,
            "user_id": user_id,
        }
    except Exception as e:
        logger.error(f"Error extracting content from file {file_id}: {str(e)}")
        raise


# Task 2: Prepare vector embeddings and store them in the vector database
@celery_app.task(
    bind=True, name="tasks.document_processing.prepare_vectors", base=BaseTask
)
def prepare_vectors(self, task_result: dict):
    """
    Prepare vector embeddings from document content.

    Args:
        task_result: Dictionary containing results from extract_content task
    """
    try:
        from llama_index.core.schema import Document as LlamaIndexDocument

        file_id = task_result["file_id"]
        logger.info(f"Preparing vector embeddings for file: {file_id}")

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "stage": "Organizing knowledge",
                "progress": 50,
            },
        )

        # Extract the serializable_docs from the previous task result and convert back to LlamaIndexDocument
        page_docs = [
            LlamaIndexDocument(**json.loads(doc))
            for doc in task_result["serializable_docs"]
        ]

        # Prepare the vector points and store them in the vector database
        attachment_vs = AttachmentVectorSpace()
        attachment_vs.store_documents(
            page_docs, batch_size=16, parallel=1, max_retries=1
        )

        logger.info(
            f"Store documents in Qdrant Vector Database successfully for file {file_id}"
        )

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "stage": "Processing complete",
                "progress": 100,
            },
        )
        return task_result
    except Exception as e:
        logger.error(
            f"Error preparing vector embeddings for file {task_result.get('file_id')}: {str(e)}"
        )
        raise


@celery_app.task(
    bind=True, name="tasks.document_processing.process_document_chain", base=BaseTask
)
def process_document_chain(self, user_jwt: str, temp_file_path: str, file_id: str):
    """
    Chain multiple tasks to process a document in parallel-friendly steps.

    This coordinator task chains:
    1. Content extraction
    2. Vector preparation

    Args:
        temp_file_path: Path to the temporary file
        user_jwt: JWT token for the user
        file_id: ID of the file being processed
    """
    try:
        logger.info(f"Starting document processing chain for file: {file_id}")
        # Import chain from celery
        from celery import chain

        # Create a chain of tasks
        result = chain(
            extract_content.s(user_jwt, temp_file_path, file_id),
            prepare_vectors.s(),
        ).apply_async()

        # Return the task ID of the chain
        return {
            "task_id": result.id,
            "file_id": file_id,
        }
    except Exception as e:
        logger.error(
            f"Error setting up document processing chain for {file_id}: {str(e)}"
        )
        raise


@celery_app.task(
    bind=True, name="tasks.document_processing.summarize_document", base=BaseTask
)
def summarize_document(self, user_jwt: str, file_id: str):
    """
    Summarize a processed document and store the summary.

    Args:
        user_jwt: JWT token for the user
        file_id: ID of the file to summarize
    """
    try:
        from services.summarize import DocumentSummarizer

        logger.info(f"Starting document summarization for file: {file_id}")

        # Authenticate with Supabase
        supabase_client = get_supabase_client()
        supabase_auth_response = supabase_client.auth.set_session(
            access_token=user_jwt, refresh_token=""
        )
        user_id = supabase_auth_response.user.id

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "Retrieving document content",
                "progress": 10,
            },
        )

        # Retrieve documents from vector store
        logger.info(f"Retrieving documents for file ID: {file_id}")
        attachment_vs = AttachmentVectorSpace()

        # These are the chunks that were stored previously in the vector store
        docs = attachment_vs.get_documents_by_file_id(file_id)

        if not docs:
            raise Exception("No document content found in vector store")

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "Generating summary",
                "progress": 30,
            },
        )

        # Create the summarizer
        summarizer = DocumentSummarizer(
            user_id=user_id,
            file_id=file_id,
            verbose=True,
        )
        summary = summarizer.process_documents(documents=docs)

        # Update task state
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "Storing summary",
                "progress": 70,
            },
        )

        # Format summary as JSON
        summary_data = {
            "content": summary,
            "fileId": file_id,
            "createdAt": datetime.now().isoformat(),
        }

        # Create the directory structure if it doesn't exist
        temp_file_path = pathlib.Path(
            f"{settings.TEMP_DIR}/{user_id}/{file_id}/summary.json"
        )
        temp_file_path.parent.mkdir(parents=True, exist_ok=True)

        # Save summary locally
        with open(temp_file_path, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=4)
        logger.info(f"Summary saved locally at: {temp_file_path}")

        # Generate signed upload URL and token for secure upload
        signed_upload_response = supabase_client.storage.from_(
            "attachments"
        ).create_signed_upload_url(
            path=f"{user_id}/{file_id}/summary.json",
        )

        # Upload the summary to Supabase
        logger.info(f"Storing summary in Supabase for file ID: {file_id} ...")
        upload_summary_response = supabase_client.storage.from_(
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
            raise Exception("Failed to upload summary to Supabase")

        logger.info(f"Summary uploaded to Supabase: {upload_summary_response.path}")

        # Clean up local files
        # os.remove(temp_file_path)

        # Add final progress update
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "Summarization complete",
                "progress": 100,
            },
        )

        # Return successful result
        return {
            "file_id": file_id,
            "user_id": user_id,
            "summary_length": len(summary),
        }

    except Exception as e:
        logger.error(f"Error in summarization task: {e}")
        raise
