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
import stripe
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
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '').strip()
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '').strip()
PRO_LOOKUP_KEY = "pro_monthly"

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

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


class CheckoutRequest(BaseModel):
    app_user_id: str
    origin_url: str
    email: Optional[EmailStr] = None


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
        "payments_configured": bool(STRIPE_SECRET_KEY),
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


@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest):
    """Create a Stripe Checkout Session for the Pro monthly subscription.
    Returns the checkout_url to redirect the browser to."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments not configured")

    prices = stripe.Price.list(lookup_keys=[PRO_LOOKUP_KEY], active=True, limit=1).data
    if not prices:
        raise HTTPException(status_code=500, detail=f"Price not found: {PRO_LOOKUP_KEY}. Run setup_stripe.py.")
    price = prices[0]

    metadata = {"app_user_id": req.app_user_id.strip(), "lookup_key": PRO_LOOKUP_KEY}
    if req.email:
        metadata["email"] = req.email.lower().strip()

    kwargs = dict(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription" if price.recurring else "payment",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/payment/cancel",
        metadata=metadata,
    )
    if req.email:
        kwargs["customer_email"] = req.email.lower().strip()

    # tax_mode=full — US + digital subscription → SMP (Stripe manages tax)
    try:
        session = stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError as e:
        msg = (getattr(e, "user_message", "") or "").lower()
        if "managed payments" in msg or "ineligible" in msg:
            session = stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required"
            )
        else:
            raise

    await db.payment_transactions.insert_one({
        "session_id": session.id,
        "app_user_id": req.app_user_id.strip(),
        "email": metadata.get("email"),
        "lookup_key": PRO_LOOKUP_KEY,
        "amount": price.unit_amount or 0,
        "currency": price.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })

    return {"checkout_url": session.url, "session_id": session.id}


async def _mark_paid(session_id: str, s) -> None:
    """Idempotently mark a payment_transactions row paid and mirror into subscriptions."""
    email = None
    app_user_id = None
    if s.metadata:
        email = (s.metadata.get("email") or "").lower() or None
        app_user_id = s.metadata.get("app_user_id")
    if not email and getattr(s, "customer_email", None):
        email = s.customer_email.lower()
    if not email and getattr(s, "customer_details", None):
        email = (s.customer_details.get("email") if isinstance(s.customer_details, dict) else getattr(s.customer_details, "email", None))
        if email:
            email = email.lower()

    await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {
            "status": "completed",
            "payment_status": "paid",
            "email": email,
            "stripe_subscription_id": getattr(s, "subscription", None),
            "stripe_payment_intent_id": getattr(s, "payment_intent", None),
            "stripe_customer_id": getattr(s, "customer", None),
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    if app_user_id:
        await db.subscriptions.update_one(
            {"app_user_id": app_user_id},
            {"$set": {
                "app_user_id": app_user_id,
                "email": email,
                "pro_active": True,
                "stripe_subscription_id": getattr(s, "subscription", None),
                "stripe_customer_id": getattr(s, "customer", None),
                "last_session_id": session_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments not configured")
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Webhook-independent fallback: if still pending, ask Stripe directly.
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id, s)
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0}) or record
        except stripe.error.StripeError as e:
            logger.warning(f"Stripe status retrieve failed: {e}")

    return {
        "session_id": record["session_id"],
        "status": record.get("status"),
        "payment_status": record.get("payment_status"),
    }


@api_router.get("/subscription/status/{app_user_id}")
async def subscription_status(app_user_id: str):
    """Return whether the given anonymous browser user has an active Pro subscription."""
    sub = await db.subscriptions.find_one({"app_user_id": app_user_id.strip()}, {"_id": 0})
    if not sub:
        return {"app_user_id": app_user_id, "pro_active": False}

    active = bool(sub.get("pro_active"))

    # If we have a Stripe subscription id, verify with Stripe (handles cancellation/expiry)
    sub_id = sub.get("stripe_subscription_id")
    if active and sub_id and STRIPE_SECRET_KEY:
        try:
            s = stripe.Subscription.retrieve(sub_id)
            active = s.status in {"active", "trialing", "past_due"}
            if bool(sub.get("pro_active")) != active:
                await db.subscriptions.update_one(
                    {"app_user_id": app_user_id.strip()},
                    {"$set": {"pro_active": active, "updated_at": datetime.now(timezone.utc).isoformat()}},
                )
        except stripe.error.StripeError as e:
            logger.warning(f"Stripe subscription retrieve failed: {e}")

    return {"app_user_id": app_user_id, "pro_active": active, "email": sub.get("email")}


@api_router.post("/subscription/restore")
async def restore(req: RestoreRequest):
    """Restore an existing subscription by email. Looks up the most recent paid
    payment_transactions record for this email and re-associates that
    subscription with the current browser's app_user_id."""
    email = req.email.lower().strip()

    sub = await db.subscriptions.find_one({"email": email, "pro_active": True}, {"_id": 0})
    if not sub:
        # Look up via the paid payment_transactions in case subscriptions record is missing
        pt = await db.payment_transactions.find_one(
            {"email": email, "payment_status": "paid"},
            sort=[("updated_at", -1)],
        )
        if not pt:
            return {"app_user_id": None, "pro_active": False, "found": False}
        sub = {
            "app_user_id": pt.get("app_user_id"),
            "email": email,
            "stripe_subscription_id": pt.get("stripe_subscription_id"),
        }

    # Confirm current status with Stripe if available
    active = True
    sub_id = sub.get("stripe_subscription_id")
    if sub_id and STRIPE_SECRET_KEY:
        try:
            s = stripe.Subscription.retrieve(sub_id)
            active = s.status in {"active", "trialing", "past_due"}
        except stripe.error.StripeError as e:
            logger.warning(f"Stripe restore verify failed: {e}")

    await db.subscriptions.update_one(
        {"app_user_id": sub.get("app_user_id")},
        {"$set": {
            "app_user_id": sub.get("app_user_id"),
            "email": email,
            "pro_active": active,
            "stripe_subscription_id": sub_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    return {
        "app_user_id": sub.get("app_user_id"),
        "pro_active": active,
        "found": True,
    }


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.warning(f"Webhook construct_event failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    obj = event["data"]["object"]
    t = event["type"]

    if t == "checkout.session.completed":
        await _mark_paid(obj["id"], stripe.checkout.Session.retrieve(obj["id"]))
    elif t == "checkout.session.async_payment_succeeded":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}},
        )
    elif t == "checkout.session.async_payment_failed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "failed", "payment_status": "failed", "updated_at": datetime.now(timezone.utc)}},
        )
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": datetime.now(timezone.utc)}},
        )
    elif t in ("customer.subscription.deleted", "customer.subscription.updated"):
        # Mirror subscription cancellation / status changes
        status = obj.get("status")
        active = status in {"active", "trialing", "past_due"}
        await db.subscriptions.update_many(
            {"stripe_subscription_id": obj.get("id")},
            {"$set": {"pro_active": active, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    elif t == "charge.refunded":
        await db.payment_transactions.update_one(
            {"stripe_payment_intent_id": obj.get("payment_intent")},
            {"$set": {"status": "refunded", "payment_status": "refunded", "updated_at": datetime.now(timezone.utc)}},
        )

    return {"status": "ok"}


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
