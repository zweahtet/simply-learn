import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"

    # Qdrant 
    QDRANT_URL: str
    QDRANT_API_KEY: str

    # HuggingFace
    HF_TOKEN: str

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()