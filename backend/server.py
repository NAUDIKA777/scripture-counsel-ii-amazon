from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import Response, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import base64
import logging
import random
import secrets
import html as html_lib
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
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
REVENUECAT_WEBHOOK_AUTH = os.environ.get('REVENUECAT_WEBHOOK_AUTH', '').strip()

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


class ScriptureLocation(BaseModel):
    """A biblical/ancient geographical location referenced in the counsel."""
    ancient_name: str
    significance: str
    modern_name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    map_query: str
    image_url: Optional[str] = None
    wiki_url: Optional[str] = None
    wiki_extract: Optional[str] = None


class DoreIllustration(BaseModel):
    """A public-domain 1866 Gustave Doré Bible engraving from Wikimedia Commons."""
    title: str                # cleaned display title, e.g., "The Sermon on the Mount"
    image_url: str            # thumbnail-safe URL for card rendering
    hires_url: str            # original file for Save/Print (usually same as image_url on Commons)
    wiki_url: Optional[str] = None       # attribution page (Commons file page)
    description: Optional[str] = None    # short caption from extmetadata


class AskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class AskResponse(BaseModel):
    id: str
    session_id: str
    question: str
    answer: str
    references: List[ScriptureRef] = []
    locations: List[ScriptureLocation] = []
    illustration: Optional[DoreIllustration] = None
    created_at: str


class TTSRequest(BaseModel):
    text: str


class CreateShareRequest(BaseModel):
    book: str
    chapter: int
    verse: str
    text: str
    image_data_url: Optional[str] = None  # data:image/png;base64,...
    origin_url: Optional[str] = None  # public base URL from the browser


class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    question: str
    answer: str
    references: List[ScriptureRef] = []
    locations: List[ScriptureLocation] = []
    illustration: Optional[DoreIllustration] = None
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

LOCATION DETECTION:
6. If any cited verse, referenced passage, or the counsel itself mentions a specific geographical place — a named city (Jerusalem, Corinth, Ephesus, Bethlehem, Damascus, Rome, Nineveh), mountain (Mount Sinai, Mount of Olives, Mount Carmel, Golgotha), body of water (Sea of Galilee, Jordan River, Red Sea, Dead Sea), or ancient region (Judea, Galatia, Samaria, Babylon) — you MUST include it in the "locations" array of your response.
7. Only include locations that actually appear in the Scripture you cite or in the counsel prose. Do NOT invent locations. If nothing geographic is referenced, return an empty "locations" array.
8. For each location provide:
   - "ancient_name": the biblical / ancient name as it appears in the KJV (e.g., "Ephesus", "Mount Sinai")
   - "significance": 1–2 concise sentences on what happened there biblically or its role in Scripture
   - "modern_name": current city / region and modern country (e.g., "Near modern-day Selçuk, Turkey")
   - "lat" and "lng": approximate decimal coordinates ONLY if you are confident (e.g., Jerusalem ≈ 31.7683, 35.2137). If uncertain, omit these fields entirely rather than guess.
   - "map_query": a plain-English search string safe for any mapping API (e.g., "Ephesus ancient ruins, Selçuk, Turkey" or "Sea of Galilee, Israel")

RESPONSE FORMAT — you MUST return valid JSON ONLY, no markdown fences, no prose outside the JSON:
{
  "answer": "Your warm, statesman-like counsel here (120-250 words). Reference Scripture naturally within the prose using book names but do not paste the full verse text — that goes in 'references'.",
  "references": [
    {"book": "Philippians", "chapter": 4, "verse": "6-7", "text": "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."},
    {"book": "Psalm", "chapter": 34, "verse": "18", "text": "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit."}
  ],
  "locations": [
    {"ancient_name": "Philippi", "significance": "The Roman colony in Macedonia where Paul planted a beloved church and later wrote his letter to them from prison.", "modern_name": "Near modern-day Filippoi, Greece", "lat": 41.0136, "lng": 24.2870, "map_query": "Philippi archaeological site, Greece"}
  ],
  "illustration_theme": "sermon on the mount"
}

ILLUSTRATION_THEME field (new, required):
- Choose 2-5 short keywords naming the single best scene from Gustave Doré's 1866 illustrated Bible that would visually accompany this counsel.
- Prefer scenes tied to your cited scripture references. Examples of themes Doré depicted: "the creation of light", "noah's ark deluge", "abraham and isaac", "moses receiving tables of the law", "david and goliath", "psalm shepherd", "daniel in the lions den", "jonah cast into the sea", "the nativity", "the sermon on the mount", "the good samaritan", "the prodigal son", "peter walking on the water", "the storm on the sea of galilee", "the crucifixion", "the resurrection", "the ascension", "vision of the new jerusalem".
- If the counsel is abstract with no obvious biblical scene, still choose the closest fit (e.g., anxiety → "peter walking on the water" or "the storm on the sea of galilee").
- Keep it lowercase, 2-5 words, plain English. This is used for keyword search against Doré's engravings.

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
# WIKIMEDIA IMAGE LOOKUP — free, no API key needed.
# Uses Wikipedia's REST summary endpoint which returns a thumbnail (sourced
# from Wikimedia Commons) plus a canonical page URL for attribution.
# ============================================================
WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php"
WIKI_USER_AGENT = "WisdomAndWordApp/1.0 (contact@wisdomandword.com)"


async def _wiki_lookup(query: str) -> Optional[dict]:
    """Return {image_url, wiki_url, wiki_extract} for a biblical place, using
    the Wikipedia REST API. Cached in Mongo — biblical places are stable."""
    q = (query or "").strip()
    if not q:
        return None

    key = q.lower()
    cached = await db.location_images.find_one({"query": key}, {"_id": 0})
    if cached:
        return cached.get("result")

    headers = {
        "User-Agent": WIKI_USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "en",
    }

    async def store(result: Optional[dict]) -> Optional[dict]:
        await db.location_images.update_one(
            {"query": key},
            {"$set": {"query": key, "result": result,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return result

    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            # First: direct title lookup (fast path — most biblical places have exact pages)
            title = q.replace(" ", "_")
            r = await client.get(WIKI_SUMMARY_URL.format(title=title), headers=headers)
            if r.status_code == 404:
                # Fallback: search for the best matching page title, then fetch it
                sr = await client.get(
                    WIKI_SEARCH_URL,
                    params={"action": "query", "list": "search", "srsearch": q,
                            "srlimit": 1, "format": "json"},
                    headers=headers,
                )
                if sr.status_code == 200:
                    hits = sr.json().get("query", {}).get("search", [])
                    if hits:
                        best = hits[0]["title"].replace(" ", "_")
                        r = await client.get(WIKI_SUMMARY_URL.format(title=best), headers=headers)

            if r.status_code != 200:
                logger.info(f"Wikipedia {r.status_code} for '{q}'")
                return await store(None)

            data = r.json()

            # Prefer the original (full-size) image; fall back to thumbnail
            image_url = None
            orig = data.get("originalimage") or {}
            thumb = data.get("thumbnail") or {}
            if orig.get("source"):
                image_url = orig["source"]
            elif thumb.get("source"):
                image_url = thumb["source"]

            wiki_url = (data.get("content_urls", {}) or {}).get("desktop", {}).get("page")
            extract = data.get("extract")

            if not image_url:
                return await store(None)

            return await store({
                "image_url": image_url,
                "wiki_url": wiki_url,
                "wiki_extract": extract[:220] if extract else None,
            })
    except Exception as e:
        logger.warning(f"Wikipedia lookup failed for '{q}': {e}")
        return None


async def _enrich_locations(locations: List[ScriptureLocation]) -> List[ScriptureLocation]:
    """Attach Wikimedia photos + attribution URLs to each location.
    Uses ancient_name first, then falls back to map_query. Cached in Mongo,
    so each biblical place is looked up at most once."""
    enriched: List[ScriptureLocation] = []
    for loc in locations:
        if loc.image_url:
            enriched.append(loc)
            continue
        result = await _wiki_lookup(loc.ancient_name) or await _wiki_lookup(loc.map_query)
        if result:
            enriched.append(loc.model_copy(update={
                "image_url": result.get("image_url"),
                "wiki_url": result.get("wiki_url"),
                "wiki_extract": result.get("wiki_extract"),
            }))
        else:
            enriched.append(loc)
    return enriched


# ============================================================
# GUSTAVE DORÉ 1866 BIBLE ENGRAVING LOOKUP — public-domain woodcut style
# from Wikimedia Commons category. Fetched and cached once forever.
# ============================================================
DORE_ARTICLE = "Gustave_Doré's_illustrations_for_La_Grande_Bible_de_Tours"
DORE_CATALOG_KEY = "dore_bible_catalog_v3"


_STOPWORDS = {"the", "a", "an", "of", "and", "in", "on", "at", "to", "with", "by", "from", "into"}


def _tokens(s: str) -> set:
    s = re.sub(r"[^a-z0-9\s]", " ", (s or "").lower())
    return {t for t in s.split() if t and t not in _STOPWORDS and len(t) > 1}


def _clean_dore_title(raw: str) -> str:
    """Turn a Commons file title like 'File:074.The Sermon on the Mount.jpg' or
    'File:DoreJesusSeaGalilee.jpg' into a readable display title."""
    t = raw
    if t.lower().startswith("file:"):
        t = t[5:]
    t = re.sub(r"\.[a-z0-9]{2,4}$", "", t, flags=re.I)
    t = re.sub(r"^\d+[\.\-_ ]+", "", t)
    t = t.replace("_", " ").strip()
    # CamelCase → spaced words (e.g., "DoreJesusSeaGalilee" → "Dore Jesus Sea Galilee")
    if " " not in t and re.search(r"[a-z][A-Z]", t):
        t = re.sub(r"([a-z])([A-Z])", r"\1 \2", t)
        t = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", t)
    # Strip a redundant leading "Dore" / "Doré"
    t = re.sub(r"^Dor[eé]\s+", "", t, flags=re.I)
    return t.strip()


async def _load_dore_catalog() -> List[dict]:
    cached = await db.kv_cache.find_one({"_id": DORE_CATALOG_KEY}, {"_id": 0})
    if cached and cached.get("items"):
        return cached["items"]

    headers = {"User-Agent": WIKI_USER_AGENT, "Accept": "application/json"}
    items: List[dict] = []

    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            # 1) Fetch media list from the Wikipedia article — richest source
            r = await client.get(
                f"https://en.wikipedia.org/api/rest_v1/page/media-list/{DORE_ARTICLE}",
                headers=headers,
            )
            file_titles: List[str] = []
            captions: dict = {}
            if r.status_code == 200:
                data = r.json()
                for m in data.get("items", []) or []:
                    t = m.get("title", "")
                    if t.lower().endswith((".jpg", ".jpeg", ".png", ".tif", ".tiff")) or t.startswith("File:"):
                        file_titles.append(t if t.startswith("File:") else f"File:{t.lstrip('/')}")
                        cap = ((m.get("caption") or {}).get("text") or "").strip()
                        if cap:
                            captions[file_titles[-1]] = re.sub(r"<[^>]+>", " ", cap).strip()

            # 2) For each file title, resolve URL + hires via Commons imageinfo
            #    (batch in groups of 50 to respect the API limit)
            for i in range(0, len(file_titles), 50):
                batch = file_titles[i:i + 50]
                params = {
                    "action": "query",
                    "titles": "|".join(batch),
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata",
                    "iiurlwidth": "1200",
                    "format": "json",
                }
                rr = await client.get("https://commons.wikimedia.org/w/api.php",
                                      params=params, headers=headers)
                if rr.status_code != 200:
                    continue
                pages = ((rr.json().get("query") or {}).get("pages") or {})
                for page in pages.values():
                    ii = (page.get("imageinfo") or [{}])[0]
                    if not ii:
                        continue
                    ptitle = page.get("title", "")
                    title = _clean_dore_title(ptitle)
                    if not title:
                        continue
                    ext = ii.get("extmetadata", {}) or {}
                    desc_raw = (ext.get("ImageDescription", {}) or {}).get("value", "")
                    desc = re.sub(r"<[^>]+>", " ", desc_raw).strip()[:280] or captions.get(ptitle)
                    items.append({
                        "title": title,
                        "image_url": ii.get("thumburl") or ii.get("url"),
                        "hires_url": ii.get("url"),
                        "wiki_url": (
                            f"https://commons.wikimedia.org/wiki/{ptitle.replace(' ', '_')}"
                        ),
                        "description": desc,
                        "tokens": list(_tokens(title) | _tokens(desc or "")),
                    })
    except Exception as e:
        logger.warning(f"Doré catalog load failed: {e}")
        return []

    await db.kv_cache.update_one(
        {"_id": DORE_CATALOG_KEY},
        {"$set": {"_id": DORE_CATALOG_KEY, "items": items,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.info(f"Doré catalog cached: {len(items)} engravings")
    return items


def _match_dore(theme: str, catalog: List[dict]) -> Optional[dict]:
    if not theme or not catalog:
        return None
    q = _tokens(theme)
    if not q:
        return None
    best, best_score = None, 0
    for item in catalog:
        item_tokens = set(item.get("tokens") or _tokens(item.get("title", "")))
        overlap = len(q & item_tokens)
        if overlap > best_score:
            best_score, best = overlap, item
    return best if best_score > 0 else None


async def _pick_dore_illustration(theme: str, references: List[ScriptureRef]) -> Optional[DoreIllustration]:
    catalog = await _load_dore_catalog()
    if not catalog:
        return None
    # Try the LLM's theme first
    hit = _match_dore(theme, catalog)
    # Fall back to using scripture book names + chapter as extra keywords
    if not hit and references:
        combined = " ".join(f"{r.book} {r.chapter}" for r in references[:3])
        hit = _match_dore(combined, catalog)
    if not hit:
        return None
    return DoreIllustration(
        title=hit["title"],
        image_url=hit["image_url"],
        hires_url=hit["hires_url"] or hit["image_url"],
        wiki_url=hit.get("wiki_url"),
        description=hit.get("description"),
    )


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

    # Validate locations shape (optional field — safe if missing)
    locations = []
    for loc in data.get("locations", []) or []:
        try:
            ancient = str(loc.get("ancient_name", "")).strip()
            if not ancient:
                continue
            lat = loc.get("lat")
            lng = loc.get("lng")
            locations.append(ScriptureLocation(
                ancient_name=ancient,
                significance=str(loc.get("significance", "")).strip(),
                modern_name=str(loc.get("modern_name", "")).strip(),
                lat=float(lat) if isinstance(lat, (int, float)) else None,
                lng=float(lng) if isinstance(lng, (int, float)) else None,
                map_query=str(loc.get("map_query") or ancient).strip(),
            ))
        except Exception as e:
            logger.warning(f"Skipping malformed location {loc}: {e}")

    return {"answer": data["answer"].strip(), "references": refs, "locations": locations,
            "illustration_theme": str(data.get("illustration_theme") or "").strip()}


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
        "payments_configured": bool(REVENUECAT_WEBHOOK_AUTH),
        "billing_provider": "revenuecat_amazon",
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

    # Enrich locations with Nominatim (cached in Mongo — fast after first lookup)
    if result.get("locations"):
        try:
            result["locations"] = await _enrich_locations(result["locations"])
        except Exception as e:
            logger.warning(f"Location enrichment failed (non-fatal): {e}")

    # Pick a matching Gustave Doré 1866 engraving for the counsel
    illustration = None
    try:
        illustration = await _pick_dore_illustration(
            result.get("illustration_theme", ""),
            result.get("references", []),
        )
    except Exception as e:
        logger.warning(f"Doré illustration lookup failed (non-fatal): {e}")

    conv = Conversation(
        session_id=session_id,
        question=req.question.strip(),
        answer=result["answer"],
        references=result["references"],
        locations=result.get("locations", []),
        illustration=illustration,
    )
    doc = conv.model_dump()
    await db.conversations.insert_one(doc)

    return AskResponse(
        id=conv.id,
        session_id=session_id,
        question=conv.question,
        answer=conv.answer,
        references=conv.references,
        locations=conv.locations,
        illustration=conv.illustration,
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


# ============================================================
# REVENUECAT WEBHOOK — Amazon Appstore subscription events
# Client (@revenuecat/purchases-capacitor) is authoritative for entitlement
# state; this endpoint is a lightweight ledger for cross-device analytics
# and future server-side content gating. It never grants access on its own.
# ============================================================
@api_router.post("/webhooks/revenuecat")
async def revenuecat_webhook(request: Request):
    if not REVENUECAT_WEBHOOK_AUTH:
        raise HTTPException(status_code=503, detail="Webhook not configured")
    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {REVENUECAT_WEBHOOK_AUTH}":
        raise HTTPException(status_code=401, detail="unauthorized")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json")

    event = payload.get("event") or {}
    event_id = event.get("id")
    app_user_id = event.get("app_user_id")
    if not event_id or not app_user_id:
        return {"status": "ignored"}

    now = datetime.now(timezone.utc)
    await db.subscription_events.update_one(
        {"event_id": event_id},
        {"$setOnInsert": {
            "event_id": event_id,
            "type": event.get("type"),
            "store": event.get("store"),
            "app_user_id": app_user_id,
            "product_id": event.get("product_id"),
            "entitlement_ids": event.get("entitlement_ids") or [],
            "expiration_at_ms": event.get("expiration_at_ms"),
            "received_at": now.isoformat(),
        }},
        upsert=True,
    )

    tracked_types = {
        "INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "CANCELLATION",
        "UNCANCELLATION", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_PAUSED",
        "EXPIRATION", "BILLING_ISSUE", "TRANSFER",
    }
    if event.get("type") in tracked_types:
        await db.users.update_one(
            {"app_user_id": app_user_id},
            {"$set": {
                "last_event_type": event.get("type"),
                "last_event_store": event.get("store"),
                "last_product_id": event.get("product_id"),
                "updated_at": now.isoformat(),
            }},
            upsert=True,
        )
    return {"status": "ok"}


# ============================================================
# VERSE SHARE WIDGETS — public shareable landing pages with rich OG previews
# so a shared URL becomes a "widget" on Instagram/X/WhatsApp/iMessage.
# ============================================================
def _new_share_id() -> str:
    return secrets.token_urlsafe(9)  # ~12 chars, url-safe


def _decode_data_url(data_url: str) -> Optional[bytes]:
    if not data_url or not data_url.startswith("data:image/"):
        return None
    try:
        _, b64 = data_url.split(",", 1)
        return base64.b64decode(b64)
    except Exception:
        return None


def _public_base_url(request: Request, explicit: Optional[str] = None) -> str:
    """Return the browser-facing base URL for building share links.
    Order: explicit override → Origin header → Referer → request.base_url."""
    if explicit:
        return explicit.rstrip("/")
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("referer") or ""
    if referer:
        from urllib.parse import urlparse
        p = urlparse(referer)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}"
    return str(request.base_url).rstrip("/")


@api_router.post("/shares")
async def create_share(req: CreateShareRequest, request: Request):
    book = req.book.strip()
    text = req.text.strip()
    if not book or not text:
        raise HTTPException(status_code=400, detail="Book and text are required")

    share_id = _new_share_id()
    doc = {
        "share_id": share_id,
        "book": book,
        "chapter": int(req.chapter),
        "verse": str(req.verse).strip(),
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "views": 0,
    }
    img_bytes = _decode_data_url(req.image_data_url) if req.image_data_url else None
    if img_bytes and len(img_bytes) < 3_000_000:  # cap ~3 MB
        doc["image_bytes"] = img_bytes

    base = _public_base_url(request, req.origin_url)
    doc["public_base_url"] = base
    await db.shares.insert_one(doc)

    return {
        "share_id": share_id,
        "share_url": f"{base}/api/v/{share_id}",
        "image_url": f"{base}/api/shares/{share_id}/image.png" if img_bytes else None,
    }


@api_router.get("/shares/{share_id}")
async def get_share(share_id: str):
    doc = await db.shares.find_one({"share_id": share_id}, {"_id": 0, "image_bytes": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Share not found")
    return doc


@api_router.get("/shares/{share_id}/image.png")
async def get_share_image(share_id: str):
    doc = await db.shares.find_one({"share_id": share_id}, {"image_bytes": 1})
    if not doc or not doc.get("image_bytes"):
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(
        content=doc["image_bytes"],
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


_SHARE_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{description}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="Wisdom &amp; Word">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{page_url}">
{og_image_tags}

<meta name="twitter:card" content="{twitter_card}">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
{twitter_image_tag}

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">

<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; min-height: 100vh; padding: 48px 24px;
    background: radial-gradient(ellipse at top, #0f172a 0%, #030712 60%);
    color: #f8fafc;
    font-family: 'Manrope', system-ui, -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }}
  .card {{
    max-width: 640px; width: 100%;
    background: linear-gradient(180deg, rgba(15,23,42,0.85), rgba(15,23,42,0.95));
    border: 1px solid rgba(212,175,55,0.35); border-radius: 24px;
    padding: 56px 40px; text-align: left;
    box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  }}
  .eyebrow {{ font-size: 11px; letter-spacing: 0.4em; text-transform: uppercase; color: #d4af37; margin-bottom: 20px; }}
  .verse {{
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-style: italic; font-size: 32px; line-height: 1.4;
    color: #fde68a; margin: 0 0 24px 0;
  }}
  .ref {{ font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: #d4af37; margin-bottom: 6px; }}
  .kjv {{ font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #94a3b8; }}
  .divider {{ height: 1px; background: rgba(255,255,255,0.08); margin: 32px 0; }}
  .cta-title {{ font-family: 'Cormorant Garamond', serif; font-size: 22px; color: #f8fafc; margin: 0 0 10px 0; }}
  .cta-body {{ color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; }}
  .cta {{
    display: inline-block;
    background: #d4af37; color: #030712; padding: 14px 26px;
    border-radius: 999px; text-decoration: none;
    font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; font-weight: 600;
  }}
  .cta:hover {{ filter: brightness(1.1); }}
  .foot {{ margin-top: 28px; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #64748b; }}
  @media (max-width: 480px) {{
    .card {{ padding: 40px 28px; border-radius: 20px; }}
    .verse {{ font-size: 26px; }}
  }}
</style>
</head>
<body>
  <main class="card">
    <div class="eyebrow">Scripture · King James Version</div>
    <p class="verse">&ldquo;{verse_html}&rdquo;</p>
    <div class="ref">{book} {chapter}:{verse_num}</div>
    <div class="kjv">King James Version</div>
    <div class="divider"></div>
    <h1 class="cta-title">Ask the Elder for counsel of your own.</h1>
    <p class="cta-body">
      Wisdom &amp; Word answers what weighs upon your heart with the Bible alone —
      spoken in a warm statesman voice, with every verse cited.
    </p>
    <a class="cta" href="{home_url}" data-testid="share-page-cta">Continue to Wisdom &amp; Word →</a>
    <div class="foot">Shared with Wisdom &amp; Word</div>
  </main>
</body>
</html>
"""


@api_router.get("/v/{share_id}", response_class=HTMLResponse)
async def share_landing(share_id: str, request: Request):
    doc = await db.shares.find_one({"share_id": share_id}, {"_id": 0})
    if not doc:
        # Minimal 404 landing that still nudges to the home page
        base = str(request.base_url).rstrip("/")
        return HTMLResponse(
            content=(
                "<!doctype html><meta charset=utf-8>"
                "<title>Verse not found — Wisdom & Word</title>"
                "<body style='background:#030712;color:#f8fafc;font-family:sans-serif;text-align:center;padding:80px 20px'>"
                "<h1>This verse could not be found.</h1>"
                f"<p><a style='color:#d4af37' href='{base}/'>Continue to Wisdom &amp; Word →</a></p></body>"
            ),
            status_code=404,
        )

    # Fire-and-forget view counter
    try:
        await db.shares.update_one({"share_id": share_id}, {"$inc": {"views": 1}})
    except Exception:
        pass

    base = doc.get("public_base_url") or _public_base_url(request)
    home_url = base + "/"
    page_url = f"{base}/api/v/{share_id}"

    book = doc.get("book", "")
    chapter = int(doc.get("chapter", 0))
    verse_num = doc.get("verse", "")
    text = doc.get("text", "")

    title = f"{book} {chapter}:{verse_num} — Wisdom & Word"
    # Keep description short so Twitter shows it cleanly
    trimmed = text if len(text) <= 190 else text[:187].rstrip() + "..."
    description = f'"{trimmed}" — {book} {chapter}:{verse_num} (KJV)'

    has_image = bool(doc.get("image_bytes"))
    if has_image:
        img_url = f"{base}/api/shares/{share_id}/image.png"
        og_image_tags = (
            f'<meta property="og:image" content="{img_url}">\n'
            f'<meta property="og:image:width" content="1080">\n'
            f'<meta property="og:image:height" content="1350">\n'
            f'<meta property="og:image:alt" content="{html_lib.escape(description, quote=True)}">'
        )
        twitter_image_tag = f'<meta name="twitter:image" content="{img_url}">'
        twitter_card = "summary_large_image"
    else:
        og_image_tags = ""
        twitter_image_tag = ""
        twitter_card = "summary"

    return HTMLResponse(
        content=_SHARE_HTML.format(
            title=html_lib.escape(title, quote=True),
            description=html_lib.escape(description, quote=True),
            page_url=html_lib.escape(page_url, quote=True),
            home_url=html_lib.escape(home_url, quote=True),
            book=html_lib.escape(book),
            chapter=chapter,
            verse_num=html_lib.escape(str(verse_num)),
            verse_html=html_lib.escape(text),
            og_image_tags=og_image_tags,
            twitter_image_tag=twitter_image_tag,
            twitter_card=twitter_card,
        ),
        headers={"Cache-Control": "public, max-age=300"},
    )


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
