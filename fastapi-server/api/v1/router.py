from fastapi import APIRouter
from api.v1.endpoints import files

router = APIRouter()
router.include_router(files.router, prefix="/files", tags=["files"])