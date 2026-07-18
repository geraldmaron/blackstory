# ADR-011: Firestore as system of record (Cloud SQL deferred)

- **Status:** Accepted
- **Date:** 2026-07-16
- **Bead:** BB-013 (rescoped); overrides BB-012 production path
- **Depends on:** ADR-004, ADR-005, ADR-009, ADR-010, D-013, D-014
- **Supersedes (current phase):** ADR-002 and ADR-003 production intent
- **Amends:** ADR-008 search/geo initial implementation path

## Scaffold vs target

| Aspect | Today (verified) | Target (current phase) |
|--------|------------------|------------------------|
| System of record | Firestore rules + typed paths/converters (BB-013 rescoped) | Cloud Firestore collections for structured product data |
| Blobs | Storage deny-all rules; GCS class buckets designed | Firebase Storage / GCS (unchanged) |
| Cloud SQL / PostGIS | Local compose + SQL Connect templates **parked** | **Not provisioned**; not production path |
| Search / geo | Not implemented | Geohash fields + bounded `api-public` queries; Census Geocoder later (BB-050) |

## Context

Execution beads originally mandated Cloud SQL PostgreSQL + PostGIS + Firebase SQL Connect. The product owner rejected that path for **cost and efficiency** while retaining Firebase Auth, App Check, Storage, and a single production project (`black-book-efaaf`). BB-012 delivered local PostGIS roles and SQL Connect templates; BB-013 Postgres migrations were interrupted and must not continue as the blocking path.

Non-negotiable product invariants still apply: no anonymous canonical writes; public reads of released projections/snapshots only; submissions require promotion; research cannot publish; living-person and evidence provenance rules remain binding.

## Decision

1. **Cloud Firestore** is the system of record for structured entities, claims, evidence **metadata**, sources, publication releases, public projections, submissions, audit events, policy refs, and operations documents.
2. **Firebase Storage / GCS** remains the blob store (evidence binaries, public media, quarantine, exports). Metadata in Firestore points at storage object refs; clients never gain broad storage write via rules.
3. **Cloud SQL, PostGIS, and SQL Connect are deferred** for the current phase. Artifacts under `infra/database/` and Postgres helpers in `@repo/data-access` remain in-repo as **parked / non-production** history, not as required CI or deploy blockers.
4. **Geography / nearby discovery (initial):** store `geohash` (and optional prefixes), `lat`, `lng` on public projection location documents; `api-public` performs approved geohash-bounded queries plus server-side radius filtering. No PostGIS requirement for beta.
5. **Text search (initial):** bounded field/prefix queries over released public projection documents; defer a dedicated search engine until measured need (same spirit as ADR-008, different first store).
6. **Access control:** Firestore security rules enforce client boundaries; privileged writes use **Admin SDK** from Cloud Run / workers with distinct service accounts. Custom Auth claims separate admin vs research console **reads** where needed; research still cannot publish.
7. **Public clients** may read only under `public/**` (released projections / active release pointer). They must not write canonical, evidence, publication, audit, or operations paths.

## Rejected alternatives (this phase)

| Alternative | Why rejected now |
|-------------|------------------|
| Provision Cloud SQL anyway “for parity with beads” | Fixed cost without validated need; owner override |
| Dual-write Firestore + Postgres from day one | Doubles complexity and cost; violates efficiency goal |
| Client SDK writes to canonical with rule filters | High leak/abuse risk; violates “no public canonical write” |
| Mass-delete BB-012 Postgres artifacts | Loses recoverable history; prefer park + banners |

## Consequences

- BB-013 becomes **Firestore schema foundation** (collections, rules, converters, seeds, emulator tests), not SQL migrations.
- BB-014+ domain models target Firestore document shapes; living-person rules remain constitution-driven.
- BB-020 backup/PITR shifts toward Firestore export / Storage versioning design (not Cloud SQL PITR) unless Postgres is reconsidered.
- CI primary data path is **Firestore emulator rules tests**; Postgres integration jobs are optional/skipped.
- Local PostGIS remains available for experiments but is not required for `pnpm test` / validate.

## Geography and search tradeoffs (honest)

| Capability | With Firestore + geohash | With PostGIS (deferred) |
|------------|--------------------------|-------------------------|
| Nearby radius | Good enough with geohash prefixes + server filter | Native ST_DWithin, indexes |
| Complex spatial joins | Weak / app-side | Strong |
| Full-text relevance | Bounded fields / later external search | `tsvector` / `pg_trgm` in-DB |
| Cost at low traffic | Usage-based | Always-on instance |
| Operational surface | Firebase-native | Cloud SQL + networking + roles |

## Migration triggers (reconsider Postgres)

Revisit Cloud SQL / PostGIS / SQL Connect only when **all** hold:

1. Measured geo/search/query SLOs fail under production-like load despite approved query shapes and indexes.
2. Multi-document transactional promotion/audit integrity cannot be met with Firestore transactions, batches, and outbox patterns.
3. Incremental Cloud SQL cost is justified by the measured capability gap.

If revisited: treat parked `infra/database/` as a starting point, not an automatic cutover; plan dual-run and rollback explicitly.

## Rollback considerations

- Do not provision Cloud SQL as a “rollback” from Firestore mistakes; use release pointer rollback (ADR-004) and Firestore export restore designs.
- Rules changes ship with emulator tests; deny-by-default on new collections until tested.
- Parked Postgres code must not be re-enabled in CI as required without an explicit new ADR.
