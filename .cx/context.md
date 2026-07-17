# Black Book — Project Context

> Required project state. All LLMs working in this repo should keep this file updated.

Updated: 2026-07-16 (BB-014 entity/geography on Firestore)

## What this is

Place-connected Black history research platform. Greenfield TypeScript + Python monorepo executing beads BB-001–BB-066.

## Current state

- Monorepo scaffold exists: `apps/*`, `workers/*`, `packages/*`, `infra/*`.
- Tranche 1 (BB-001–006, 008–010) and BB-007 design system are `done`.
- BB-011 Firebase apps registered in `black-book-efaaf`; App Hosting/Blaze + GCP SAs/buckets still blocked/deferred.
- **D-014 / ADR-011:** Firestore is the system of record; Cloud SQL / PostGIS / SQL Connect **deferred** (not provisioned).
- **BB-012** Postgres/SQL Connect repo artifacts are **parked** (`partial` — not production path).
- **BB-013** Firestore foundation is `done`: collections, rules, converters, seeds, emulator tests.
- **BB-014** entity/geography domain model is `done`: `@black-book/domain` + Firestore locations/relationships/merges.
- Active focus: Tranche 2; next **BB-015** (living-person and sensitive-location enforcement).

## Stack (intent)

| Layer | Choice |
|-------|--------|
| Languages | TypeScript (Node 22+, pnpm), Python 3.12+ (uv) |
| Public web | Next.js → Firebase App Hosting (target; ADR-001) |
| Admin | Next.js → Cloud Run + IAP (target; ADR-001/005) |
| APIs | Cloud Run (public / submissions / internal; ADR-005) |
| Workers | Python Cloud Run Jobs / Tasks (research, publication, security; ADR-007) |
| Data | **Cloud Firestore** (ADR-011); blobs in Storage/GCS; PostGIS/Cloud SQL parked |
| Search / geo | Geohash + bounded queries; Census Geocoder later (ADR-008) |
| Auth / abuse | Firebase Auth + App Check (intent; ADR-010); threat corpus BB-004 |
| Policy | Versioned product constitution (BB-003; shared TS + Python) |
| Env isolation | One production project (`black-book-efaaf`); SAs/buckets/Firestore rules; project split deferred (D-013) |
| CI | `.github/workflows/ci.yml`; Firestore emulator primary; Postgres CI optional |
| Firebase | Apps registered; App Hosting pending Blaze; local `demo-black-book` emulators |

Do not provision Cloud SQL. Do not infer working App Hosting backends or Auth/App Check enforcement from templates alone.

## Non-negotiable invariants (summary)

1. Anonymous clients never write canonical history.
2. Public clients never access canonical Firestore collections (or former “canonical tables”).
3. Submissions never go public without promotion.
4. Research workers and LLMs cannot publish; public rendering never invokes an LLM.
5. Public pages read only released projections/snapshots.
6. Living residential addresses are never returned publicly; unknown living status is treated as living.
7. External URLs/files are untrusted; no sync URL fetch in user requests.
8. SA / Auth-claim boundaries separate public / research / publication.
9. Bounded concurrency/cost limits; degraded read-only mode supported.
10. Production deploy requires security, test, migration, and rollback checks.

Full list: `plan.md` → Non-negotiable invariants.

## What agents should read first

| Doc | Role |
|-----|------|
| `plan.md` | Bead execution tracker (BB-001–BB-066) |
| `.cx/decisions/D-014-firestore-not-cloud-sql.md` | Authoritative data-plane pivot |
| `docs/adr/ADR-011-firestore-system-of-record.md` | Formal Firestore SoR decision |
| `infra/firebase/FIRESTORE_MODEL.md` | Collection map + rules summary |
| `docs/adr/README.md` | Architecture decisions |
| `packages/schemas/constitution/` | Product constitution (BB-003) |
| `docs/security/environment-isolation.md` | Isolation design |
| `infra/database/README.md` | Parked Postgres / SQL Connect |
| `docs/architecture.md` | Target architecture and boundaries |
| `README.md` | Bootstrap and commands |

## Agent rules

- Prefer updating these state files when project reality changes.
- Do not provision Cloud SQL or treat `infra/database/` as the production path.
- Do not invent working Firebase App Hosting / Auth enforcement status.
- Do not overwrite `docs/bb-001/*` owned by the baseline bead agent; link only.
- Do not expand deployables beyond ADR-005 security boundaries.
- Local Firebase defaults to `demo-black-book` emulators via `@black-book/firebase`; never point local/test at `black-book-efaaf` without the break-glass flag.
- Do not put production secret values in repo files.
