"""
RoamIQ Chatbot — Standalone FastAPI server with Gemini AI.
Runs independently on port 8001 and serves a self-injecting JS widget.

Run:  python -m uvicorn main:app --port 8001 --reload
"""

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

SYSTEM_PROMPT = """You are RoamIQ Travel Assistant — a friendly, knowledgeable travel chatbot.
You help travelers with:
- Destination recommendations and travel tips
- Local customs, cuisine, and must-see attractions
- Budget advice and packing suggestions
- Safety tips and emergency info
- Itinerary suggestions and day planning

Keep responses concise (2-4 paragraphs max), warm, and practical.
Use relevant emojis sparingly. If you don't know something, say so honestly.
Always be helpful and enthusiastic about travel!"""

app = FastAPI(title="RoamIQ Chatbot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str
    error: str | None = None


# ── Chat endpoint ─────────────────────────────────────────────

@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not GEMINI_API_KEY:
        return ChatResponse(
            reply="",
            error="GEMINI_API_KEY not set in chatbot/.env — add it to enable the chatbot.",
        )

    contents = []
    contents.append({"role": "user", "parts": [{"text": SYSTEM_PROMPT}]})
    contents.append({
        "role": "model",
        "parts": [{"text": "Understood! I'm RoamIQ Travel Assistant, ready to help with all your travel questions. 🌍"}],
    })

    for msg in req.history[-10:]:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

    contents.append({"role": "user", "parts": [{"text": req.message}]})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 512,
                        "topP": 0.9,
                    },
                },
            )
            data = resp.json()

            if "candidates" in data and data["candidates"]:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return ChatResponse(reply=text)
            elif "error" in data:
                return ChatResponse(reply="", error=data["error"].get("message", "Gemini API error"))
            else:
                return ChatResponse(reply="", error="No response from Gemini")
    except Exception as e:
        return ChatResponse(reply="", error=str(e))


# ── Serve widget JS ──────────────────────────────────────────

WIDGET_DIR = Path(__file__).parent / "widget"


@app.get("/widget.js")
async def serve_widget():
    return FileResponse(WIDGET_DIR / "widget.js", media_type="application/javascript")


# ── Health check ─────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "RoamIQ Chatbot",
        "version": "1.0.0",
        "gemini_configured": bool(GEMINI_API_KEY),
        "usage": 'Add <script src="http://localhost:8001/widget.js"></script> to your HTML',
    }
