import logging
from core.config import settings
from celery import Celery


# Configure logging
logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    "tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "tasks.document_processing",
        # Add additional task modules here
    ],
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_max_memory_per_child=500
    * 1024
    * 1024,  # 500 MB, restart workers after processing 500 MB
    worker_prefetch_multiplier=1,  # Process one task at a time
    task_acks_late=True,  # Acknowledge tasks after completion
    task_time_limit=600,  # 10 minutes time limit for each task
    task_soft_time_limit=300,  # 5 minutes soft time limit for each task
    worker_send_task_events=True,  # Required for monitoring tasks
    task_send_sent_event=True,  # Required for task tracking
    # Add heartbeat for better monitoring
    broker_heartbeat=10,
    # Task result configuration
    task_ignore_result=False,
    result_expires=3600,  # Results expire after 1 hour
)


# Add startup/shutdown logging
@celery_app.task(bind=True)
def debug_task(self):
    logger.info(f"Request: {self.request!r}")


@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    logger.info("Celery worker initialized and ready to process tasks.")
