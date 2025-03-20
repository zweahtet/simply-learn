from fastapi import APIRouter
from api.v1.endpoints import files, videos

api_v1_router = APIRouter()
api_v1_router.include_router(files.router, prefix="/files", tags=["files"])
api_v1_router.include_router(videos.router, prefix="/videos", tags=["videos"])
