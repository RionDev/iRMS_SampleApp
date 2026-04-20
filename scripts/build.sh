#!/bin/bash
# Build sample app.
# Usage: ./scripts/build.sh <API_BASE_URL>

set -euo pipefail

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NAME="sample"
API_BASE_URL="${1:?Usage: $0 <API_BASE_URL>}"

echo ""
echo "==> Building $NAME"

docker run --rm \
    -v "$SERVICE_DIR:/app" \
    -w /app \
    -e "VITE_API_BASE_URL=$API_BASE_URL" \
    node:18-alpine \
    sh -c "npm install && npm run build"

echo "   done: $SERVICE_DIR/dist"
