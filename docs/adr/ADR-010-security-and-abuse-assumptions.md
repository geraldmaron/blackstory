# ADR-010: Security and abuse assumptions

- **Status:** Accepted (amended 2026-07-22)
- **Date:** 2026-07-16
- **Depends on:** ADR-001, ADR-004, ADR-005, ADR-006, ADR-007, ADR-008, ADR-009, ADR-020

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Threat model / abuse corpus | Written (`docs/security/`) | Expand automated gates over time |
| Auth (admin) | **Supabase Auth** with `app_metadata.bb_role` | Same |
| Public abuse controls | Request-integrity / client headers; App Check retired on mobile and `api-public` | Keep attestation without Firebase App Check dependency |
| Edge WAF / IAP / rate limits | Partial / staged | Armor/IAP where applied for Cloud Run admin/APIs |
| Security packages | `@repo/security` | Shared enforcement helpers |

These assumptions are **design constraints**. They are not evidence that every control already
exists in production.

## Context

BlackStory will face scrapers, submission spam, search/geocode exhaustion, SSRF via submitted
URLs, data poisoning aimed at promotion, and attempts to reach admin/publication paths. The
public historical corpus must remain readable under attack when possible (degraded read-only
mode), while optional and mutating features shut down first.

## Decision

### Trust assumptions

1. **The public internet is hostile.** All public endpoints assume unauthenticated or minimally
   authenticated abuse unless proven otherwise.
2. **Anonymous users never write canonical historical data.**
3. **Browser clients are untrusted** for authorization. Sensitive public mutations and expensive
   reads require **server-side checks** plus **request integrity / client attestation** (not
   Firebase App Check as a hard dependency after the 2026-07 wind-down).
4. **End-user tokens never authorize publication/internal APIs.**
5. **Administrators** use **Supabase Auth** + application RBAC (`app_metadata.bb_role`) and,
   for Cloud Run admin, IAP where applied. Admin is not “public + role claim only.”
6. **Service-to-service** calls use workload identity, not shared static secrets in browsers.
7. **External URLs and files are untrusted**; no synchronous fetch in user requests.
8. **Unknown living status is treated as living**; living residential addresses are never
   ordinary person-location fields or public API outputs.
9. **Volume ≠ truth**: submissions and repeated mirrors do not auto-increase confidence or publish.
10. **Defense in depth**: network (Armor/ALB when applied), identity (Auth/IAP/attestation),
    application quotas, DB roles/RLS, and release immutability all apply.

### Abuse & resilience assumptions

1. Search, geocode, nearby, corrections, auth, exports, and research starts need **stricter
   quotas** than static public reads.
2. Every queue, worker, API, and model provider has **bounded concurrency and cost**.
3. **Immediate read-only degraded mode** is supported: public pages render from release
   snapshots if APIs are disabled.
4. Kill switches exist per feature class (submissions, search, geocode, adapters, research,
   LLM, uploads, publication, exports) without defaulting to wiping the public corpus.
5. Production deploy requires security, test, migration, and rollback checks (ADR-006).
6. Logs must not contain secrets, raw attestation tokens, or protected addresses.

### Non-goals for v1 security architecture

- Perfect bot elimination (aim for cost and integrity bounds).
- Extra microservices beyond ADR-005 boundaries “for security.”

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Security = WAF only | Misses authZ, promotion integrity, and DB role failures |
| Security = “trusted users won’t abuse” | Corrections and search are anonymous/semi-anonymous abuse surfaces |
| Auto-disable entire public corpus on attack | Violates degraded-mode product requirement unless explicitly chosen |
| Publish-first, moderate-later for all claims | Incompatible with evidence and living-person invariants |
| Keep Firebase App Check as the only attestation path | Retired on mobile/`api-public`/web mutations; replaced by request-integrity / client headers |

## Consequences

- Public surfaces stay readable under load when possible; mutating features fail closed first.
- Admin and publication paths stay off the public trust domain.
- See `docs/security/` for threat model and abuse corpus detail.
