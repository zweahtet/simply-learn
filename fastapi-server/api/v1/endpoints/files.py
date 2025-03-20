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
from fastapi import status, APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
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


# Models for request/response
class ProcessResult(BaseModel):
    success: bool
    fileId: str
    title: str
    totalPages: int
    totalChunks: int
    initialChunks: List[ChunkData]
    message: Optional[str] = None


class AdaptationQueue:
    """Manages the background processing of content adaptation"""

    def __init__(self):
        self.queue = []
        self.processing = set()
        self.executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_ADAPTATIONS)
        self.is_processing = False

    async def enqueue(
        self,
        file_id: str,
        chunks: List[ChunkData],
        level: str,
        profile: CognitiveProfile,
        priority: int = 1,
    ):
        """Add chunks to the adaptation queue"""
        for chunk in chunks:
            if chunk.id not in self.processing:
                self.queue.append(
                    {
                        "file_id": file_id,
                        "chunk": chunk,
                        "level": level,
                        "profile": profile,
                        "priority": priority,
                    }
                )

        # Start processing if not already running
        if not self.is_processing:
            asyncio.create_task(self.process_queue())

    # async def process_queue(self):
    #     """Process items in the queue"""
    #     if self.is_processing:
    #         return

    #     self.is_processing = True

    #     try:
    #         while self.queue:
    #             # Sort by priority (higher first)
    #             self.queue.sort(key=lambda x: -x["priority"])

    #             # Process up to MAX_CONCURRENT_ADAPTATIONS at once
    #             batch = []
    #             for _ in range(min(MAX_CONCURRENT_ADAPTATIONS, len(self.queue))):
    #                 item = self.queue.pop(0)
    #                 self.processing.add(item["chunk"].id)
    #                 batch.append(item)

    #             # Process batch concurrently
    #             tasks = []
    #             for item in batch:
    #                 task = adapt_chunk(item["chunk"], item["level"], item["profile"])
    #                 tasks.append(task)

    #             # Wait for all adaptations to complete
    #             adapted_chunks = await asyncio.gather(*tasks)

    #             # Store results in database/cache
    #             for i, adapted_chunk in enumerate(adapted_chunks):
    #                 item = batch[i]
    #                 file_id = item["file_id"]

    #                 # Store in Redis for retrieval
    #                 redis_client.set(
    #                     f"chunk:{file_id}:{adapted_chunk.id}",
    #                     json.dumps(adapted_chunk.dict()),
    #                     ex=CACHE_TTL,
    #                 )

    #                 # Remove from processing set
    #                 self.processing.discard(adapted_chunk.id)

    #             # Small delay to prevent API overload
    #             await asyncio.sleep(0.1)

    #     finally:
    #         self.is_processing = False


# Create global adaptation queue
adaptation_queue = AdaptationQueue()


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
    file_id = str(uuid.uuid4())[:8] # Shorten UUID for easier handling

    # Senatize file name
    file_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", file.filename)

    # Create a unique file path
    file_path = pathlib.Path(f"{FILE_UPLOAD_DIR}/{current_user.id}/{file_id}_{file_name}")
    image_path = pathlib.Path(f"{IMAGE_DIR}/{current_user.id}/{file_id}_{file_name}")

    try:
        # Check if the file already exists
        # if os.path.exists(file_path):
        #     # return the existing simplified file id
        #     return

        # Create directories if they don't exist
        os.makedirs(file_path.parent, exist_ok=True)
        os.makedirs(image_path.parent, exist_ok=True)

        # Save the file
        with open(file_path, "wb") as f:
            f.write(await file.read())

        reader = PDFMarkdownReader()
        docs = reader.load_data(file_path, image_path, {"user_id": current_user.id})

        attachment_vs = AttachmentVectorSpace()

        # Store document in vector database
        for doc in docs:
            attachment_vs.store_document_in_vector_db(doc)

        # Start background processing of chunks

        return JSONResponse(
            content={
                "fileId": file_id,
                "filename": file_name,
                "title": file.filename,
                "totalPages": len(docs),
                "processedAt": time.time(),
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

    # Initialize variables
    # all_chunks = []
    # chunk_id_counter = 0
    # title = file.filename


#     # Process each page
#     for page_num, page in enumerate(doc):
#         # Extract text
#         text = page.get_text()
#         text_chunks = extract_text_chunks(text)

#         # Create chunks for text
#         for i, chunk_text in enumerate(text_chunks):
#             chunk_id = f"{file_id}_p{page_idx}_t{i}"
#             chunk = ChunkData(
#                 content=chunk_text,
#                 page=page_num,
#                 order=chunk_id_counter,
#                 type="text",
#                 original_content=chunk_text,
#                 is_adapted=False,
#                 metadata={"context": f"This is from page {page_num + 1}."},
#             )
#             all_chunks.append(chunk)
#             chunk_id_counter += 1

#         # Extract and process images
#         images = extract_images(doc, page, file_id, page_idx)
#         for i, img in enumerate(images):
#             chunk_id = f"{file_id}_p{page_idx}_img{i}"
#             chunk = ChunkData(
#                 id=chunk_id,
#                 content=img["description"],
#                 page=page_idx,
#                 order=chunk_id_counter,
#                 type="image",
#                 originalContent=img["description"],
#                 isAdapted=False,
#                 metadata={
#                     "path": img["path"],
#                     "filename": img["filename"],
#                     "description": img["description"],
#                     "base64": img["base64"],
#                     "context": f"This is an image from page {page_idx + 1}.",
#                 },
#             )
#             all_chunks.append(chunk)
#             chunk_id_counter += 1

#     # Sort chunks by page and order
#     all_chunks.sort(key=lambda x: (x.page, x.order))

#     # Determine how many chunks to process immediately
#     num_immediate_chunks = min(5, len(all_chunks))
#     initial_chunks = all_chunks[:num_immediate_chunks]
#     remaining_chunks = all_chunks[num_immediate_chunks:]

#     # Adapt initial chunks
#     adapted_initial_chunks = []
#     for chunk in initial_chunks:
#         adapted_chunk = await adapt_chunk(chunk, profile)
#         adapted_initial_chunks.append(adapted_chunk)

#         # Store in Redis for later retrieval
#         redis_client.set(
#             f"chunk:{file_id}:{chunk.id}",
#             json.dumps(adapted_chunk.dict()),
#             ex=CACHE_TTL,
#         )

#     # Queue remaining chunks for background processing
#     if remaining_chunks:
#         background_tasks.add_task(
#             adaptation_queue.enqueue, file_id, remaining_chunks, profile
#         )

#     # Save file metadata to Redis
#     file_metadata = {
#         "id": file_id,
#         "filename": file.filename,
#         "title": title,
#         "totalPages": len(doc),
#         "totalChunks": len(all_chunks),
#         "profile": profile.model_dump(),
#         "chunkIds": [chunk.id for chunk in all_chunks],
#         "processedAt": time.time(),
#     }
#     redis_client.set(f"file:{file_id}", json.dumps(file_metadata), ex=CACHE_TTL)

#     # Return initial results
#     return ProcessResult(
#         success=True,
#         fileId=file_id,
#         title=title,
#         totalPages=len(doc),
#         totalChunks=len(all_chunks),
#         initialChunks=adapted_initial_chunks,
#     )

# except Exception as e:
#     # Handle errors
#     print(f"Error processing file: {e}")
#     return ProcessResult(
#         success=False,
#         fileId=file_id,
#         title=file.filename,
#         totalPages=0,
#         totalChunks=0,
#         initialChunks=[],
#         message=f"Error processing file: {str(e)}",
#     )


# @router.get("/get-chunks/{file_id}")
# async def get_chunks(redis_client: RedisDep, file_id: str, start: int = 0, count: int = 5):
#     """Get a batch of chunks from a file"""
#     # Get file metadata
#     file_metadata_json = redis_client.get(f"file:{file_id}")
#     if not file_metadata_json:
#         raise HTTPException(404, detail="File not found")

#     file_metadata = json.loads(file_metadata_json)
#     chunk_ids = file_metadata["chunkIds"]

#     # Validate start and count
#     if start < 0 or start >= len(chunk_ids):
#         raise HTTPException(400, detail="Invalid start index")

#     # Determine which chunks to retrieve
#     end = min(start + count, len(chunk_ids))
#     requested_chunk_ids = chunk_ids[start:end]

#     # Retrieve chunks from Redis
#     chunks = []
#     for chunk_id in requested_chunk_ids:
#         chunk_json = redis_client.get(f"chunk:{file_id}:{chunk_id}")
#         if chunk_json:
#             chunks.append(json.loads(chunk_json))
#         else:
#             # Chunk not adapted yet, return placeholder
#             chunks.append(
#                 {
#                     "id": chunk_id,
#                     "content": "Content is being processed...",
#                     "isAdapted": False,
#                     "order": chunk_ids.index(chunk_id),
#                 }
#             )

#     return {
#         "fileId": file_id,
#         "chunks": chunks,
#         "start": start,
#         "count": len(chunks),
#         "total": len(chunk_ids),
#         "hasMore": end < len(chunk_ids),
#     }
