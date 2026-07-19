# BlackStory — Architecture

> Required project state. All LLMs working in this repo, including Construct, should keep this file updated.

## System overview

BlackStory is a place-connected Black history research platform. Public surfaces serve only released historical projections. Research, evidence, and promotion stay behind private APIs, workers, and admin tools.

## Target surfaces

```
apps/web                 Public Next.js (Firebase App Hosting — target)
apps/admin               Private Next.js admin/research (Cloud Run + IAP — target)
apps/api-public          Public read/search/location API (Cloud Run — target)
apps/api-submissions     Corrections / contribution intake (Cloud Run — target)
apps/api-internal        Publication / promotion / internal control (private Cloud Run — target)
workers/research         Python + Node research compute (Jobs / Tasks)
workers/publication      Projection, snapshot, indexing, release
workers/security         Quarantine, content validation, integrity
functions/               Firebase Functions v2 (capped discovery schedules — ADR-018)
packages/*               Shared TypeScript libraries
infra/*                  Firebase, GCP, GitHub, database scaffolding
```

Do not add deployable microservices beyond this set. See [ADR-005](./adr/ADR-005-service-surface-separation.md).

## Platform intent (not yet configured)

- **Data:** **Cloud Firestore** system of record (ADR-011 / D-014); blobs in Firebase Storage / GCS. Local PostGIS + SQL Connect under `infra/database/` are **parked / not production**.
- **App data access:** Firestore Admin SDK + security rules; `@repo/domain` entity/geography/provenance/claims models; `@repo/firebase` converters; `@repo/data-access` Firestore guards. SQL Connect deferred with Cloud SQL.
- **Public web vs APIs:** App Hosting for `apps/web`; Cloud Run for APIs + admin — [ADR-001](./adr/ADR-001-firebase-app-hosting-vs-cloud-run.md)
- **Auth / abuse:** Firebase Auth + App Check (reCAPTCHA Enterprise) — intent; assumptions in [ADR-010](./adr/ADR-010-security-and-abuse-assumptions.md)
- **Ingress:** Cloud Armor / ALB / CDN — intent only
- **Jobs:** Cloud Tasks + Cloud Run Jobs for long/heavy batch — [ADR-007](./adr/ADR-007-background-workflow-model.md); capped discovery schedules prefer Firebase Functions v2 `onSchedule` — [ADR-018](./adr/ADR-018-firebase-scheduled-functions-discovery.md)
- **CI/CD:** GitHub Actions + OIDC/WIF — [ADR-006](./adr/ADR-006-github-actions-deployment.md); PR CI live in-repo; deploy OIDC stub `.github/workflows/deploy-production.yml`; WIF Terraform under [`../infra/gcp/wif/`](../infra/gcp/wif/) (not applied)
- **Search / geo:** Geohash fields + bounded Firestore queries via `api-public`; U.S. Census Geocoder later — [ADR-008](./adr/ADR-008-search-and-geocoding.md) (amended by ADR-011). Domain helpers in `@repo/domain`.
- **Research isolation:** Dedicated credentials/SA/bucket policy inside the one project; research cannot publish; project split deferred — [ADR-009](./adr/ADR-009-research-isolation.md)
- **Environment isolation (/D-013):** Existing `black-book-efaaf` is the single production project; per-surface SAs, four buckets, and Firestore rules + SA boundaries provide workload isolation. Development is emulator-only; staging is configuration, not a security boundary. Resources beyond the known project/Hosting site are **not yet verified as provisioned** — [`security/environment-isolation.md`](./security/environment-isolation.md), [`../infra/gcp/`](../infra/gcp/).
- **Observability:** OpenTelemetry + Sentry — packages stubbed, not wired

Do not claim Firebase production data plane or App Hosting works until the corresponding beads land and are verified. Do **not** provision Cloud SQL. See [`ds-001/baseline-report.md`](./ds-001/baseline-report.md).

## Boundaries

| Concern | Rule |
|---------|------|
| Canonical write | Never from anonymous or public clients |
| Public read | Released projections / immutable snapshots only ([ADR-004](./adr/ADR-004-public-projection-immutable-snapshots.md)) |
| Promotion | Required before any submission becomes public |
| Research / LLM | Cannot publish; public render never calls an LLM |
| Living persons | No public residential addresses; unknown living status ⇒ living |
| External URLs | Untrusted; no synchronous fetch in user requests |
| Credentials | Public API read-only on public projections; research ≠ publication SAs/claims |
| Product policy | Versioned constitution only; not mutable via public endpoints |

Full non-negotiable list: [`../plan.md`](../plan.md).

## Product constitution

Single source of truth: `packages/schemas/constitution/policy.v1.json`, validated by `product-constitution.schema.json`.

| Consumer | Package | Role |
|----------|---------|------|
| TypeScript apps/packages | `@repo/schemas` | Zod-validated loaders + evaluators (`policyVersion` on every result) |
| Python workers | `black-book-constitution` | `jsonschema`-validated loaders + evaluators against the same JSON |

Do not hard-code relevance/confidence thresholds, precision rules, or living-person rules in apps. Policy changes are version bumps in the shared JSON, never a public write API.

## Security threat model

Hostile-environment design is documented under [`docs/security/`](./security/):

| Doc | Role |
|-----|------|
| [`security/threat-model.md`](./security/threat-model.md) | 19 P0 threats with preventive / detective / containment / recovery |
| [`security/abuse-cases.md`](./security/abuse-cases.md) | AC-01–19 mapped to implementation beads |
| [`security/threat-corpus.json`](./security/threat-corpus.json) | Machine-readable corpus (validated by `@repo/testing`) |
| [`security/tests/checklist.md`](./security/tests/checklist.md) | Manual/CI checklist scaffold (full gates in ) |

Assumptions remain binding in [ADR-010](./adr/ADR-010-security-and-abuse-assumptions.md). Controls are mostly unimplemented until Tranche 3.

## Environment isolation

Single-project design (not applied): [`security/environment-isolation.md`](./security/environment-isolation.md). Matrices and Terraform stubs: [`../infra/gcp/`](../infra/gcp/). The root `.firebaserc` points to production `black-book-efaaf`; App Hosting stubs remain unprovisioned.

| Acceptance | Design enforcement |
|------------|--------------------|
| Dev credentials cannot access production | N/A as project split; development is local/emulator-only and tests fail closed against production |
| Research workers cannot publish | Distinct research SA/DB role; no public-media, release, deploy, or impersonation grants |
| Public services cannot read private evidence | No bucket IAM for web/api-public; PAP + UBLA; no broad project storage roles |
| Quarantine cannot be served publicly | Public Access Prevention enforced + UBLA; only submissions create / security scan |
| Submissions compromise ≠ publish | Submissions SA: quarantine write only; no canonical / publication / evidence |

## Key decisions

Formal ADRs: [`docs/adr/`](./adr/README.md). Session summaries: [`.cx/decisions/`](../.cx/decisions/).

| ADR | Topic |
|-----|-------|
| [001](./adr/ADR-001-firebase-app-hosting-vs-cloud-run.md) | App Hosting vs Cloud Run |
| [002](./adr/ADR-002-cloud-sql-postgresql-postgis.md) | Cloud SQL PostgreSQL + PostGIS (**superseded** by ADR-011) |
| [003](./adr/ADR-003-firebase-sql-connect-boundaries.md) | SQL Connect usage boundaries (**deferred**) |
| [004](./adr/ADR-004-public-projection-immutable-snapshots.md) | Public projections + immutable snapshots |
| [005](./adr/ADR-005-service-surface-separation.md) | Public / submissions / internal / admin separation |
| [006](./adr/ADR-006-github-actions-deployment.md) | GitHub Actions deployment model |
| [007](./adr/ADR-007-background-workflow-model.md) | Background workflow model |
| [008](./adr/ADR-008-search-and-geocoding.md) | Search and geocoding (Firestore + geohash) |
| [009](./adr/ADR-009-research-isolation.md) | Research isolation |
| [010](./adr/ADR-010-security-and-abuse-assumptions.md) | Security and abuse assumptions |
| [011](./adr/ADR-011-firestore-system-of-record.md) | Firestore as system of record (Cloud SQL deferred) |

## Execution

Bead order and status: [`../plan.md`](../plan.md). Active focus: course-correction expansion (–089) — design language (/068/069), map platform, vector search, and hostile-environment/hygiene beads landing alongside the original Tranche 5/6 public-product backlog (–063). Tranches 1–4 are complete except deferred/parked items (, ).
