#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

# For debugging purposes
echo "Current directory: $(pwd)"
echo "Files in current directory: $(ls -la)"
echo "Starting FastAPI application..."

# More verbose logging
uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir /app/api \
    --reload-dir /app/core \
    --reload-dir /app/services \
    --reload-dir /app/utils \
    --reload-dir /app/tasks \
    --reload-include "*.py" \
    --reload-exclude "*.pyc,__pycache__,.git,node_modules,temp_files,images,logs,fastembed_models" \
    --log-level debug \
    --limit-concurrency 100 \
    --timeout-keep-alive 30
