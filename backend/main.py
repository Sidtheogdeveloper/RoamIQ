"""
FastAPI Backend Server — BestTime Crowd API + Elderly Mode
Run: uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from services.besttime import BestTimeClient
from routers import crowd, elderly, child, foursquare, chatbot

load_dotenv()

# ── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ── Global BestTime client ────────────────────────────────────
besttime_client: BestTimeClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global besttime_client
    private_key = os.getenv("BESTTIME_API_KEY_PRIVATE", "")
    public_key = os.getenv("BESTTIME_API_KEY_PUBLIC", "")

    if not private_key:
        print("[WARNING] BESTTIME_API_KEY_PRIVATE not set -- crowd endpoints will fail.")
    if not public_key:
        print("[WARNING] BESTTIME_API_KEY_PUBLIC not set -- forecast queries will fail.")

    besttime_client = BestTimeClient(private_key, public_key)
    yield
    await besttime_client.close()


# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="RoamIQ Backend — Crowd & Elderly Mode",
    description="BestTime API integration for crowd/traffic data and elderly-friendly travel suggestions.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server (any common dev port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ─────────────────────────────────────────
app.include_router(crowd.router)
app.include_router(elderly.router)
app.include_router(child.router)
app.include_router(foursquare.router)
app.include_router(chatbot.router)


@app.get("/")
async def root():
    return {
        "service": "RoamIQ Crowd & Elderly Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "crowd": "/api/crowd",
            "elderly": "/api/elderly",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok", "besttime_configured": bool(os.getenv("BESTTIME_API_KEY_PRIVATE"))}
