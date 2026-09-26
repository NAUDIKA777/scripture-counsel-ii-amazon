# GitHub Actions — Amazon Appstore AAB Build

This workflow builds a **signed Amazon Appstore release AAB** (Android App
Bundle) on every push to `main` (and on manual dispatch and on `v*` tags). You
never need to install Java or the Android SDK locally — GitHub's ubuntu-latest
runners handle it.

**Output:** a signed AAB named `wisdomandword-amazon-v<ver>-<sha>.aab` attached
as a workflow artifact (30-day retention) and, for `v*` tag pushes, attached
to an auto-created GitHub Release.

---

## One-time setup

### 1. Push this repo to GitHub

Use Emergent's **"Save to GitHub"** button in the chat header. Confirm the repo
exists and shows the `.github/workflows/build-aab.yml` file.

### 2. Create a release keystore *(one-time — keep this file forever)*

On any machine with the JDK installed:

```bash
keytool -genkey -v \
        -keystore wisdomandword-release.keystore \
        -alias wisdomandword \
        -keyalg RSA -keysize 2048 -validity 10000
```

Answer the prompts (name, org, country, etc.), and set both the keystore
password and the key password. **Save `wisdomandword-release.keystore` and
both passwords in your password manager.** If you lose them you can never
publish an update to this app on Amazon.

### 3. Base64-encode the sensitive files

```bash
# Amazon PEM (downloaded from Amazon Developer Console → your app →
#             Upload Your App File → Additional information → View public key)
base64 -w0 AppstoreAuthenticationKey.pem     > pem.b64      # Linux
base64 -i  AppstoreAuthenticationKey.pem     > pem.b64      # macOS

# Keystore
base64 -w0 wisdomandword-release.keystore    > keystore.b64 # Linux
base64 -i  wisdomandword-release.keystore    > keystore.b64 # macOS
```

Copy the contents of each `.b64` file to your clipboard for the next step.

### 4. Add repository secrets

GitHub → your repo → **Settings → Secrets and variables → Actions → New
repository secret**. Add these six:

| Secret name                              | Value                                                 |
| ---------------------------------------- | ----------------------------------------------------- |
| `APPSTORE_AUTHENTICATION_KEY_PEM_B64`    | contents of `pem.b64`                                 |
| `ANDROID_KEYSTORE_B64`                   | contents of `keystore.b64`                            |
| `ANDROID_KEYSTORE_PASSWORD`              | keystore password from step 2                         |
| `ANDROID_KEY_ALIAS`                      | `wisdomandword`                                       |
| `ANDROID_KEY_PASSWORD`                   | key password from step 2                              |
| `REVENUECAT_AMAZON_PUBLIC_KEY`           | `amzn_oBFPlvVmUDQAdMgWSmvQOtLECVV`                    |

*(Optional)* If you want to override the backend base URL baked into the AAB,
add a **repository variable** (same UI, "Variables" tab) named
`REACT_APP_BACKEND_URL` — defaults to `https://scripture-counsel-2.preview.emergentagent.com`.

---

## Building an AAB

### Option A — automatic on every push to `main`

```bash
git add . && git commit -m "…" && git push origin main
```

Open the **Actions** tab → the latest "Build Amazon Appstore AAB" run →
**Artifacts** section → download `wisdomandword-amazon-aab`.

### Option B — manual dispatch (no code changes needed)

GitHub → **Actions** tab → left sidebar "Build Amazon Appstore AAB" →
**Run workflow** button → choose `main` → **Run workflow**.

### Option C — versioned release build with GitHub Release attached

```bash
# Bump versionCode + versionName in frontend/android/app/build.gradle first,
# commit, then tag and push:
git tag v1.0.0
git push origin v1.0.0
```

The Actions run will build the AAB, create a Release named `v1.0.0`, and
attach the signed AAB to it — one-click download from the Releases page,
which is perfect for uploading to the Amazon Developer Console.

---

## Time & cost

- **Time**: ~4–6 minutes per run on GitHub-hosted `ubuntu-latest`.
- **Cost**: free for public repos; private repos included in your GitHub plan's
  Actions minutes (typically 2,000/month on the free plan — plenty for this).

---

## Signing your AAB — important reminders

- The keystore used by CI **must be the same keystore** used forever.
  Amazon (and Google Play, and any future store) refuses updates signed by a
  different key.
- Rotate the keystore password only if it's leaked, and update the CI secret
  immediately.
- Never commit `.pem`, `.keystore`, `.jks`, or `.env` files — the
  `frontend/.gitignore` in this repo already blocks them, but double-check
  with `git status` before every commit.

---

## Troubleshooting

- **"APPSTORE_AUTHENTICATION_KEY_PEM_B64 secret missing"** — you forgot to add
  the secret in step 4, or the name is misspelled.
- **`aapt2 daemon startup failed`** — cache issue on the runner, click *Re-run
  jobs* on the failed run.
- **"Keystore was tampered with, or password was incorrect"** — the base64
  encoding accidentally added newlines. Re-encode with `base64 -w0` (Linux)
  or `openssl base64 -A` (macOS) and update the secret.
- **AAB builds but Amazon rejects with "Invalid PEM"** — you re-downloaded a
  new PEM from Amazon and forgot to update `APPSTORE_AUTHENTICATION_KEY_PEM_B64`.
  Amazon rotates a fresh PEM whenever you re-upload the app file to a new draft.

---

## Files

- `.github/workflows/build-aab.yml` — the workflow definition
- `frontend/android/` — the Capacitor Android project (auto-generated,
  don't hand-edit files outside `app/src/main/AndroidManifest.xml` and
  `app/build.gradle`)
- `frontend/android/app/src/main/assets/PLACE_AMAZON_PEM_HERE.txt` — reminder
  for local builds; CI ignores it
