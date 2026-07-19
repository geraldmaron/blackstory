# ADR-010: Security and abuse assumptions

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:**
- **Depends on:** ADR-001, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007, ADR-008, ADR-009
- **Implements toward:** , Tranche 3 (–036)

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Threat model / abuse corpus | Written (`docs/security/`, ) | Expand tests under  |
| App Check, Armor, IAP, rate limits | **Not configured** | –027, –035 |
| Security packages | `@repo/security` stub | Shared enforcement helpers |

These assumptions are **design constraints** for all subsequent beads. They are not evidence that controls already exist in production.

## Context

BlackStory will face scrapers, submission spam, search/geocode exhaustion, SSRF via submitted URLs, data poisoning aimed at promotion, and attempts to reach admin/publication paths. The public historical corpus must remain readable under attack when possible (degraded read-only mode), while optional and mutating features shut down first.

## Decision

### Trust assumptions

1. **The public internet is hostile.** All public endpoints assume unauthenticated or minimally authenticated abuse unless proven otherwise.
2. **Anonymous users never write canonical historical data.**
3. **Browser clients are untrusted** for authorization; App Check (reCAPTCHA Enterprise) and server-side checks are mandatory for sensitive public mutations and expensive reads after enforcement beads.
4. **End-user tokens never authorize publication/internal APIs.**
5. **Administrators** use Firebase Auth + IAP + application RBAC; admin is not “public + role claim only.”
6. **Service-to-service** calls use workload identity, not shared static secrets in browsers.
7. **External URLs and files are untrusted**; no synchronous fetch in user requests.
8. **Unknown living status is treated as living**; living residential addresses are never ordinary person-location fields or public API outputs.
9. **Volume ≠ truth**: submissions and repeated mirrors do not auto-increase confidence or publish.
10. **Defense in depth**: network (Armor/ALB), identity (App Check/Auth/IAP), application quotas, DB roles, and release immutability all apply.

### Abuse & resilience assumptions

1. Search, geocode, nearby, corrections, auth, exports, and research starts need **stricter quotas** than static public reads.
2. Every queue, worker, API, and model provider has **bounded concurrency and cost**.
3. **Immediate read-only degraded mode** is supported: public pages render from release snapshots if APIs are disabled.
4. Kill switches exist per feature class (submissions, search, geocode, adapters, research, LLM, uploads, publication, exports) without defaulting to wiping the public corpus.
5. Production deploy requires security, test, migration, and rollback checks (ADR-006).
6. Logs must not contain secrets, raw App Check tokens, or protected addresses.

### Non-goals for v1 security architecture

- Perfect bot elimination (aim for cost and integrity bounds).
- Mobile-specific security models (contracts stay portable).
- Extra microservices beyond ADR-005 boundaries “for security.”

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Security = WAF only | Misses authZ, promotion integrity, and DB role failures. |
| Security = “trusted users won’t abuse” | Corrections and search are anonymous/semi-anonymous abuse surfaces. |
| Auto-disable entire public corpus on attack | Violates degraded-mode product requirement unless explicitly chosen. |
| Publish-first, moderate-later for all claims | Incompatible with evidence and living-person invariants. |
| Shared admin credentials in client bundles | Trivial extraction; fails . |

## Consequences

-  must encode these assumptions as testable abuse cases.
- Feature design starts with kill switches, quotas, and promotion gates, not afterthought hardening.
- Observability and IR runbooks are launch gates (, , ).
- Scaffold code must not temporarily “wire admin into public” for demos.

## Migration triggers

- Amend this ADR when  discovers a threat class not covered here.
- Tighten (never silently loosen) App Check/Armor enforcement when moving staging → prod.
- Revisit degraded-mode behavior only with explicit product acceptance of corpus unavailability.

## Rollback considerations

- Prefer feature kill switches and prior release activation over broad credential deletion that strands recovery.
- If App Check misconfiguration locks out users, fail to degraded snapshot reads rather than disabling all verification permanently.
- Incident response restores last known-good release and revoked identities; do not “hotfix” by merging services.
