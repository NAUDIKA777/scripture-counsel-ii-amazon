"""Idempotent setup of the Stripe product catalog for Wisdom & Word.

Creates a single subscription product: `pro_monthly` at $4.99 USD/month.
Safe to re-run — it dedupes on metadata.emergent_product_id and reuses the
existing product/price when possible.
"""
import os
from pathlib import Path
import stripe
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

CATALOG = [
    {
        "emergent_product_id": "wisdom_pro",
        "name": "Wisdom & Word — Pro",
        "description": "Unlimited counsel from Scripture, statesman voice, shareable verses.",
        "tax_code": "txcd_10103001",  # SaaS
        "prices": [
            {
                "lookup_key": "pro_monthly",
                "amount": 499,  # cents — $4.99
                "currency": "usd",
                "interval": "month",
            },
        ],
    },
]


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            print(f"Reusing existing product: {p.id} ({entry['name']})")
            return p
    product = stripe.Product.create(
        name=entry["name"],
        description=entry.get("description"),
        tax_code=entry.get("tax_code"),
        metadata={
            "managed_by": "emergent",
            "emergent_product_id": entry["emergent_product_id"],
        },
    )
    print(f"Created new product: {product.id} ({entry['name']})")
    return product


def ensure_price(product_id, price_spec):
    existing = stripe.Price.list(lookup_keys=[price_spec["lookup_key"]], active=True, limit=1).data
    if existing:
        p = existing[0]
        if p.unit_amount == price_spec["amount"] and p.currency == price_spec["currency"]:
            print(f"Reusing existing price {p.id} for {price_spec['lookup_key']}")
            return p
        # Mismatched — deactivate and recreate
        print(f"Deactivating stale price {p.id} for {price_spec['lookup_key']} (amount/currency changed)")
        stripe.Price.modify(p.id, active=False)

    kwargs = dict(
        product=product_id,
        unit_amount=price_spec["amount"],
        currency=price_spec["currency"],
        lookup_key=price_spec["lookup_key"],
        transfer_lookup_key=True,
    )
    if price_spec.get("interval"):
        kwargs["recurring"] = {"interval": price_spec["interval"]}
    price = stripe.Price.create(**kwargs)
    print(f"Created price {price.id} for {price_spec['lookup_key']}")
    return price


def main():
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for price_spec in entry["prices"]:
            ensure_price(product.id, price_spec)
    print("\nCatalog setup complete.")


if __name__ == "__main__":
    main()
