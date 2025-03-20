# simply-learn/fastapi-server/utils/vector_store.py
import uuid
from core.config import settings
from typing import ClassVar, List, Optional, Mapping, Iterable
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from qdrant_client import models, QdrantClient
from utils.embeddings import dense_embedding_model, sparse_embedding_model, late_interaction_embedding_model
from utils.text_splitter import get_sentence_splitter
from llama_index.core.schema import Document as LlamaIndexDocument

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

    def get_collection_name(self):
        return self.collection_name

    def get_collection_info(self):
        return self.client.get_collection(collection_name=self.collection_name)

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

    def __init__(self, user_id: str):
        """
        Initialize the vector space for attachments.
        Args:
            user_id (str): User ID for the vector space.
        """
        self.user_id = user_id
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

    def retrieve_documents(
        self,
        query: str,
        n_results: int = 5,
        filter: Optional[Mapping] = None,
    ):
        """
        Retrieve documents from the vector database based on the query.

        Args:
            query (str): The query string.
            n_results (int): The number of results to return.
            filter (Optional[Mapping]): Optional filter for the query.

        Returns:
            List of documents matching the query.
        """
        try:
            # Use dense embedding model for retrieval
            dense_vectors = next(dense_embedding_model.query_embed(query))

            # Perform the query
            response = self.client.query_points(
                collection_name=self.collection_name,
                query=dense_vectors,
                using="dense",
                with_payload=True,
                limit=n_results,
                query_filter={
                    models.Filter(
                        must = [
                            models.FieldCondition(
                                key="user_id",
                                match=models.MatchValue(value=self.user_id),
                            ),
                            models.FieldCondition(
                                key="file_id",
                                match=models.MatchValue(value=filter.get("file_id")),
                            )
                        ]
                    )
                },
            )

            return [
                LlamaIndexDocument(
                    id=result.id,
                    text=result.payload.get("document"),
                    metadata=result.payload,
                )
                for result in response.points
            ]
        except Exception as e:
            print(f"Error retrieving documents: {e}")
            raise SystemError(f"Error retrieving documents: {e}")

    def store_documents_in_vector_db(
        self,
        documents: List[LlamaIndexDocument],
        batch_size: int = 5,
        parallel: int = 4,
    ) -> List[str]:
        """
        Split document into small chunks and store in vector database.

        Args:
            documents (Iterable[LlamaIndexDocument]): List of documents to be stored in vector database.
            batch_size (int): Number of documents to be processed in parallel.
            parallel (int): Number of parallel processes to be used.

        Returns:
            List of chunk IDs
        """
        try:
            # Use smaller chunks for the vector DB than for processing
            # This allows for more granular retrieval
            doc_splitter = get_sentence_splitter()
            doc_chunks = doc_splitter.get_nodes_from_documents(documents)

            points: List[models.PointStruct] = []
            for chunk in doc_chunks:
                points.append(
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector={
                            "dense": next(
                                dense_embedding_model.embed(
                                    documents=chunk.get_content("embed")
                                )
                            )
                        },
                        # payload=chunk.metadata,
                        payload={
                            "document": chunk.get_content(),
                            **chunk.metadata,
                        },
                    )
                )

            # Store the points in the vector database
            self.client.upload_points(
                collection_name=self.collection_name,
                points=points,
                batch_size=10,
                parallel=4,
                max_retries=3,
                wait=True,
            )

            return [point.id for point in points]
        except Exception as e:
            print(f"Error storing documents in vector DB: {e}")
            raise SystemError(f"Error storing documents in vector DB: {e}")
        finally:
            # Clean up the document chunks
            del doc_chunks
            del doc_splitter
            del points
