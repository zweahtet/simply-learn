# simply-learn/fastapi-server/main.py
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.v1.router import api_v1_router
from utils.vector_store import AttachmentVectorSpace


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for the FastAPI app.
    """
    # Perform startup tasks here
    # For example, initialize database connections or load configuration
    # Initialize the vector space
    # Initialize the vector space
    attachment_vector_space = AttachmentVectorSpace()
    attachment_vector_space.build_collection()

    yield
    # Perform shutdown tasks here
    # For example, close database connections or clean up resources


app = FastAPI(
    title="SimplyLearn Backend Server",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan,
)

# Allow CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {"Hello": "World"}

# if __name__ == "__main__":
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
