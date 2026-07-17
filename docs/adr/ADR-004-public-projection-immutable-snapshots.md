# ADR-004: Public projection and immutable publication snapshot model

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:** BB-002
- **Depends on:** ADR-002, ADR-005, ADR-007
- **Implements toward:** BB-019

## Scaffold vs target

| Aspect | Today (verified) | Target |
|--------|------------------|--------|
| Projection tables / release manifests | Not implemented | Denormalized public projections + immutable releases |
| `workers/publication` | Health stub | Projection, snapshot, indexing, release jobs |
| Public pages | Placeholder Next.js | Render from released projections / JSON snapshots only |

## Context

Public readers must never see draft canonical research. Promotion must be auditable, atomic, and instantly rollable. Hostile or buggy writers must not silently mutate what the public site shows. Entity pages must remain serveable if live APIs are disabled (degraded mode).

## Decision

1. **Canonical** evidence, claims, and research data are **not** public-readable.
2. **Denormalized public projection tables** (or equivalent public schema/views) are the live query surface for the public API.
3. Each publication produces an **immutable release record** with a **signed release manifest** (content hashes) and an associated **search-index version**.
4. **Public JSON snapshots** for entity (and related) pages are generated per release for CDN/App Hosting degraded rendering.
5. **Release activation is atomic**: a release either becomes fully active or not at all.
6. **Instant rollback** switches the active release pointer to a prior immutable release **without** rebuilding historical canonical data.
7. Draft/preview releases exist for admin/internal only; public traffic never reads drafts.
8. Every public fact maps to accepted claim and evidence records; publication and retraction are auditable (invariants 15–16).

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Public reads from canonical tables with row filters | High risk of draft leakage; harder credential isolation. |
| Mutable “current” rows without release manifests | Silent corruption; no instant rollback or hash verification. |
| Rebuild-from-canonical on every page view | Violates “no DB/model work in public render”; cost and abuse risk. |
| Separate microservice per entity type for projections | Over-decomposition; publication worker + public schema suffice. |
| Client-side assembly of claims into public pages | Bypasses release control and audit. |

## Consequences

- Publication pipeline complexity concentrates in `workers/publication` and `api-internal`.
- Storage grows with immutable releases and snapshots; retention policy required (BB-020).
- Public API responses include release/revision metadata.
- Admin console must never edit active public projections directly (preview → promote).

## Migration triggers

- Change snapshot format only with a new release generation that dual-writes until cutover.
- Add a CDN object store layout when snapshot volume exceeds App Hosting/static assumptions.
- Revisit denormalization shape when BB-049/BB-052 query patterns demand new projection columns (still one public schema, not new services).

## Rollback considerations

- Primary rollback: activate previous release pointer + prior search-index version (BB-019 acceptance).
- Snapshot/CDN objects for prior releases remain immutable and addressable.
- Do not “fix” an active release in place; publish a new release or roll back to a prior one.
- Database PITR is last resort for canonical corruption, separate from public release rollback.
