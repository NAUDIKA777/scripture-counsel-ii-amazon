"""Backend tests for Stripe Customer Portal endpoint (iteration 10)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://scripture-counsel-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
PAID_USER = "anon-2392ee4d-9e7c-44f6-8715-7599a3a5053e"
RETURN_URL = "https://scripture-counsel-2.preview.emergentagent.com"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_portal_unknown_user_returns_404(session):
    r = session.post(
        f"{API}/subscription/portal",
        json={"app_user_id": "anon-nobody-portal", "return_url": RETURN_URL},
        timeout=30,
    )
    assert r.status_code == 404, r.text
    data = r.json()
    assert "No active subscription" in data.get("detail", ""), data


def test_portal_paid_user_returns_billing_url(session):
    r = session.post(
        f"{API}/subscription/portal",
        json={"app_user_id": PAID_USER, "return_url": RETURN_URL},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    url = data.get("portal_url", "")
    assert url.startswith("https://billing.stripe.com/"), data
