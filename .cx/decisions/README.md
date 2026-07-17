# Decisions (session summaries)

Short pointers to formal ADRs under `docs/adr/`. Full text lives there.

| ID | Summary | ADR |
|----|---------|-----|
| D-001 | Public web on App Hosting; APIs + admin on Cloud Run | [ADR-001](../../docs/adr/ADR-001-firebase-app-hosting-vs-cloud-run.md) |
| D-002 | Cloud SQL + PostGIS (**superseded** for current phase) | [ADR-002](../../docs/adr/ADR-002-cloud-sql-postgresql-postgis.md) |
| D-003 | SQL Connect boundaries (**deferred**; parked templates) | [ADR-003](../../docs/adr/ADR-003-firebase-sql-connect-boundaries.md) |
| D-004 | Immutable releases + public projections/snapshots; atomic activate/rollback | [ADR-004](../../docs/adr/ADR-004-public-projection-immutable-snapshots.md) |
| D-005 | Fixed security surfaces only (web, 3 APIs, admin, 3 workers) | [ADR-005](../../docs/adr/ADR-005-service-surface-separation.md) |
| D-006 | GitHub Actions + OIDC/WIF; no auto App Hosting rollouts | [ADR-006](../../docs/adr/ADR-006-github-actions-deployment.md) |
| D-007 | Cloud Tasks + Cloud Run Jobs; outbox; bounded workers | [ADR-007](../../docs/adr/ADR-007-background-workflow-model.md) |
| D-008 | Firestore + geohash search first; Census Geocoder + cache | [ADR-008](../../docs/adr/ADR-008-search-and-geocoding.md) |
| D-009 | Research credential/role isolation; project split deferred; research cannot publish | [ADR-009](../../docs/adr/ADR-009-research-isolation.md) |
| D-010 | Hostile-internet assumptions; degraded read-only; layered abuse controls | [ADR-010](../../docs/adr/ADR-010-security-and-abuse-assumptions.md) |
| D-011 | Threat model + abuse corpus (19 P0; residual risk explicit) | [threat-model](../../docs/security/threat-model.md) |
| D-012 | BB-005 workload isolation design, reconciled by D-013 | [environment-isolation](../../docs/security/environment-isolation.md) |
| D-013 | Existing `black-book-efaaf` is the one production project; four-project split deferred (**superseded 2026-07-17** by [ADR-012](../../docs/adr/ADR-012-production-environment-resplit.md)) | [decision](./D-013-single-project-production.md) |
| D-014 | Firestore SoR; Cloud SQL / PostGIS / SQL Connect deferred | [decision](./D-014-firestore-not-cloud-sql.md) / [ADR-011](../../docs/adr/ADR-011-firestore-system-of-record.md) |

Updated: 2026-07-16 (D-014 Firestore pivot).
