# simply-learn/fastapi-server/main.py
from pydantic import BaseModel
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from api.v1.router import api_v1_router


app = FastAPI(
    title="SimplyLearn Backend Server",
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

# Allow CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.API_V1_STR)


@app.get("/")
def read_root():
    return {"Hello": "World"}
