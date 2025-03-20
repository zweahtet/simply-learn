from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from core.config import settings

from utils.vector_store import YouTubeVectorSpace, YouTubeVideoItem

router = APIRouter()
youtube_vector_space = YouTubeVectorSpace()

class VideoRecommendationRequest(BaseModel):
    content: str


@router.post("/video-recommendations")
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
            content={
                "videos": [
                    YouTubeVideoItem.model_validate(video).model_dump()
                    for video in videos
                ],
                "success": True,
            },
        )
    except Exception as e:
        print("Error in get_video_recommendations:", e)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e), "success": False},
        )
