# Mobile threat model

The native reader uses `apps/api-public` for released data. It has no canonical database write
credential. The server is authoritative even when the client, device or transport is hostile.
This document describes controls to verify, not evidence that every live deployment passes them.

## Compromised client and forged client headers

`X-BlackStory-Client` is a stateless platform/version format check. It is forgeable, has no device
attestation provider and performs no client-registry database lookup. It cannot authorize private
reads or writes. Enforce quotas, bounded queries, payload validation and publication separation
on the server. Test missing, malformed and forged headers against actual API handlers.

Do not add certificate pinning or root detection as a substitute for server authorization.
Public clients must never receive Supabase service keys, database credentials or staff tokens.

## Enumeration and scraping

Released records are public. Quotas, cursor depth limits, bounded export sizes and query budgets
reduce abuse; they do not make public material confidential. Validate the actual deployed API's
rate-limit persistence, cancellation and pool recovery. Simulated tests do not establish live
cost or distributed enforcement.

## Deep links

Parse only supported routes and allowlisted parameters. Reject executable URL schemes, open
redirect targets and unbounded search inputs. A deep link must not grant extra API permissions.
Test malformed and encoded routes on the actual native navigation surface.

## Stale releases, retractions and offline mode

Bind caches to release identity and validation metadata. Invalidate superseded projections and
search results together. Offline or degraded mode must not restore retracted/private data or
silently substitute seed records for a failed live read. Retain honest missing/stale states and
verify them under interrupted network and release changes.

## Update credentials and dependency supply chain

`app.config.ts`, `eas.json` and `src/updates/` own native runtime compatibility and update-channel
behavior. Protect Expo, Apple, Google and repository owner accounts with MFA and recovery custody.
Use scoped publish tokens; verify runtime-version fences and rollback on real binaries. Inspect
current plan entitlement before claiming end-to-end update signing or a staged rollout exists.

Audit native dependencies and lockfiles. An OTA JavaScript change cannot repair an incompatible
native dependency. A release configuration file alone does not prove signing or store readiness.

## Privacy

Keep raw queries, contribution text, source URLs containing secrets, precise coordinates and
sensitive classifications out of telemetry. No advertising/tracking SDK is part of this design.
Use the shared redaction and observability boundaries; test logs with hostile and sensitive data.

## Operational proof

Run the mobile lint, typecheck and test graph from `apps/mobile`, then the production-like
`pnpm mobile:ios:verify` path when native behavior changes. Exercise real API responses and
verify retraction/cache behavior, forged headers, deep links and update rollback. Record skipped
surfaces explicitly. Local test success does not certify remote account custody or an OTA drill.
