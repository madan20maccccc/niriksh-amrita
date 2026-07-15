from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load environmental configs
load_dotenv()

# Run database creation migrations
import models
from database import engine
models.Base.metadata.create_all(bind=engine)

# Import routes
from routes import vitals

app = FastAPI(
    title="NirikshAmrita API",
    description="Agentic Clinical Early Warning Surveillance Platform backend",
    version="2.0.0"
)

# Set up CORS so the React frontend can talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # During development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(vitals.router, prefix="/vitals", tags=["Vitals Ingestion"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "NirikshAmrita",
        "version": "2.0.0",
        "stages_active": [1, 2]
    }
