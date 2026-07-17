# Firebase Auth and App Check

Production project: `black-book-efaaf` (`332234323945`).  
Registered apps: see [`registered-apps.json`](./registered-apps.json).

This document is the reproducible setup sequence. **Do not enable broad Auth
providers or Firebase-console enforcement from automation without an explicit
human provider choice and a successful metrics-only rollout.**

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

## App Check client binding and server enforcement

### Sequence

1. Ensure **reCAPTCHA Enterprise** API can be enabled (may require Blaze — confirm in console).
2. Create a reCAPTCHA Enterprise key bound to the public web origins.
3. In Firebase App Check, register **Black Book Web** with the reCAPTCHA Enterprise provider.
4. Optionally register **Black Book Admin** with a separate Debug / reCAPTCHA provider for non-production only; never share admin debug tokens in CI logs.
5. Set `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` for the web runtime. The web
   client calls `initializeAppCheckScaffold`, binds the reCAPTCHA Enterprise
   provider, and automatically refreshes tokens. Before each custom API request,
   call `getAppCheckRequestHeaders` with the returned App Check instance and
   merge its `X-Firebase-AppCheck` header into the request. Firebase does not
   automatically attach App Check tokens to custom API calls.
6. Deploy both custom APIs with `APP_CHECK_MODE=monitor`. Missing, invalid, and
   replayed token outcomes remain allowed but emit structured
   `app_check_verification` metrics. Events contain only mode, outcome, reason,
   and replay-policy state; they never include the raw token or verifier error.
7. Validate legitimate traffic, missing/invalid rates, reCAPTCHA Enterprise
   quota, and token propagation on every public and submissions endpoint.
8. Change `APP_CHECK_MODE=enforce` only after monitor metrics are healthy.
   Missing or invalid tokens then receive the stable `401 APP_CHECK_REQUIRED`
   decision. Invalid mode values fail startup rather than silently weakening
   enforcement.
9. Enable Firebase-console enforcement for Firebase products separately after
   the custom API rollout is healthy. This remains a human console operation.

### API integration contract

- `apps/api-public` exports `createPublicApiAppCheckGuard`. Invoke it before
  every endpoint handler. It verifies tokens but does not consume them by
  default because public read traffic is high-volume.
- `apps/api-submissions` exports `createSubmissionsApiAppCheckGuard`. Invoke it
  before every endpoint handler. It sets Admin SDK
  `consumeAppCheckToken: true` and rejects `alreadyConsumed` tokens in enforce
  mode. Consumption adds a network call and forces fresh attestation, so it is
  intentionally limited to this security-critical mutation surface.
- App Check protects browser-originated requests. Admin, internal APIs, workers,
  and other server-to-server callers authenticate with Cloud Run IAM/IAP service
  identities. They must not mint or forward browser App Check tokens. The shared
  guard accepts a trusted-service context only after infrastructure identity
  verification; never derive that context from an untrusted request header.

### Debug tokens

Debug tokens are permitted only for local and test runtimes. Pass
`runtime: "local"` or `runtime: "test"` to `initializeAppCheckScaffold`; keep the
actual token ephemeral and out of source, logs, and CI output. Any debug-token
configuration with `runtime: "production"` throws before Firebase SDK
initialization. Browser execution without an explicit runtime is treated as
production, which fails closed.

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
| Custom API App Check code | Implemented; deploy first with `APP_CHECK_MODE=monitor` |
| reCAPTCHA Enterprise key + Firebase App Check registration | Human console action pending |
| Firebase product console enforcement | Human action after monitor metrics are healthy |
