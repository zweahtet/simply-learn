import logging
import os
import pathlib
import json
from celery import Task
from celery_main import celery_app
from utils.file_reader import PDFMarkdownReader
from utils.vector_store import AttachmentVectorSpace
from utils.supabase import get_supabase_client

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
    self,
    temp_file_path: str,
    temp_images_path: str,
    file_id: str,
    user_jwt: str,
):
    """
    Process a document by extracting text and images, then store in vector database.

    Args:
        temp_file_path: Path to the temporary file
        temp_images_path: Path to store extracted images
        file_id: ID of the file being processed
        user_jwt: JWT token for the user
    """
    supabase_client = get_supabase_client()
    supabase_auth_response = supabase_client.auth.set_session(
        access_token=user_jwt, refresh_token=""
    )
    user_id = supabase_auth_response.user.id

    # Update task state to STARTED with metadata
    self.update_state(
        state="STARTED",
        meta={"file_id": file_id, "user_id": user_id, "stage": "Starting process"},
    )

    try:
        logger.info(f"Starting document processing for file: {file_id}")

        # Update state to extracting content
        self.update_state(
            state="PROGRESS",
            meta={
                "file_id": file_id,
                "user_id": user_id,
                "stage": "Reading document",
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

        # Store documents in vector database
        logger.info(f"Storing documents in vector database for file: {file_id}")
        attachment_vs = AttachmentVectorSpace()
        _ = attachment_vs.store_documents(page_docs, parallel=1, max_retries=1)

        logger.info(f"Successfully processed file: {file_id}")

        # Store images in Supabase storage
        logger.info(f"Storing images in Supabase storage for file: {file_id}")
        for image_file in os.listdir(temp_images_path):
            temp_image_path = pathlib.Path(temp_images_path) / image_file
            if temp_image_path.is_file():
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
        logger.info(
            f"Successfully stored images in Supabase storage for file: {file_id}"
        )

        # Return successful result - this automatically sets state to SUCCESS
        return {
            "file_id": file_id,
            "user_id": user_id,
            "pages_processed": len(page_docs),
        }

    except Exception as e:
        logger.error(f"Error processing document {file_id}: {str(e)}")
        # Re-raise for Celery to handle - will set state to FAILURE
        raise


# Task 1: Extract content from document
# @celery_app.task(
#     bind=True, name="tasks.document_processing.extract_content", base=BaseTask
# )
# def extract_content(self, temp_file_path, temp_images_path, user_id, file_id):
#     """
#     Extract content from document files.

#     Args:
#         temp_file_path: Path to the temporary file
#         temp_images_path: Path to store extracted images
#         user_id: ID of the user
#         file_id: ID of the file being processed
#     """
#     try:
#         logger.info(f"Starting content extraction for file: {file_id}")

#         # Update task state
#         self.update_state(
#             state="PROGRESS",
#             meta={
#                 "file_id": file_id,
#                 "stage": "Reading document",
#                 "progress": 25,
#             },
#         )

#         # Extract content from document
#         reader = PDFMarkdownReader()
#         page_docs = reader.load_data(
#             temp_file_path,
#             temp_images_path,
#             {"user_id": user_id, "file_id": file_id},
#         )

#         logger.info(f"Extracted {len(page_docs)} pages from file: {file_id}")

#         # Convert LlamaIndexDocument objects to serializable dictionaries
#         serializable_docs = []
#         for doc in page_docs:
#             serializable_docs.append(
#                 {
#                     "doc_id": doc.doc_id,
#                     "text": doc.text,
#                     "metadata": doc.metadata,
#                     # Add any other important fields from the document
#                 }
#             )

#         return {
#             "serializable_docs": serializable_docs,
#             "temp_images_path": temp_images_path,
#             "file_id": file_id,
#             "user_id": user_id,
#         }
#     except Exception as e:
#         logger.error(f"Error extracting content from file {file_id}: {str(e)}")
#         raise


# # Task 2: Prepare vector embeddings
# @celery_app.task(
#     bind=True, name="tasks.document_processing.prepare_vectors", base=BaseTask
# )
# def prepare_vectors(self, task_result):
#     """
#     Prepare vector embeddings from document content.

#     Args:
#         task_result: Dictionary containing results from extract_content task
#     """
#     try:
#         file_id = task_result["file_id"]
#         logger.info(f"Preparing vector embeddings for file: {file_id}")

#         # Update task state
#         self.update_state(
#             state="PROGRESS",
#             meta={
#                 "file_id": file_id,
#                 "stage": "Analyzing content",
#                 "progress": 50,
#             },
#         )

#         # Extract the serializable_docs from the previous task result and convert back to LlamaIndexDocument
#         serializable_docs = task_result["serializable_docs"]
#         page_docs = []

#         from llama_index.core.schema import Document as LlamaIndexDocument

#         for doc_dict in serializable_docs:
#             doc = LlamaIndexDocument(
#                 text=doc_dict["text"],
#                 metadata=doc_dict["metadata"],
#                 doc_id=doc_dict.get("doc_id"),
#             )
#             page_docs.append(doc)

#         # Prepare the vector points but don't upload them
#         attachment_vs = AttachmentVectorSpace()
#         points = attachment_vs.prepare_vector_points(page_docs)

#         logger.info(f"Generated {len(points)} vector points for file: {file_id}")

#         # Convert vector points to serializable format
#         serializable_points = []
#         for point in points:
#             # Convert vector point to a serializable dictionary
#             point_dict = {
#                 "id": point.id,
#                 "vector": {
#                     # Ensure vector values are serializable (e.g., convert numpy arrays to lists)
#                     "dense": (
#                         point.vector["dense"].tolist()
#                         if hasattr(point.vector["dense"], "tolist")
#                         else point.vector["dense"]
#                     )
#                 },
#                 "payload": point.payload,
#             }
#             serializable_points.append(point_dict)

#         # Pass serializable points to the next task
#         task_result["serializable_points"] = serializable_points
#         return task_result
#     except Exception as e:
#         logger.error(
#             f"Error preparing vector embeddings for file {task_result.get('file_id')}: {str(e)}"
#         )
#         raise


# # Task 3: Store vectors in batches
# @celery_app.task(
#     bind=True, name="tasks.document_processing.store_vectors", base=BaseTask
# )
# def store_vectors(self, task_result):
#     """
#     Store prepared vector points in Qdrant database.

#     Args:
#         task_result: Dictionary containing results from prepare_vectors task
#     """
#     try:
#         file_id = task_result["file_id"]
#         logger.info(f"Storing vector points for file: {file_id}")

#         # Update task state
#         self.update_state(
#             state="PROGRESS",
#             meta={
#                 "file_id": file_id,
#                 "stage": "Organizing knowledge",
#                 "progress": 75,
#             },
#         )

#         # Convert serializable points back to PointStruct objects
#         serializable_points = task_result["serializable_points"]

#         from qdrant_client import models

#         points = []
#         for point_dict in serializable_points:
#             point = models.PointStruct(
#                 id=point_dict["id"],
#                 vector=point_dict["vector"],
#                 payload=point_dict["payload"],
#             )
#             points.append(point)

#         # Store vectors in batches of manageable size - use parallel=1 to avoid daemon process issues
#         attachment_vs = AttachmentVectorSpace()
#         point_ids = attachment_vs.store_vector_points(points, parallel=1)

#         logger.info(
#             f"Successfully stored {len(point_ids)} vector points for file: {file_id}"
#         )

#         # Add point IDs to result
#         task_result["point_ids"] = point_ids
#         return task_result
#     except Exception as e:
#         logger.error(
#             f"Error storing vector points for file {task_result.get('file_id')}: {str(e)}"
#         )
#         raise


# # Task 4: Upload images
# @celery_app.task(
#     bind=True, name="tasks.document_processing.upload_images", base=BaseTask
# )
# def upload_images(self, task_result, user_jwt):
#     """
#     Upload images extracted from the document to Supabase storage.

#     Args:
#         task_result: Dictionary containing results from previous tasks
#         user_jwt: JWT token for the user
#     """
#     try:
#         temp_images_path = task_result["temp_images_path"]
#         file_id = task_result["file_id"]
#         user_id = task_result["user_id"]

#         # Update task state
#         self.update_state(
#             state="PROGRESS",
#             meta={
#                 "file_id": file_id,
#                 "stage": "Saving images",
#                 "progress": 90,
#             },
#         )

#         # Get Supabase client
#         supabase_client = get_supabase_client()
#         supabase_client.auth.set_session(access_token=user_jwt, refresh_token="")

#         logger.info(f"Storing images in Supabase storage for file: {file_id}")
#         uploaded_images = []

#         for image_file in os.listdir(temp_images_path):
#             temp_image_path = pathlib.Path(temp_images_path) / image_file
#             if temp_image_path.is_file():
#                 try:
#                     supabase_signed_upload_response = supabase_client.storage.from_(
#                         "attachments"
#                     ).create_signed_upload_url(
#                         path=f"{user_id}/{file_id}/images/{image_file}",
#                     )

#                     supabase_upload_response = supabase_client.storage.from_(
#                         "attachments"
#                     ).upload_to_signed_url(
#                         path=supabase_signed_upload_response.get("path"),
#                         token=supabase_signed_upload_response.get("token"),
#                         file=temp_image_path,
#                         file_options={
#                             "upsert": "true",
#                             "content-type": "image/png",
#                         },
#                     )
#                     uploaded_images.append(image_file)
#                 except Exception as e:
#                     logger.error(f"Error uploading image {image_file}: {str(e)}")
#                     # Continue with other images even if one fails

#         logger.info(
#             f"Successfully stored {len(uploaded_images)} images in Supabase storage for file: {file_id}"
#         )

#         # Add uploaded images to task result
#         task_result["uploaded_images"] = uploaded_images
#         return task_result
#     except Exception as e:
#         logger.error(f"Error in upload_images task: {str(e)}")
#         raise


# @celery_app.task(
#     bind=True, name="tasks.document_processing.process_document_chain", base=BaseTask
# )
# def process_document_chain(
#     self, temp_file_path: str, temp_images_path: str, file_id: str, user_jwt: str
# ):
#     """
#     Chain multiple tasks to process a document in parallel-friendly steps.

#     This coordinator task chains:
#     1. Content extraction
#     2. Vector preparation
#     3. Vector storage
#     4. Image upload

#     Args:
#         temp_file_path: Path to the temporary file
#         temp_images_path: Path to store extracted images
#         file_id: ID of the file being processed
#         user_jwt: JWT token for the user
#     """
#     try:
#         logger.info(f"Starting document processing chain for file: {file_id}")

#         # Extract user_id from JWT
#         supabase_client = get_supabase_client()
#         supabase_auth_response = supabase_client.auth.set_session(
#             access_token=user_jwt, refresh_token=""
#         )
#         user_id = supabase_auth_response.user.id

#         self.update_state(
#             state="STARTED",
#             meta={"file_id": file_id, "user_id": user_id, "stage": "Starting process"},
#         )

#         # Create a chain of tasks
#         from celery import chain, signature

#         result = chain(
#             # Pass user_id instead of user_jwt to extract_content
#             extract_content.s(temp_file_path, temp_images_path, user_id, file_id),
#             prepare_vectors.s(),
#             store_vectors.s(),
#             # Pass user_jwt directly to upload_images using the signature construct
#             signature(upload_images.s(user_jwt=user_jwt)),
#         ).apply_async()

#         # Return the task ID of the chain
#         return {
#             "task_id": result.id,
#             "file_id": file_id,
#             "user_id": user_id,
#         }
#     except Exception as e:
#         logger.error(
#             f"Error setting up document processing chain for {file_id}: {str(e)}"
#         )
#         raise
