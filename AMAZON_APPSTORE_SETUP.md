# Wisdom & Word — Amazon Appstore Edition · Setup Guide

This clone of Wisdom & Word ships to the **Amazon Appstore only**. All external
billing has been removed. Purchases are handled by **Amazon In-App Purchasing**
via the **RevenueCat Capacitor SDK**.

You will do the setup **once** across three consoles (Amazon Developer,
RevenueCat, and your local machine), paste two secrets, and run three commands.

---

## Part A — Amazon Developer Console (create the app & subscription SKU)

1. **Create the developer account** at <https://developer.amazon.com/>. Complete
   the profile, legal entity, tax, and payout information.
2. **Add the app**: *My Apps → Add a New App → Android*. Enter:
   - **App name**: `Wisdom & Word`
   - **Package name (must match exactly)**: `com.wisdomandword.app`
3. Create an **Upcoming Version** for the app (you will upload the signed APK later).
4. **Create the subscription IAP**:
   - Open *In-App Items → Add Single IAP → Subscription*.
   - Parent SKU: `com.wisdomandword.premium`
   - Title: `Wisdom & Word Premium`
   - Add a **monthly term** (child SKU): `com.wisdomandword.premium.monthly`
   - Type: **Paid subscription** · US price: **$4.99** · no free trial
   - Fill localized title/description/icon → **Submit IAP**
5. **Grab the Amazon public key (PEM)**:
   - App page → *Upload Your App File → Additional information → View public key*
   - Download `AppstoreAuthenticationKey.pem`
   - **Save it** — you will drop it into `android/app/src/main/assets/` after
     running `npx cap add android` (see Part D).
6. **Grab the Amazon Shared Secret**: *Settings → Identity → Shared Secret*.
   Copy this — RevenueCat needs it.

> SKUs are case-sensitive and globally unique per Amazon developer account.
> Use the term SKU exactly (`com.wisdomandword.premium.monthly`), not the parent.

---

## Part B — RevenueCat (create project, connect Amazon, get SDK key)

1. Sign up at <https://app.revenuecat.com/signup>.
2. Create a project called **Wisdom & Word**.
3. *Project Settings → Apps → New app → Amazon Appstore*:
   - App name: `Wisdom & Word`
   - Package name: `com.wisdomandword.app`
   - **Amazon Shared Secret** (from Part A step 6): paste it
4. *Project Settings → API keys → App-specific keys*: copy the Amazon **public
   SDK key** that starts with `amzn_...`.
5. *Product catalog → Products → Amazon Appstore → Add product*:
   - Store product identifier: `com.wisdomandword.premium.monthly`
6. Create an **entitlement** called `premium` and attach the product above.
7. Create (or edit) the `default` **offering** and add a **monthly package**
   containing the Amazon product.
8. *(Optional but recommended)* *Integrations → Webhooks → Add webhook*:
   - URL: `https://<your-backend-domain>/api/webhooks/revenuecat`
   - Authorization header: `Bearer <RANDOM_LONG_STRING>` — you will paste the
     same string into `backend/.env` as `REVENUECAT_WEBHOOK_AUTH`.

---

## Part C — Paste secrets into the codebase

### `/app/frontend/.env`

```env
REACT_APP_REVENUECAT_AMAZON_PUBLIC_KEY=amzn_your_public_sdk_key_here
```

### `/app/backend/.env` *(only if you enabled the webhook in step B.8)*

```env
REVENUECAT_WEBHOOK_AUTH=your_random_long_string_matching_the_bearer_token
```

After editing either file:

```bash
sudo supervisorctl restart backend frontend
```

---

## Part D — Build the Android APK (local machine, not the Emergent preview)

The Capacitor plugin, RevenueCat native SDK, Amazon Appstore SDK, and the
Amazon IAP SDK need the **Android SDK + Java 17** installed. Do these on
**your local machine**:

```bash
# 1. Clone the codebase or pull the latest, then:
cd frontend
yarn install
yarn build              # produces build/ that Capacitor bundles

# 2. Add the Android platform (only once)
npx cap add android

# 3. Drop the Amazon PEM key into the Android project
mkdir -p android/app/src/main/assets
cp /path/to/AppstoreAuthenticationKey.pem android/app/src/main/assets/

# 4. Add the Amazon RevenueCat store dependency to android/app/build.gradle
#    inside the dependencies { } block (match the version pulled by the plugin):
#
#      implementation "com.revenuecat.purchases:purchases-store-amazon:<version>"
#
#    Then run:
npx cap sync android

# 5. Merge the manifest patch in /app/frontend/android-manifest.patch.xml
#    into android/app/src/main/AndroidManifest.xml (queries, receiver, launchMode).

# 6. Build the release APK
cd android
./gradlew clean assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

---

## Part E — Sandbox testing with Amazon App Tester

Before submitting to Amazon:

1. Install the **Amazon App Tester** from the Amazon Appstore on a Fire tablet
   or on an Android device that has the Amazon Appstore installed.
2. Create the following `amazon.sdktester.json` on the device (in
   `/sdcard/Android/data/com.amazon.sdktestclient/files/` or the location the
   App Tester version you installed expects):

    ```json
    {
      "com.wisdomandword.premium": {
        "itemType": "SUBSCRIPTION",
        "title": "Wisdom & Word Premium",
        "description": "Monthly premium access",
        "subscriptionParent": "com.wisdomandword.premium"
      },
      "com.wisdomandword.premium.monthly": {
        "itemType": "SUBSCRIPTION",
        "title": "Wisdom & Word Premium Monthly",
        "description": "Auto-renewing monthly subscription",
        "subscriptionParent": "com.wisdomandword.premium",
        "term": "Monthly",
        "price": 4.99
      }
    }
    ```

3. Install the debug APK, open Wisdom & Word, exhaust the 3 free counsels,
   tap **Subscribe via Amazon**, complete the mocked purchase, verify the
   paywall closes and the *Premium* pill appears in the nav.
4. Kill and relaunch — Premium should still be active (RevenueCat restores on
   `getCustomerInfo`).
5. Tap **Restore Purchases** — should confirm the restore.

> ⚠️ **RevenueCat caveat**: purchases made through App Tester are **not**
> validated by RevenueCat. Use Amazon's **Live App Testing** track for
> end-to-end RevenueCat receipt validation before releasing to production.

---

## Part F — Submit to Amazon Appstore

1. Upload the signed release APK to the Upcoming Version created in Part A.
2. Attach the submitted IAP subscription to this build.
3. Fill screenshots, descriptions, privacy URL
   (`https://wisdominword.com/privacy.html`), and content ratings.
4. Submit for review.

---

## Amazon Appstore paywall-compliance checklist (already implemented)

- ✅ Primary CTA reads **"Subscribe via Amazon · $4.99 / month"** and calls
  `Purchases.purchasePackage(...)` — no web redirect.
- ✅ Secondary **"Restore Purchases"** button calls `Purchases.restorePurchases()`.
- ✅ Full disclosure below buttons: auto-renewal, Amazon account charge, 24h
  cancel window, and the exact cancel path
  (*Your Amazon → Memberships & Subscriptions*).
- ✅ No Stripe, PayPal, "Subscribe on the web", "manage on our site",
  external URLs, or alternative payment references anywhere in the build.
- ✅ Entitlement unlocks only after `CustomerInfo.entitlements.active.premium`
  reports true — never on button click alone.
- ✅ Privacy policy updated to declare **Amazon In-App Purchasing** and
  **RevenueCat** as the payment/subscription processors.

---

## Files reference

- `frontend/src/lib/revenuecat.js` — RevenueCat wrapper (configure, subscribe,
  restore, entitlement check). All calls no-op safely in a plain web browser.
- `frontend/src/hooks/useAccess.js` — combines local free-counter + RevenueCat
  entitlement.
- `frontend/src/components/Paywall.js` — Amazon-compliant paywall UI.
- `frontend/capacitor.config.ts` — Capacitor Android config
  (`appId: com.wisdomandword.app`).
- `frontend/android-manifest.patch.xml` — AndroidManifest snippets to merge
  after `npx cap add android`.
- `backend/server.py → /api/webhooks/revenuecat` — optional server-side
  ledger of Amazon subscription events (gated by `REVENUECAT_WEBHOOK_AUTH`).
