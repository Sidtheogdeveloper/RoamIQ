"""
Chatbot router – calls Google Gemini API directly (no edge functions).
"""
from fastapi import APIRouter
from pydantic import BaseModel
import httpx, os

router = APIRouter(prefix="/api/chat", tags=["chat"])

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


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str
    error: str | None = None


@router.post("/", response_model=ChatResponse)
async def chat(req: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return ChatResponse(
            reply="",
            error="GEMINI_API_KEY not set in backend/.env — add it to enable the chatbot.",
        )

    contents = []
    contents.append({"role": "user", "parts": [{"text": SYSTEM_PROMPT}]})
    contents.append({"role": "model", "parts": [{"text": "Understood! I'm RoamIQ Travel Assistant, ready to help with all your travel questions. 🌍"}]})

    for msg in req.history[-10:]:
        role = "user" if msg.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg.get("content", "")}]})

    contents.append({"role": "user", "parts": [{"text": req.message}]})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
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
