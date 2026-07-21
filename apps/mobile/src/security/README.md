# `apps/mobile/src/security` — client-header attestation and log redaction (MOB-010)

Client-side security primitives for the native reader. Attestation is via the
`X-BlackStory-Client` header (`mobile/<version>; api=<major>`), validated
server-side against the Postgres-backed client registry — not Firebase App
Check. **Client headers are attestation signals, not authorization**
(invariant 6, ADR-010): nothing here gates data access. The server
(`apps/api-public` + `@repo/security`) stays authoritative.

## Modules

| File | Responsibility |
|---|---|
| `api-client.ts` | Thin wrapper that attaches `X-BlackStory-Client` to **every** request. Not the full typed client (MOB-009). |
| `log-redaction.ts` | Strips query text, correction content, precise location, citation URLs, sensitive classifications, and raw tokens from any log payload. |
| `bootstrap.ts` | Runtime wiring to `expo-constants` (kept out of the pure modules). |

## Forbidden controls (do NOT add)

No certificate pinning, no root/jailbreak detection. A rooted device defeats
them (threat-model T1) and they add native surface and false assurance. The
real controls are server-authoritative validation plus client-header attestation
as a *signal*. `no-forbidden-controls.test.ts` fails CI if these APIs are
introduced.

## What needs a real device + real backend (not simulable here)

MOB-019 / MOB-021 must provide live evidence for attestation bypass and
MITM/replay against the real Postgres-backed client registry. This bead covers
only what is testable client-side.
