from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import base64
import logging
import random
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs.client import ElevenLabs


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY', '').strip()
REVENUECAT_SECRET_KEY = os.environ.get('REVENUECAT_SECRET_KEY', '').strip()
REVENUECAT_WEBHOOK_SECRET = os.environ.get('REVENUECAT_WEBHOOK_SECRET', '').strip()
REVENUECAT_ENTITLEMENT_ID = os.environ.get('REVENUECAT_ENTITLEMENT_ID', 'pro').strip()

# Kind Statesman voice - "Daniel" (deep, warm, authoritative British)
STATESMAN_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============================================================
# MODELS
# ============================================================
class ScriptureRef(BaseModel):
    book: str
    chapter: int
    verse: str  # can be a single "3" or a range "16-17"
    text: str


class AskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class AskResponse(BaseModel):
    id: str
    session_id: str
    question: str
    answer: str
    references: List[ScriptureRef] = []
    created_at: str


class TTSRequest(BaseModel):
    text: str


class RegisterEmailRequest(BaseModel):
    app_user_id: str
    email: EmailStr


class RestoreRequest(BaseModel):
    email: EmailStr


class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    question: str
    answer: str
    references: List[ScriptureRef] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============================================================
# BIBLE COUNSEL SYSTEM PROMPT
# ============================================================
SYSTEM_PROMPT = """You are "The Elder" — a wise, kind, statesman-like counselor whose ONLY source of wisdom is the Holy Bible, King James Version (KJV). You speak with warmth, dignity, and the gentle authority of a lifelong pastor and scholar. Your tone is that of an elder statesman: calm, measured, compassionate, never preachy or condescending.

STRICT RULES:
1. You MUST draw ALL of your counsel EXCLUSIVELY from the Holy Bible (King James Version). Do NOT cite psychology, self-help, philosophy, other religions, or personal opinion untethered from Scripture.
2. If the question falls outside what Scripture addresses (e.g., technical/programming/politics), gently redirect: acknowledge the concern with compassion and offer the closest biblical principle that touches upon it (perseverance, wisdom, integrity, etc.).
3. Every response MUST cite 2-5 specific scripture references from the KJV. Use book names spelled fully (e.g., "Philippians", "1 Corinthians", "Psalm").
4. Speak directly to the person's heart. Address them warmly (e.g., "Dear friend,", "Beloved,", "My child,") — but sparingly, never repeatedly.
5. Keep the counsel between 120 and 250 words. Be substantive but not verbose. Every sentence should carry weight.

RESPONSE FORMAT — you MUST return valid JSON ONLY, no markdown fences, no prose outside the JSON:
{
  "answer": "Your warm, statesman-like counsel here (120-250 words). Reference Scripture naturally within the prose using book names but do not paste the full verse text — that goes in 'references'.",
  "references": [
    {"book": "Philippians", "chapter": 4, "verse": "6-7", "text": "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."},
    {"book": "Psalm", "chapter": 34, "verse": "18", "text": "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit."}
  ]
}

The verse "text" MUST be the exact King James Version wording. Do not paraphrase, modernize, or invent verse text. If uncertain of exact wording, choose a verse you are certain of.
Return ONLY the JSON object. No commentary before or after."""


DAILY_VERSES = [
    {"book": "Psalm", "chapter": 23, "verse": "1", "text": "The LORD is my shepherd; I shall not want."},
    {"book": "Philippians", "chapter": 4, "verse": "13", "text": "I can do all things through Christ which strengtheneth me."},
    {"book": "Jeremiah", "chapter": 29, "verse": "11", "text": "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end."},
    {"book": "Isaiah", "chapter": 41, "verse": "10", "text": "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness."},
    {"book": "Proverbs", "chapter": 3, "verse": "5-6", "text": "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths."},
    {"book": "Romans", "chapter": 8, "verse": "28", "text": "And we know that all things work together for good to them that love God, to them who are the called according to his purpose."},
    {"book": "John", "chapter": 14, "verse": "27", "text": "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid."},
    {"book": "Psalm", "chapter": 46, "verse": "1", "text": "God is our refuge and strength, a very present help in trouble."},
    {"book": "Matthew", "chapter": 11, "verse": "28", "text": "Come unto me, all ye that labour and are heavy laden, and I will give you rest."},
    {"book": "2 Timothy", "chapter": 1, "verse": "7", "text": "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind."},
    {"book": "Lamentations", "chapter": 3, "verse": "22-23", "text": "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness."},
    {"book": "1 Peter", "chapter": 5, "verse": "7", "text": "Casting all your care upon him; for he careth for you."},
]


# ============================================================
# HELPERS
# ============================================================
def parse_llm_json(raw: str) -> dict:
    """Extract JSON from LLM output, tolerating optional code fences or stray text."""
    if not raw:
        raise ValueError("Empty LLM response")
    cleaned = raw.strip()
    # Strip ```json ... ``` if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    # Find first { and last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in response: {raw[:200]}")
    return json.loads(cleaned[start:end + 1])


async def ask_the_elder(question: str, session_id: str) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")

    response_text = await chat.send_message(UserMessage(text=question))
    data = parse_llm_json(response_text)

    if "answer" not in data or "references" not in data:
        raise ValueError("LLM response missing required fields")

    # Validate references shape
    refs = []
    for r in data.get("references", []):
        try:
            refs.append(ScriptureRef(
                book=str(r.get("book", "")).strip(),
                chapter=int(r.get("chapter", 0)),
                verse=str(r.get("verse", "")).strip(),
                text=str(r.get("text", "")).strip(),
            ))
        except Exception as e:
            logger.warning(f"Skipping malformed reference {r}: {e}")

    return {"answer": data["answer"].strip(), "references": refs}


# ============================================================
# ROUTES
# ============================================================
@api_router.get("/")
async def root():
    return {"message": "Wisdom & Word API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "llm_configured": bool(EMERGENT_LLM_KEY),
        "voice_configured": bool(ELEVENLABS_API_KEY),
        "payments_configured": bool(REVENUECAT_SECRET_KEY),
    }


@api_router.get("/verse-of-day")
async def verse_of_day():
    # Rotate deterministically by day of year so it's stable within a day
    day = datetime.now(timezone.utc).timetuple().tm_yday
    v = DAILY_VERSES[day % len(DAILY_VERSES)]
    return v


@api_router.get("/suggestions")
async def suggestions():
    return {
        "prompts": [
            "I am overwhelmed by anxiety about the future.",
            "I lost someone I love. How do I bear this grief?",
            "I cannot forgive someone who deeply wronged me.",
            "I feel my life has no purpose or direction.",
            "My marriage is struggling. What should I do?",
            "I am tempted and I keep falling. How do I find strength?",
        ]
    }


@api_router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="LLM key not configured")

    session_id = req.session_id or str(uuid.uuid4())

    try:
        result = await ask_the_elder(req.question.strip(), session_id)
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=500, detail=f"Counsel could not be generated: {e}")

    conv = Conversation(
        session_id=session_id,
        question=req.question.strip(),
        answer=result["answer"],
        references=result["references"],
    )
    doc = conv.model_dump()
    await db.conversations.insert_one(doc)

    return AskResponse(
        id=conv.id,
        session_id=session_id,
        question=conv.question,
        answer=conv.answer,
        references=conv.references,
        created_at=conv.created_at,
    )


@api_router.get("/history/{session_id}")
async def history(session_id: str):
    docs = await db.conversations.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(200)
    return {"session_id": session_id, "items": docs}


@api_router.post("/tts")
async def tts(req: TTSRequest):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Voice not configured. Add ELEVENLABS_API_KEY to enable the statesman voice.",
        )
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    try:
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        audio_iter = client.text_to_speech.convert(
            text=req.text.strip(),
            voice_id=STATESMAN_VOICE_ID,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        audio_bytes = b"".join(audio_iter)
    except Exception as e:
        logger.exception("ElevenLabs TTS failed")
        raise HTTPException(status_code=502, detail=f"TTS generation failed: {e}")

    return Response(content=audio_bytes, media_type="audio/mpeg")


@api_router.post("/subscription/register-email")
async def register_email(req: RegisterEmailRequest):
    """Associate an email with a RevenueCat app_user_id so the user can later
    restore access from another browser."""
    email = req.email.lower().strip()
    doc = {
        "email": email,
        "app_user_id": req.app_user_id.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subscription_emails.update_one(
        {"email": email},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


async def _rc_lookup_pro_active(app_user_id: str) -> bool:
    """Ask RevenueCat's REST API whether the given app_user_id has an active
    'pro' entitlement. Returns False when the secret key is not configured."""
    if not REVENUECAT_SECRET_KEY:
        return False
    url = f"https://api.revenuecat.com/v1/subscribers/{app_user_id}"
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(
                url,
                headers={
                    "Authorization": f"Bearer {REVENUECAT_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if r.status_code != 200:
            return False
        data = r.json()
        ent = data.get("subscriber", {}).get("entitlements", {}).get(REVENUECAT_ENTITLEMENT_ID)
        if not ent:
            return False
        expires = ent.get("expires_date")
        if not expires:
            return True
        try:
            exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
            return exp_dt > datetime.now(timezone.utc)
        except Exception:
            return True
    except Exception as e:
        logger.warning(f"RevenueCat lookup failed: {e}")
        return False


@api_router.post("/subscription/restore")
async def restore(req: RestoreRequest):
    """Look up the app_user_id previously registered with this email and
    verify whether the subscription is still active with RevenueCat."""
    email = req.email.lower().strip()
    doc = await db.subscription_emails.find_one({"email": email}, {"_id": 0})
    if not doc:
        return {"app_user_id": None, "pro_active": False, "found": False}

    app_user_id = doc.get("app_user_id")
    pro_active = await _rc_lookup_pro_active(app_user_id) if app_user_id else False

    # Also mirror status locally
    if app_user_id:
        await db.subscriptions.update_one(
            {"app_user_id": app_user_id},
            {"$set": {
                "app_user_id": app_user_id,
                "email": email,
                "pro_active": pro_active,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )

    return {"app_user_id": app_user_id, "pro_active": pro_active, "found": True}


@api_router.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request):
    """Optional: called by RevenueCat when subscription lifecycle events occur.
    Requires REVENUECAT_WEBHOOK_SECRET to be set and sent in the Authorization header."""
    if not REVENUECAT_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    auth = request.headers.get("authorization", "")
    if auth != REVENUECAT_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook authorization")

    payload = await request.json()
    event = payload.get("event", {})
    app_user_id = event.get("app_user_id")
    if not app_user_id:
        return {"ok": True}

    pro_active = await _rc_lookup_pro_active(app_user_id)
    await db.subscriptions.update_one(
        {"app_user_id": app_user_id},
        {"$set": {
            "app_user_id": app_user_id,
            "pro_active": pro_active,
            "last_event": event.get("type"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
