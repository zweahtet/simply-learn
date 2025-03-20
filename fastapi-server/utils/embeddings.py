# simply-learn/fastapi-server/utils/embeddings.py

from fastembed import TextEmbedding, SparseTextEmbedding, LateInteractionTextEmbedding
from core.config import settings

# Initialize the embedding
dense_embedding_model = TextEmbedding(
    "thenlper/gte-large", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
) # dimension 1024
sparse_embedding_model = SparseTextEmbedding(
    "prithivida/Splade_PP_en_v1", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
)
late_interaction_embedding_model = LateInteractionTextEmbedding(
    "colbert-ir/colbertv2.0", cache_dir=settings.FASTEMBED_MODELS_CACHE_DIR
) # dimension 128
