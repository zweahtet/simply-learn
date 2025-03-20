# simply-learn/fastapi-server/api/dependencies.py

import redis
from core.config import settings
from typing import Annotated
from fastapi import Depends

from schemas import UserInDB, CognitiveProfile

# Redis dependency injection
def get_redis_client():
    """Dependency function for Redis client"""
    client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
    )
    try:
        yield client
    finally:
        client.close()  # Properly close Redis connection

RedisDep = Annotated[redis.Redis, Depends(get_redis_client)]


# User dependency injection
def get_current_user():
    """Dependency function to retrieve the current user from supabase"""
    # In a real application, this would extract the user from the request context
    # Here we return a dummy user for demonstration purposes
    profile = CognitiveProfile(
        memory=3, attention=2, language=2, visual_spatial=4, executive=4
    )

    return UserInDB(id="dummy_user_id", cognitive_profile=profile)


CurrentActiveUserDep = Annotated[UserInDB, Depends(get_current_user)]
