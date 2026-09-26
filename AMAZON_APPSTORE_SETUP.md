# Wisdom & Word — Amazon Appstore Edition · Final Local Build Steps

Everything that can be automated inside the Emergent workspace has been done.
The `android/` Capacitor project is already scaffolded with:

- `appId = com.wisdomandword.app`
- RevenueCat Capacitor plugin registered
- `AndroidManifest.xml` merged with the Amazon `<queries>`, IAP `<receiver>`,
  and `MainActivity launchMode="singleTop"`
- `android/app/build.gradle` includes
  `com.revenuecat.purchases:purchases-store-amazon:10.15.1`
- The production React bundle (with your `amzn_oBFPlvVmUDQAdMgWSmvQOtLECVV`
  key baked in) is copied to `android/app/src/main/assets/public/`

Pull this repo to your local machine and run these commands. Java 17 and the
Android SDK are required locally — Emergent's container cannot compile APKs.

---

## 1. Drop the Amazon PEM key

From the Amazon Developer Console → your app's Upcoming Version →
*Additional information → View public key* → **Download**, then:

```bash
mv ~/Downloads/AppstoreAuthenticationKey.pem \
   frontend/android/app/src/main/assets/AppstoreAuthenticationKey.pem
rm frontend/android/app/src/main/assets/PLACE_AMAZON_PEM_HERE.txt
```

The Amazon Appstore SDK looks for that **exact filename** in that folder.

---

## 2. Build the release APK

```bash
cd frontend

# (Only if you edit React code after cloning; the bundle is already synced.)
yarn install
yarn build
npx cap sync android

cd android
./gradlew clean assembleRelease
```

`android/app/build.gradle` now contains a release signing config that reads
credentials from Gradle properties (or the same environment variables), so put
this in `~/.gradle/gradle.properties` before building:

```properties
WW_KEYSTORE_FILE=/absolute/path/to/wisdomandword-release.keystore
WW_KEYSTORE_PASSWORD=…
WW_KEY_ALIAS=wisdomandword
WW_KEY_PASSWORD=…
```

With those set, `assembleRelease` emits a signed, zip-aligned APK at:

```
frontend/android/app/build/outputs/apk/release/app-release.apk
```

Without them the build still succeeds and produces
`app-release-unsigned.apk`, which you can sign manually
(`jarsigner` + `zipalign`).

---

## 3. Sandbox test with Amazon App Tester

Same procedure as before:

1. Install **Amazon App Tester** on a Fire tablet or an Android device that
   has the Amazon Appstore installed.
2. Push this JSON to App Tester's expected path (see App Tester's on-screen
   instructions — usually the app's own external files dir):

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

3. Install the debug APK (`./gradlew assembleDebug`) on the device.
4. Use the 1 free counsel → tap **Subscribe via Amazon** → confirm the mocked
   purchase → verify the *Premium* pill appears in the nav.
5. Kill and relaunch → premium should still be active.
6. Tap **Restore Purchases** → should restore.

> ⚠️ App Tester purchases are **not** validated by RevenueCat. Move to
> **Live App Testing** on Amazon before submitting production.

---

## 4. Submit to Amazon Appstore

1. Upload the signed release APK to your Upcoming Version.
2. Attach the submitted IAP (`com.wisdomandword.premium.monthly`) to this build.
3. Fill screenshots, description, content ratings, privacy URL
   (`https://wisdominww.com/privacy.html`).
4. **Submit for review.**

---

## Current environment

- `frontend/.env.production` is committed and is what `yarn build` uses:
  `REACT_APP_BACKEND_URL=https://scripture-counsel-2.emergent.host`,
  `REACT_APP_REVENUECAT_AMAZON_PUBLIC_KEY=amzn_oBFPlvVmUDQAdMgWSmvQOtLECVV`,
  `REACT_APP_FREE_COUNSEL_LIMIT=1`. If the backend host ever changes, update
  that file **and** `PRODUCTION_BACKEND_URL` in `frontend/src/lib/api.js`
  (the hard fallback used when no env value is present).
- `backend/.env → REVENUECAT_WEBHOOK_AUTH` is empty. Fill it later with any
  long random string if you want the cross-device webhook ledger; then paste
  the same value as `Bearer <string>` into
  *RevenueCat → Integrations → Webhooks → Authorization*.

## Files that already contain the Amazon changes

- `frontend/capacitor.config.json`
- `frontend/android/` (entire scaffolded project)
- `frontend/android/app/build.gradle`
- `frontend/android/app/src/main/AndroidManifest.xml`
- `frontend/android/app/src/main/assets/public/` (built bundle)
- `frontend/src/lib/revenuecat.js`
- `frontend/src/hooks/useAccess.js`
- `frontend/src/components/Paywall.js`
- `backend/server.py` — `POST /api/webhooks/revenuecat`
- `frontend/public/privacy.html` — Amazon-IAP wording

Nothing outside these paths references Stripe anymore.
