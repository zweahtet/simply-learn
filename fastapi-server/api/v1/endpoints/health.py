import logging
from fastapi import APIRouter, status, Depends
from celery_main import celery_app
from api.dependencies import RedisDep

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
async def health_check(redis_client: RedisDep):
    """
    Health check endpoint to ensure the API and its dependencies are operational.
    Used by Docker health checks and monitoring systems.
    """
    health_status = {
        "status": "healthy",
        "api": True,
        "redis": False,
        "celery": False,
    }

    # Check Redis connection
    try:
        redis_ping = redis_client.ping()
        health_status["redis"] = redis_ping
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_status["status"] = "degraded"

    # Check Celery/Redis connection
    try:
        # Simple check to ensure Celery can communicate with Redis
        i = celery_app.control.inspect()
        if not i.active_queues():
            health_status["celery"] = False
            health_status["status"] = "degraded"
        else:
            health_status["celery"] = True
    except Exception as e:
        logger.error(f"Celery health check failed: {e}")
        health_status["status"] = "degraded"

    # If any critical service is down, change status
    if not health_status["redis"]:
        health_status["status"] = "unhealthy"

    return health_status
