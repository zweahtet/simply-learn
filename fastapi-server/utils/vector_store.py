# simply-learn/fastapi-server/utils/vector_store.py
import uuid
from core.config import settings
from typing import ClassVar, List, Optional, Mapping
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from qdrant_client import models, QdrantClient
from utils.embeddings import dense_embedding_model, sparse_embedding_model, late_interaction_embedding_model

from llama_index.core.schema import Document as LlamaIndexDocument
from llama_index.core.text_splitter import SentenceSplitter


def get_sentence_splitter(
    chunk_size: int = 1000, chunk_overlap: int = 100
) -> SentenceSplitter:
    sentence_splitter = SentenceSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        paragraph_separator="\n\n",
        include_metadata=True,
    )

    return sentence_splitter

class QdrantVectorSpace:
    DEFAULT_TEXT_EMBED_DIMENSION: int = 1024
    DEFAULT_SPARSE_EMBED_DIMENSION: int = 128
    DEFAULT_LATE_INTERACTION_EMBED_DIMENSION: int = 128

    DEFAULT_SIMILARITY_DISTANCE: models.Distance = models.Distance.COSINE

    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self.client = QdrantClient(
            url=settings.QDRANT_HOST_URL,
            api_key=settings.QDRANT_API_KEY,
        )

    def check_collection_exists(self):
        return self.client.collection_exists(collection_name=self.collection_name)

    # abstract method
    # def create_collection(self):
    #     """
    #     Create a collection for the vector space.
    #     """
    #     raise NotImplementedError("Subclasses must implement create_collection")

class YouTubeVideoItem(BaseModel):
    id: str
    title: str
    url: str

    model_config: ClassVar[ConfigDict] = ConfigDict(
        from_attributes=True,
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid"
    )

class YouTubeVectorSpace(QdrantVectorSpace):
    COLLECTION_NAME = "youtube_videos"

    def __init__(self):
        super().__init__(collection_name=self.COLLECTION_NAME)

    def recommend(self, query: str):
        # retrieval
        dense_vectors = next(dense_embedding_model.query_embed(query))
        sparse_vectors = next(sparse_embedding_model.query_embed(query))
        late_vectors = next(late_interaction_embedding_model.query_embed(query))

        prefetch = [
            models.Prefetch(
                query=dense_vectors,
                using="dense", # 1024 dimension
                limit=20,
            ),
            models.Prefetch(
                query=models.SparseVector(**sparse_vectors.as_object()),
                using="sparse",
                limit=20,
            ),
        ]

        # rerank
        response = self.client.query_points(
            self.collection_name,
            prefetch=prefetch,
            query=late_vectors,
            using="late_interaction", # 128 dimension
            with_payload=True,
            limit=10,
        )

        # return the top 10 results
        # return [
        #     {"title": result.payload.get("title"), "url": result.payload.get("url")}
        #     for result in response.points
        # ]
        return [
            YouTubeVideoItem(
                id=result.id,
                title=result.payload.get("title"),
                url=result.payload.get("url"),
            )
            for result in response.points
        ]


class AttachmentVectorSpace(QdrantVectorSpace):
    DEFAULT_COLLECTION_NAME = "attachments"

    def __init__(self):
        super().__init__(collection_name=self.DEFAULT_COLLECTION_NAME)

    def build_collection(self):
        """
        Create a predefined collection for attachments.
        """
        if not self.check_collection_exists():
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config={
                    "dense": models.VectorParams(
                        size=1024,
                        distance=models.Distance.COSINE,
                        quantization_config=models.BinaryQuantization(
                            binary=models.BinaryQuantizationConfig(always_ram=True),
                        ),
                    )
                },
            )

    def store_document_in_vector_db(
        self, document: LlamaIndexDocument, chunk_size: int = 1000, overlap: int = 100
    ) -> List[str]:
        """
        Split document into small chunks and store in vector database.

        Args:
            document: Document to store
            chunk_size: Size of each chunk in tokens
            overlap: Overlap between chunks in tokens

        Returns:
            List of chunk IDs
        """
        # Use smaller chunks for the vector DB than for processing
        # This allows for more granular retrieval
        doc_splitter = get_sentence_splitter(chunk_size=chunk_size, chunk_overlap=overlap)

        doc_chunks = doc_splitter.get_nodes_from_documents([document])

        # chunk_ids = self.client.add(
        #     collection_name=self.collection_name,
        #     documents=[doc.text for doc in doc_chunks],
        #     metadata=[doc.metadata for doc in doc_chunks]
        # )
        points = []
        for chunk in doc_chunks:
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector={
                        "dense": next(dense_embedding_model.embed(documents=chunk.text))
                    },
                    # payload=chunk.metadata,
                    payload={"document": chunk.text, **chunk.metadata},
                )
            )

        # Store the points in the vector database
        result = self.client.upsert(
            collection_name=self.collection_name, points=points, wait=True
        )

        print("upsert result:", result)
