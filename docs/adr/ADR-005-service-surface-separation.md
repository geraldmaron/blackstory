# ADR-005: Public, submissions, internal, and admin service separation

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:** BB-002
- **Depends on:** ADR-001, ADR-003
- **Implements toward:** BB-021

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| App directories | `apps/web`, `admin`, `api-public`, `api-submissions`, `api-internal` present | Same boundaries as deployables |
| Runtime isolation / IAP / Armor | Not configured | BB-021–027 |
| Distinct SA / pipelines | **Designed** in `infra/gcp/` (BB-005); not provisioned | BB-010, BB-021, BB-062 |

## 2026-07-16 addendum — single production project

The surface decision remains unchanged, but all surfaces are currently designed inside the existing
production project `black-book-efaaf`. Project separation does not enforce these boundaries.
Distinct runtime SAs, bucket IAM, private ingress, per-secret IAM, and later Postgres roles are
therefore mandatory. No runtime may receive a broad project role that collapses the separation.

Development remains local/emulator-only. Optional staging names or App Hosting backends in the same
project are configuration scopes, not security boundaries. Re-split projects when non-production
needs cloud credentials/production-like data, research blast radius exceeds lower-layer controls,
or independent compliance, billing, incident, or recovery boundaries become required (D-013).

## Context

Compromise of anonymous traffic or the corrections intake path must not yield publication power. Admin must not share public route handlers. Internal promotion endpoints must not be callable with end-user tokens. The beads define an explicit security-boundary set; expanding into finer microservices increases cost without improving the threat model.

## Decision

Deploy **exactly** these security surfaces (no additional application microservices):

| Surface | Purpose | Network posture (target) |
|---------|---------|--------------------------|
| `apps/web` | Public UI | Public via App Hosting / CDN |
| `apps/api-public` | Read / search / location | Public via Armor/ALB; read-only public schema |
| `apps/api-submissions` | Corrections / contribution intake | Public but tightly rate-limited; quarantine writes only |
| `apps/api-internal` | Publication, promotion, internal control | **Not** on the public internet |
| `apps/admin` | Admin / research console | Cloud Run + IAP + app authorization |
| `workers/research` | Discovery / ingestion | Private jobs; cannot publish |
| `workers/publication` | Project / snapshot / release | Private jobs; cannot alter raw evidence |
| `workers/security` | Quarantine / validation / integrity | Private jobs |

Additional rules:

1. Distinct **service accounts** and **deployment pipelines** per surface.
2. Submissions compromise **cannot publish**.
3. Public API compromise **cannot modify** canonical data.
4. Admin paths **do not share** public route handlers or bundles with `apps/web`.
5. Internal publication endpoints **cannot** be called with end-user tokens.
6. Shared logic lives in `packages/*` libraries, not new deployables.

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Monolith API for public + submissions + internal | Single credential/process failure publishes or corrupts. |
| Microservice per domain entity (people, schools, events, …) | Over-decomposition beyond bead boundaries; ops cost without security gain. |
| Admin embedded in public Next.js app with route guards only | Shared runtime and accidental handler coupling; fails BB-021 acceptance. |
| Internal API publicly reachable with “secret” header | Insufficient; must be network-private + trusted identity. |
| Combining research and publication workers | Violates research-cannot-publish invariant. |

## Consequences

- More deployables and IAM to manage; accepted cost of isolation.
- Cross-surface calls use service identity, not browser sessions.
- Local monorepo keeps all apps for DX while production enforces separation.
- BB-006 must keep package import rules: packages cannot import apps; apps cannot reach across forbidden boundaries at runtime.

## Migration triggers

- Split a surface only if a **new security domain** appears (e.g., future file-upload quarantine BB-031) — treat as explicit bead, not casual extraction.
- Merge surfaces only with a written threat-model exception proving isolation is preserved another way.
- Expo/mobile later consumes the same public/submissions contracts (invariant 20); do not invent mobile-only services now.

## Rollback considerations

- Roll back individual Cloud Run / App Hosting revisions per surface; do not “simplify” by redeploying a combined binary.
- If a surface is unsafe, kill-switch that surface (BB-035) while others continue (especially public snapshot reads).
- IAM rollback: remove grants before deleting services to avoid orphaned public endpoints.
