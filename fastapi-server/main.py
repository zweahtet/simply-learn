# simply-learn/fastapi-server/main.py
import uvicorn
import logging
import logging.config
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from supabase.client import AsyncClient
from api.dependencies import get_supabase_async_client

from core.config import settings
from api.v1.router import api_v1_router
from utils.vector_store import AttachmentVectorSpace

# Create logs directory if it doesn't exist
logs_dir = Path("logs")
logs_dir.mkdir(parents=True, exist_ok=True)

# Load logging configuration
logging.config.fileConfig("core/logging.conf", disable_existing_loggers=False)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for the FastAPI app.
    """
    # Initialize the vector space
    logger.info("Application starting up ...")
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


@app.post("/token", description="Get JWT token by providing email and password")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    supabase_client: AsyncClient = Depends(get_supabase_async_client),
):
    auth_response = await supabase_client.auth.sign_in_with_password(
        {
            "email": form_data.username,  # OAuth2PasswordRequestForm uses "username" for the email
            "password": form_data.password,
        }
    )
    if not auth_response or not auth_response.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return {
        "access_token": auth_response.session.access_token,
        "token_type": "bearer",
    }


# if __name__ == "__main__":
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
