# simply-learn/fastapi-server/api/dependencies.py

import redis
from core.config import settings
from typing import Annotated

from schemas import UserInDB

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

RedisDep = Annotated[redis.Redis, get_redis_client()]

# User dependency injection
def get_current_user() -> UserInDB:
    """Dependency function to retrieve the current user from supabase"""
    # In a real application, this would extract the user from the request context
    # Here we return a dummy user for demonstration purposes
    return UserInDB(id="dummy_user_id", cognitive_profile=None)

CurrentActiveUserDep = Annotated[UserInDB, get_current_user()]
