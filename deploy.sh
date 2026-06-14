#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/shijiebei"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -f .env.backend ]; then
  echo ".env.backend not found in $APP_DIR"
  echo "Please create it before deployment."
  exit 1
fi

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f

echo "Deployment completed."
