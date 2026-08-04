#!/bin/bash

# Exit immediately if any command fails
set -e

# Run database seeding to populate initial users and wards
echo "[START] Seeding database..."
cd /app/backend
./venv/bin/python seed.py || echo "Seeding bypassed or already done"

# Start FastAPI backend in the background
echo "[START] Starting FastAPI Backend on port 8000..."
# Ensure Python handles UTF-8 for Indian language translations
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

./venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start Frontend Node.js production server in the foreground
echo "[START] Starting Node.js Frontend on port 7860..."
cd /app/frontend
export PORT=7860
node .output/server/index.mjs
