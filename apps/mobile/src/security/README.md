# `apps/mobile/src/security` — App Check, token attachment, log redaction (MOB-010)

Client-side security primitives for the native reader. **App Check is
attestation, not authorization** (invariant 6, ADR-010): nothing here gates
data access. The server (`apps/api-public` + `@repo/security`) stays
authoritative.

## Modules

| File | Responsibility |
|---|---|
| `app-check.ts` | Provider resolution (App Attest/DeviceCheck iOS, Play Integrity Android; debug provider gated to dev + non-production) and **defensive** native init (degrades, never crashes, when Firebase config is absent). |
| `api-client.ts` | Thin wrapper that attaches the App Check token (`X-Firebase-AppCheck`) and version-floor header (`X-BlackStory-Client`) to **every** request. Not the full typed client (MOB-009). |
| `enforcement.ts` | The `monitor`/`enforce` stage value. Defaults to `monitor`; never hardcoded to `enforce`. |
| `log-redaction.ts` | Strips query text, correction content, precise location, citation URLs, sensitive classifications, and raw tokens from any log payload. |
| `bootstrap.ts` | Runtime wiring to `expo-constants` / `__DEV__` (kept out of the pure modules). |

## App Check enforcement cutover runbook (monitor → enforce)

App Check rolls out in stages (ADR-020 §3). **Do not skip to enforce.**

### Stage 1 — MONITOR (default, current)
- Client ships attestation and attaches tokens on every request.
- Server treats App Check as a pure observed signal (`missing_app_check` risk
  input) — **no request is denied** for a failed/absent token.
- `extra.appCheckEnforcementMode` = `monitor` (the default;
  `resolveEnforcementMode` treats anything but the literal `enforce` as
  `monitor`).
- **Exit criteria:** MOB-018 dashboards show the genuine-client
  verified-attestation rate is high and stable across the real device/OS fleet
  (false-negative rate on honest clients is negligible).

### Stage 2 — ENFORCE (deliberate, later, per endpoint class)
- Promote **server-side** (`APP_CHECK_MODE` on `apps/api-public`; see
  `apps/api-public/src/app-check.ts`). The client mode flag is advisory only —
  the client cannot self-grant enforcement.
- Set `APP_CHECK_ENFORCEMENT_MODE=enforce` for the build (drives client
  observability/UX only).
- **Even under enforce, reads fail open** to rate-limited `anonymous` access
  during an App Check *outage* (threat-model T2; ADR-010 degraded-read
  doctrine). Enforcement raises abuse cost; it is never a hard availability gate
  on public content.
- Tighten, never silently loosen, when moving staging → prod.

## Known server-side tension (not fixed here — out of scope)

`@repo/security`'s `DEFAULT_ENDPOINT_QUOTA_MATRIX` currently **hard-denies**
`expensive_read` (e.g. `/v1/search`) for anonymous callers lacking a verified
App Check token **even during an App Check outage** — contradicting
threat-model T2's fail-open-for-reads intent (flagged in
`apps/api-public/src/http/README.md`). This is a `@repo/security` owner
decision, tracked separately.

**What the client does about it today:** `api-client.ts` attaches a token on
**every** request, so a healthy client always attests and search works
normally. When no token is available (outage / gate-not-cleared), the client
still sends the request (fail-open *client*) but makes **no guarantee** the
server fails open — it surfaces the server's `429 RATE_LIMITED` verbatim rather
than assuming a fail-open for `search` that does not exist server-side yet.
`getAppCheckToken`'s doc-comment records this explicitly.

## Forbidden controls (do NOT add)

No certificate pinning, no root/jailbreak detection. A rooted device defeats
them (threat-model T1) and they add native surface and false assurance. The
real controls are server-authoritative validation + App Check as a *signal*.
`no-forbidden-controls.test.ts` fails CI if these APIs are introduced.

## What needs a real device + real backend (not simulable here)

MOB-019 / MOB-021 must provide live evidence for: patched-binary attestation
bypass, emulator-token replay, MITM/token-replay against a real App Check
backend, and the identical-data-with/without-token server assertion (T1). This
bead covers only what is testable client-side.
