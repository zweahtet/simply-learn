# simply-learn/fastapi-server/services/embeddings.py

from fastembed import TextEmbedding, SparseTextEmbedding, LateInteractionTextEmbedding
# from huggingface_hub import InferenceClient, login
# from sentence_transformers import SentenceTransformer
# from core.config import settings

# login(token=settings.HF_TOKEN)

# client = InferenceClient(
#     provider="hf-inference",
#     api_key=settings.HF_TOKEN,
# )

CACHE_DIR = "./models_cache"

# Initialize the embedding 
dense_embedding_model = TextEmbedding("thenlper/gte-large", cache_dir=CACHE_DIR)
sparse_embedding_model = SparseTextEmbedding("prithivida/Splade_PP_en_v1", cache_dir=CACHE_DIR)
late_interaction_embedding_model = LateInteractionTextEmbedding(
    "colbert-ir/colbertv2.0", cache_dir=CACHE_DIR
)

# dense_embedding_model = lambda text: client.feature_extraction(
#     text=text, model="mixedbread-ai/mxbai-embed-large-v1"
# )
# sparse_embedding_model = SentenceTransformer("onnx-models/Splade_PP_en_v1-onnx")
# late_interaction_embedding_model = SentenceTransformer("lightonai/colbertv2.0")
