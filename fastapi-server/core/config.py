import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"

    # Fastembed
    FASTEMBED_MODELS_CACHE_DIR: str = "./fastembed_models"

    # Redis
    REDIS_HOST: str
    REDIS_PORT: int
    REDIS_PASSWORD: str

    # Qdrant
    QDRANT_HOST_URL: str
    QDRANT_API_KEY: str

    # HuggingFace
    HF_TOKEN: str

    # Groq
    GROQ_API_KEY: str

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
