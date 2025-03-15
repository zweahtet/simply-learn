# simply-learn/fastapi-server/main.py

from typing import Optional, Union, List
from pydantic import BaseModel
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from services.vector_db import *

youtube_vector_space = YouTubeVectorSpace()


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


@app.get("/")
def read_root():
    return {"Hello": "World"}

class VideoRecommendationRequest(BaseModel):
    content: str


@app.post("/video-recommendations")
def get_video_recommendations(
    requestBody: VideoRecommendationRequest,
):
    """
    Recommend youtube videos based on a query string.
    """
    try:
        videos = youtube_vector_space.recommend(query=requestBody.content)
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"videos": [
                YouTubeVideoItem.model_validate(video).model_dump()
                for video in videos
            ], "success": True},
        )
    except Exception as e:
        print("Error in get_video_recommendations:", e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e), "success": False},
        )

