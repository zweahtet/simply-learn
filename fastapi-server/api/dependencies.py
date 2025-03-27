# simply-learn/fastapi-server/api/dependencies.py
import logging
import redis
from core.config import settings
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from schemas import UserInDB, CognitiveProfile
from gotrue.types import User
from supabase.client import AsyncClient, create_async_client, AsyncClientOptions

logger = logging.getLogger(__name__)

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
# def get_current_user():
#     """Dependency function to retrieve the current user from supabase"""
#     # In a real application, this would extract the user from the request context
#     # Here we return a dummy user for demonstration purposes
#     profile = CognitiveProfile(
#         memory=3, attention=2, language=2, visuospatial=4, executive=4
#     )

#     return UserInDB(id="dummy_user_id", cognitive_profile=profile)


# CurrentActiveUserDep = Annotated[UserInDB, Depends(get_current_user)]

# Supabase dependency injection
# https://supabase.com/docs/reference/python/select
async def get_supabase_async_client() -> AsyncClient:
    """for validation access_token init at life span event"""
    supabase_client = await create_async_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_ANON_KEY,
        options=AsyncClientOptions(
            auto_refresh_token=True,
        ),
    )

    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not initialized",
        )

    return supabase_client


SupabaseAsyncClientDep = Annotated[AsyncClient, Depends(get_supabase_async_client)]

# Security dependency injection
security_scheme = HTTPBearer(
    auto_error=False,
)
AuthDep = Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)]

async def get_current_user(
    authorization: AuthDep,
    supabase_client: SupabaseAsyncClientDep,
):
    """Get current user from access_token and validate it with supabase"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )

    if not supabase_client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not initialized",
        )

    # Verify jwt using supabase
    user_rsp = await supabase_client.auth.get_user(jwt=authorization.credentials)
    if not user_rsp:
        logger.error("User not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return user_rsp.user

CurrentActiveUserDep = Annotated[User, Depends(get_current_user)]
