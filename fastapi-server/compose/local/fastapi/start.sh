#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

# Production-optimized settings
uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir /app \
    --reload-include "*.py" \
    --reload-exclude "*.pyc,__pycache__,.git,node_modules,temp_files,images" \
    --no-access-log \
    --workers $(nproc) \
    --timeout-keep-alive 30
