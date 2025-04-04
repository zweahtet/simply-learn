# simply-learn/fastapi-server/utils/embeddings.py
from typing import List
from google.genai import Client as GoogleGenAIClient
from google.genai.types import EmbedContentConfig, ContentListUnion, ContentEmbedding
from fastembed import TextEmbedding, SparseTextEmbedding, LateInteractionTextEmbedding
from core.config import settings

# Initialize Google GenAI client
google_genai_client = GoogleGenAIClient(api_key=settings.GOOGLE_GEMINI_API_KEY)


class GoogleGeminiEmbeddingFunction:
    def __init__(self, model_name: str):
        self.model_name = model_name

    def embed_text(self, contents: ContentListUnion, task_type: str = "RETRIEVAL_DOCUMENT"):
        """
        Generate text embeddings for a single text or batch of texts.

        Args:
            contents: Single text string or list of text strings to embed
            task_type: The type of task for which embeddings are generated

        Returns:
            For a single input: A single embedding vector
            For a batch input: A list of embedding vectors, one for each input text
        """
        response = google_genai_client.models.embed_content(
            model=self.model_name,
            contents=contents,
            config=EmbedContentConfig(task_type=task_type, output_dimensionality=1536),
        )

        # If a single text was provided, return a single embedding
        if isinstance(contents, str) or (
            isinstance(contents, list) and len(contents) == 1
        ):
            return response.embeddings[0].values
        # If multiple texts were provided, return a list of embeddings
        else:
            return [embedding.values for embedding in response.embeddings]


# Initialize the embedding
# dense_embedding_model = TextEmbedding(
#     "thenlper/gte-large", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
# ) # dimension 1024
# sparse_embedding_model = SparseTextEmbedding(
#     "prithivida/Splade_PP_en_v1", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
# )
# late_interaction_embedding_model = LateInteractionTextEmbedding(
#     "colbert-ir/colbertv2.0", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
# ) # dimension 128

# Add these module-level variables to cache the initialized models
_dense_embedding_model = None
_sparse_embedding_model = None
_late_interaction_embedding_model = None


def get_dense_embedding_model():
    """Lazy-load and cache the dense embedding model"""
    global _dense_embedding_model
    if _dense_embedding_model is None:
        _dense_embedding_model = TextEmbedding(
            "thenlper/gte-large", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
        )
    return _dense_embedding_model


def get_sparse_embedding_model():
    """Lazy-load and cache the sparse embedding model"""
    global _sparse_embedding_model
    if _sparse_embedding_model is None:
        _sparse_embedding_model = SparseTextEmbedding(
            "prithivida/Splade_PP_en_v1", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
        )
    return _sparse_embedding_model


def get_late_interaction_embedding_model():
    """Lazy-load and cache the late interaction embedding model"""
    global _late_interaction_embedding_model
    if _late_interaction_embedding_model is None:
        _late_interaction_embedding_model = LateInteractionTextEmbedding(
            "colbert-ir/colbertv2.0", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
        )
    return _late_interaction_embedding_model
