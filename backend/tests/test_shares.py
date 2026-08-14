"""Backend tests for Verse Share Widgets feature."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://scripture-counsel-2.preview.emergentagent.com').rstrip('/')
PUBLIC_ORIGIN = "https://scripture-counsel-2.preview.emergentagent.com"

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


@pytest.fixture(scope="module")
def created_share():
    payload = {
        "book": "Psalm",
        "chapter": 23,
        "verse": "1",
        "text": "The LORD is my shepherd; I shall not want.",
        "image_data_url": TINY_PNG,
        "origin_url": PUBLIC_ORIGIN,
    }
    r = requests.post(f"{BASE_URL}/api/shares", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_share_with_image(created_share):
    data = created_share
    assert "share_id" in data
    sid = data["share_id"]
    assert 8 <= len(sid) <= 20
    assert re.match(r"^[A-Za-z0-9_\-]+$", sid)
    assert data["share_url"].startswith(f"{PUBLIC_ORIGIN}/api/v/")
    assert data["image_url"].startswith(f"{PUBLIC_ORIGIN}/api/shares/")
    assert data["image_url"].endswith("/image.png")


def test_create_share_without_image():
    payload = {
        "book": "John",
        "chapter": 3,
        "verse": "16",
        "text": "For God so loved the world...",
        "origin_url": PUBLIC_ORIGIN,
    }
    r = requests.post(f"{BASE_URL}/api/shares", json=payload, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["share_url"].startswith(f"{PUBLIC_ORIGIN}/api/v/")
    assert d["image_url"] is None


def test_create_share_validation_empty_book():
    payload = {"book": "", "chapter": 1, "verse": "1", "text": "abc"}
    r = requests.post(f"{BASE_URL}/api/shares", json=payload, timeout=10)
    assert r.status_code == 400


def test_create_share_validation_empty_text():
    payload = {"book": "Psalm", "chapter": 1, "verse": "1", "text": ""}
    r = requests.post(f"{BASE_URL}/api/shares", json=payload, timeout=10)
    assert r.status_code == 400


def test_get_share_json(created_share):
    sid = created_share["share_id"]
    r = requests.get(f"{BASE_URL}/api/shares/{sid}", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["book"] == "Psalm"
    assert d["chapter"] == 23
    assert d["verse"] == "1"
    assert "shepherd" in d["text"]
    assert isinstance(d["views"], int)
    assert "image_bytes" not in d


def test_get_share_json_404():
    r = requests.get(f"{BASE_URL}/api/shares/nonexistent-xyz-999", timeout=10)
    assert r.status_code == 404


def test_share_image(created_share):
    sid = created_share["share_id"]
    r = requests.get(f"{BASE_URL}/api/shares/{sid}/image.png", timeout=10)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert len(r.content) > 0


def test_share_image_404_no_image():
    # Create share without image
    payload = {"book": "Psalm", "chapter": 1, "verse": "1", "text": "Blessed is the man.", "origin_url": PUBLIC_ORIGIN}
    r = requests.post(f"{BASE_URL}/api/shares", json=payload, timeout=10)
    sid = r.json()["share_id"]
    r2 = requests.get(f"{BASE_URL}/api/shares/{sid}/image.png", timeout=10)
    assert r2.status_code == 404


def test_landing_page_og_tags(created_share):
    sid = created_share["share_id"]

    # Get views before
    before = requests.get(f"{BASE_URL}/api/shares/{sid}", timeout=10).json().get("views", 0)

    r = requests.get(f"{BASE_URL}/api/v/{sid}", timeout=10)
    assert r.status_code == 200
    html = r.text

    assert '<meta property="og:title" content="Psalm 23:1 — Wisdom &amp; Word">' in html
    # description contains verse text quoted + (KJV)
    assert 'og:description' in html
    assert '(KJV)' in html
    assert 'shepherd' in html
    # og:image points to public /api/shares/{id}/image.png
    assert f'<meta property="og:image" content="{PUBLIC_ORIGIN}/api/shares/{sid}/image.png">' in html
    # twitter card summary_large_image when image
    assert '<meta name="twitter:card" content="summary_large_image">' in html
    # og:url on public host
    assert f'<meta property="og:url" content="{PUBLIC_ORIGIN}/api/v/{sid}">' in html
    # CTA
    assert 'data-testid="share-page-cta"' in html
    assert 'href="' + PUBLIC_ORIGIN + '/"' in html

    # Views increment
    after = requests.get(f"{BASE_URL}/api/shares/{sid}", timeout=10).json().get("views", 0)
    assert after > before


def test_landing_page_no_image_twitter_summary():
    payload = {"book": "Psalm", "chapter": 100, "verse": "1", "text": "Make a joyful noise unto the LORD.", "origin_url": PUBLIC_ORIGIN}
    r = requests.post(f"{BASE_URL}/api/shares", json=payload, timeout=10)
    sid = r.json()["share_id"]
    r2 = requests.get(f"{BASE_URL}/api/v/{sid}", timeout=10)
    assert r2.status_code == 200
    html = r2.text
    assert '<meta name="twitter:card" content="summary">' in html
    assert 'og:image' not in html


def test_landing_page_404():
    r = requests.get(f"{BASE_URL}/api/v/nonexistent-id-abc-999", timeout=10)
    assert r.status_code == 404
    assert "Wisdom" in r.text
