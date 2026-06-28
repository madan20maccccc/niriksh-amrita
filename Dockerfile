# Multi-stage build for Hugging Face Spaces (Docker SDK)
FROM node:20-slim

# Install system dependencies (Python, SQLite, curl)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up backend code and virtual environment
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN python3 -m venv venv
RUN venv/bin/pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Set up frontend code and build production server
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NITRO_PRESET=node-server
RUN npm run build

# Expose Hugging Face Space port (7860)
EXPOSE 7860

# Add startup supervisor script
WORKDIR /app
COPY start.sh ./
RUN chmod +x start.sh

# Run startup script
CMD ["./start.sh"]
