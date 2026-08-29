"""Backend tests for Wisdom & Word Amazon Appstore edition.

Covers /api/ask validation, /api/health billing_provider, /api/suggestions,
and /api/history/{session_id}.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://scripture-counsel-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /api/health ----------
class TestHealth:
    def test_health_amazon_billing(self, client):
        r = client.get(f"{API}/health", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("billing_provider") == "revenuecat_amazon", data
        assert "payments_configured" in data
        # Stripe fully removed - ensure no stripe key leakage
        body_lower = r.text.lower()
        assert "stripe" not in body_lower, "Stripe reference should be removed"


# ---------- /api/suggestions ----------
class TestSuggestions:
    def test_suggestions_200(self, client):
        r = client.get(f"{API}/suggestions", timeout=30)
        assert r.status_code == 200
        data = r.json()
        prompts = data.get("prompts")
        assert isinstance(prompts, list) and len(prompts) > 0


# ---------- /api/history/{session_id} ----------
class TestHistory:
    def test_history_random_uuid(self, client):
        sid = str(uuid.uuid4())
        r = client.get(f"{API}/history/{sid}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("session_id") == sid
        assert isinstance(data.get("items"), list)


# ---------- /api/ask validation ----------
class TestAskValidation:
    def test_empty_string(self, client):
        r = client.post(f"{API}/ask", json={"question": "", "session_id": str(uuid.uuid4())}, timeout=30)
        assert r.status_code == 400
        assert "share what weighs on your heart" in r.json().get("detail", "").lower()

    def test_whitespace_only(self, client):
        for q in ["   ", "\t\t", "\n\n", "  \t\n  "]:
            r = client.post(f"{API}/ask", json={"question": q, "session_id": str(uuid.uuid4())}, timeout=30)
            assert r.status_code == 400, f"expected 400 for {q!r}, got {r.status_code}"
            assert "share what weighs on your heart" in r.json().get("detail", "").lower()

    def test_oversize_question(self, client):
        q = "A" * 2001
        r = client.post(f"{API}/ask", json={"question": q, "session_id": str(uuid.uuid4())}, timeout=30)
        assert r.status_code == 400
        assert "too long" in r.json().get("detail", "").lower()


# ---------- /api/ask happy path ----------
class TestAskSuccess:
    def test_valid_question(self, client):
        sid = str(uuid.uuid4())
        r = client.post(
            f"{API}/ask",
            json={"question": "What does the Bible say about hope?", "session_id": sid},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "session_id", "question", "answer", "references", "created_at"):
            assert k in data, f"missing key: {k}"
        assert "illustration" in data  # may be null
        assert data["session_id"] == sid
        assert isinstance(data["answer"], str) and len(data["answer"]) > 0
        assert isinstance(data["references"], list)

        # Verify persistence via GET /history/{sid}
        h = client.get(f"{API}/history/{sid}", timeout=30)
        assert h.status_code == 200
        items = h.json().get("items", [])
        assert any(it.get("id") == data["id"] for it in items), "New conversation not persisted"

    def test_special_chars(self, client):
        sid = str(uuid.uuid4())
        q = "Is “hope” — really enough? What about <script>alert(1)</script> & unicode ✝ ✡?"
        r = client.post(f"{API}/ask", json={"question": q, "session_id": sid}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        # The stored question should reflect input verbatim (server just strips).
        assert "<script>" in data["question"] or "script" in data["question"]
        # Answer must be a string (JSON escaping handles HTML safely).
        assert isinstance(data["answer"], str)
