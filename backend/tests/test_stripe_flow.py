"""Backend tests for Stripe-based Wisdom & Word subscription flow."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://scripture-counsel-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
def test_health_payments_configured(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("payments_configured") is True, f"payments_configured missing/false: {data}"


# --- Checkout creation ---
@pytest.fixture(scope="module")
def checkout(session):
    payload = {
        "app_user_id": "anon-test-A",
        "origin_url": "https://scripture-counsel-2.preview.emergentagent.com",
        "email": "testa@example.com",
    }
    r = session.post(f"{API}/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text}"
    return r.json()


def test_checkout_url_and_session_id(checkout):
    assert checkout.get("checkout_url", "").startswith("https://checkout.stripe.com/"), checkout
    assert checkout.get("session_id", "").startswith("cs_test_"), checkout


# --- Payment status before payment ---
def test_payment_status_before_payment(session, checkout):
    sid = checkout["session_id"]
    r = session.get(f"{API}/payments/status/{sid}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    status = (data.get("payment_status") or data.get("status") or "").lower()
    assert status in {"pending", "unpaid", "initiated", "open", "no_payment_required"}, data


# --- Subscription status unknown user ---
def test_subscription_status_unknown(session):
    uid = "anon-nobody-XYZ"
    r = session.get(f"{API}/subscription/status/{uid}", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pro_active") is False, data
    assert data.get("app_user_id") == uid, data


# --- Restore unknown email ---
def test_restore_unknown_email(session):
    r = session.post(f"{API}/subscription/restore", json={"email": "nobody-xyz@example.com"}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pro_active") is False, data
    assert data.get("found") is False, data


# --- Restore invalid email validation ---
def test_restore_invalid_email(session):
    r = session.post(f"{API}/subscription/restore", json={"email": "not-an-email"}, timeout=15)
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


# --- Regression: ask flow & verse-of-day ---
def test_verse_of_day(session):
    r = session.get(f"{API}/verse-of-day", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "reference" in d or "text" in d, d
