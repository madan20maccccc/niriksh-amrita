#!/bin/bash

# Exit immediately if any command fails
set -e

# Start FastAPI backend in the background
echo "[START] Starting FastAPI Backend on port 8000..."
cd /app/backend
./venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start Frontend Node.js production server in the foreground
echo "[START] Starting Node.js Frontend on port 7860..."
cd /app/frontend
export PORT=7860
node .output/server/index.mjs
