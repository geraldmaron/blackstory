# Cloud SQL production design (BB-012) — DEFERRED / DO NOT PROVISION
#
> **ADR-011 / D-014:** Firestore is the system of record. Do not create this instance
> for the current phase. Keep this doc only as a parked design if Postgres is
> reconsidered under ADR-011 migration triggers.
#
# Historical note: Do not create this instance until: Blaze/billing confirmed,
# `gcloud auth login` (or ADC) works, ADR-011 triggers are met, and a human approves cost/size.

## Target instance (parked design)

| Field | Value |
|-------|-------|
| GCP project | `black-book-efaaf` (332234323945) |
| Instance id | `black-book-pg-prod` |
| Engine | PostgreSQL 16 |
| Edition | Enterprise (or Enterprise Plus if HA SLO requires) |
| Region | `us-central1` (confirm against App Hosting / Cloud Run region before create) |
| Availability | Zonal for first cut; regional HA before public launch (BB-020) |
| Disk | SSD, start 20–50 GiB, autoscale enabled |
| Tier | `db-custom-2-7680` or smaller `db-f1-micro` **only** for disposable smoke — not production |
| Flags | `cloudsql.enable_google_ml_integration=off`; app timeouts via DB/role settings in `init/40-timeouts-and-limits.sql` |
| Extensions | `postgis`, `postgis_topology`, `pg_trgm`, `pgcrypto`, `uuid-ossp` |
| Database name | `blackbook` |
| Public IP | **Disabled** |
| Private IP | Required (VPC) |
| SSL | Required |
| Backups | Automated + PITR (BB-020 owns restore drills) |

## Private connectivity (trusted runtimes only)

```
Cloud Run / App Hosting (server) / Cloud Run Jobs
        │
        ▼
  Cloud SQL Auth Proxy / connector (IAM DB auth preferred)
        │
        ▼
  Cloud SQL private IP (VPC) ──► Postgres roles (role_*)
```

- **No browser** and **no public web client** receives a DSN, proxy socket, or SQL Connect client credential.
- Attach only surface SAs from `infra/gcp/service-accounts.matrix.md` to each runtime.
- Prefer **IAM database authentication** for Cloud Run SAs mapped to Postgres roles; local compose continues password roles for disposable use.

- Optional **PgBouncer** (Cloud SQL Auth Proxy sidecar or managed pooler pattern) sits between app pools and Cloud SQL; keep `appPoolMax` under `roleConnectionLimit` (`pool/pool-config.json`).
- Serverless VPC Access or Direct VPC egress required for private IP from Cloud Run.

## Disposable / local test

| Environment | Path |
|-------------|------|
| Local Docker | `pnpm db:up` → `postgis/postgis:16-3.4` + `init/` |
| CI | `.github/workflows/ci.yml` Integration Postgres service |
| Disposable cloud | Separate project only (D-013); never create disposable instances in `black-book-efaaf` without explicit approval |

## Cost caution (human action)

Approximate ballpark before create (verify in calculator):

- Small custom/shared core + SSD + private networking: typically **tens of USD/month** idle; HA and larger CPU/RAM scale quickly.
- SQL Connect / Data Connect service + Cloud SQL together require **Blaze** and billed Cloud SQL.

**Safe provisioning path (human):**

1. `gcloud auth login` and `gcloud auth application-default login`
2. Confirm billing / Blaze on `black-book-efaaf`
3. Enable APIs: `sqladmin.googleapis.com`, `servicenetworking.googleapis.com`, `firebasedataconnect.googleapis.com` (SQL Connect)
4. Reserve VPC peering / private services access
5. Create instance **private IP only** with approved tier
6. `firebase dataconnect:sql:setup` against the service in `sql-connect/`
7. Apply `init/` role/extension SQL (or equivalent Cloud SQL migration job as `role_migrations`)
8. Rotate local example passwords out of any cloud secret; store DSNs in Secret Manager only

## Blockers (as of BB-012)

- `gcloud` credentials unavailable in agent environment (auth list cannot write credentials db / no login)
- Docker daemon unavailable locally (compose not runtime-verified here)
- App Hosting / Blaze still blocked per BB-011
