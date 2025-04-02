# simply-learn/fastapi-server/utils/embeddings.py

from fastembed import TextEmbedding, SparseTextEmbedding, LateInteractionTextEmbedding
from core.config import settings

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
