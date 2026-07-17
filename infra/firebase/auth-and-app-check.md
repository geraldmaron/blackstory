# Firebase Auth and App Check (BB-011 plan)

Production project: `black-book-efaaf` (`332234323945`).  
Registered apps: see [`registered-apps.json`](./registered-apps.json).

This document is the reproducible setup sequence. **Do not enable broad Auth
providers or App Check enforcement from automation without an explicit human
provider choice.** App Check *enforcement* belongs to BB-024; BB-011 only
registers apps and scaffolds config.

## Authentication configuration plan

### Goals

| Surface | Auth posture |
|---------|----------------|
| `apps/web` (public) | Prefer anonymous/read-only public access; Auth only if a reviewed product flow requires signed-in users |
| `apps/admin` | Firebase Auth may identify the browser session, but **authorization is IAP + server roles** (BB-027), not client claims alone |
| APIs / workers | Service accounts + IAM; no end-user Firebase Auth tokens for server-to-server |

### Reproducible steps (human console / CLI)

1. Confirm project `black-book-efaaf` after `firebase login` (native CLI; no tokens in repo).
2. Enable **Authentication** / Identity Toolkit for the project when ready to configure providers.
3. Authorized domains (minimum):
   - `localhost` (emulator / local Next)
   - `black-book-efaaf.firebaseapp.com`
   - `black-book-efaaf.web.app`
   - Final App Hosting custom domain when assigned (after Blaze + backend create)
4. **Provider choice (human required before enabling):**
   - Recommended default for public beta: **no social providers** until a product decision.
   - Admin path: prefer Cloud IAP on Cloud Run; if Firebase Auth is used for admin UX, restrict to an allowlisted Google Workspace / Cloud Identity domain.
5. Do **not** mint custom tokens from the public web runtime.
6. Emulator: local Auth uses `demo-black-book` via `pnpm firebase:emulators` — never point local clients at production Auth without the production break-glass flag in `@black-book/firebase`.

### Config artifacts in repo

- Client identifiers: `registered-apps.json` + App Hosting `NEXT_PUBLIC_FIREBASE_*` values.
- Runtime validation: `@black-book/firebase` (`parseWebFirebaseEnv`, `parseAdminFirebaseEnv`, `parseServerFirebaseEnv`).
- Secrets (session cookies, admin private keys, etc.): **Secret Manager names only** in `apps/web/apphosting*.yaml`. No JSON keys.

## App Check scaffold (registration only; enforce in BB-024)

### Sequence

1. Ensure **reCAPTCHA Enterprise** API can be enabled (may require Blaze — confirm in console).
2. Create a reCAPTCHA Enterprise key bound to the public web origins.
3. In Firebase App Check, register **Black Book Web** with the reCAPTCHA Enterprise provider.
4. Optionally register **Black Book Admin** with a separate Debug / reCAPTCHA provider for non-production only; never share admin debug tokens in CI logs.
5. Ship client SDK wiring (`initializeAppCheck` scaffold in `@black-book/firebase`) in **monitoring / metrics mode**.
6. Validate legitimate traffic and token propagation on public expensive paths.
7. **Enforce** per product/API in **BB-024** (not here).

### What App Check does not replace

- Admin authorization (IAP / server RBAC)
- Bucket IAM and Storage/Firestore deny-all rules
- Rate limits / Cloud Armor (BB-023–025)

## Blockers observed during BB-011

| Item | Status |
|------|--------|
| Web + Admin app registration | Done (see `registered-apps.json`) |
| App Hosting backends | Blocked — project not on Blaze; `firebaseapphosting.googleapis.com` cannot enable |
| Firestore API / database | Not enabled / not created — human must pick location then create; deploy rules after |
| Default Storage bucket | Named in SDK config; provision/rules deploy pending API enablement |
| `gcloud` ADC | Not logged in in agent environment — GCP SA/bucket/IAM provisioning deferred |
| Auth providers | Not enabled (awaiting human provider choice) |
| App Check enforcement | Deferred to BB-024 |
