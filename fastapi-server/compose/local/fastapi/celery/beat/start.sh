#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

rm -f './celerybeat.pid'
celery -A celery_main beat --loglevel=info