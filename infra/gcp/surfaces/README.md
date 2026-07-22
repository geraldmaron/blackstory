# Deployable surface matrix (BB-021)

Machine-readable source: [`surface-matrix.json`](./surface-matrix.json). Typed runtime checks:
[`packages/config/src/surfaces.ts`](../../../packages/config/src/surfaces.ts).

Companion isolation design (SAs, buckets, WIF): [`../isolation-matrix.json`](../isolation-matrix.json).

## Surfaces

| Surface | App | Runtime | Network posture | Service account |
|---------|-----|---------|-----------------|-----------------|
| Public web | `apps/web` | **Vercel** (ADR-027) | Public CDN | Vercel + runtime secrets (Postgres SoR) |
| Public read API | `apps/api-public` | Cloud Run | Public read (Armor) | `api-public@…` |
| Submissions API | `apps/api-submissions` | Cloud Run | Public, rate-limited | `api-submissions@…` |
| Internal publication API | `apps/api-internal` | Cloud Run | **Private** (no public ingress) | `api-internal@…` |
| Admin console | `apps/admin` | App Hosting interim (`black-book-admin-production`); target Cloud Run + IAP | IAP-protected (target) | `admin-runtime@…` (interim) |

Firestore (ADR-011) holds canonical data; blobs stay in the four GCS buckets from BB-005. Surface
separation is enforced by **distinct deployables**, **typed capability checks**, **Firestore rules +
Admin SDK SA boundaries**, and **network posture** (private ingress / IAP).

## Public web binding

- Source: `apps/web`
- Host: **Vercel** git integration from `apps/web` (ADR-027) — explicit Production promote
- Contract doc: `apps/web/SURFACE.md`
- Retired in-repo: `apps/web/apphosting*.yaml`, `black-book-web-*` App Hosting backends
- Runtime: Vercel env + Postgres SoR — no quarantine/evidence access, no publish permission

## Per-surface deployment pipelines (stubs)

Full rollout is **BB-062**. Until then, each surface has a named job in the production workflow
design. The BB-010 workflow (`.github/workflows/deploy-production.yml`) already establishes OIDC/WIF
identity; surface jobs will impersonate only the target runtime SA.

| Job (planned) | Target | Impersonated SA | Notes |
|---------------|--------|-----------------|-------|
| `record-vercel-production` | Vercel Production | n/a (git + dashboard promote) | ADR-027; no App Hosting promote |
| `deploy-api-public` | Cloud Run `black-book-api-public` | `api-public` | `--ingress=all` + Armor |
| `deploy-api-submissions` | Cloud Run `black-book-api-submissions` | `api-submissions` | Strict rate limits |
| `deploy-api-internal` | Cloud Run `black-book-api-internal` | `api-internal` | **`--ingress=internal-and-cloud-load-balancing`** |
| `deploy-admin` | App Hosting `black-book-admin-production` (interim) | `admin-runtime` | `firebase apphosting:rollouts:create … --force`; target Cloud Run + IAP |

Deploy identity: `github-deploy@black-book-efaaf.iam.gserviceaccount.com` via WIF
(`infra/gcp/wif/`). No long-lived JSON keys. Admin App Hosting rollouts are operator-driven Firebase
CLI steps — not deleted `promote-app-hosting.sh` helpers.

## Human provisioning checklist (not applied in repo)

1. **WIF apply** — `infra/github/scripts/apply-wif.sh --apply`; set GitHub Environment vars.
2. **Service accounts** — create runtime SAs from `../service-accounts.matrix.md`.
3. **Cloud Run ingress** — internal-only for `api-internal`; IAP + LB for `admin` (target).
4. **Cloud Armor** — attach to public API + submissions services. Design:
   [`../armor/`](../armor/) (BB-023); security narrative
   [`docs/security/ingress-armor.md`](../../../docs/security/ingress-armor.md). Deploy public APIs
   with `--ingress=internal-and-cloud-load-balancing` (not `--ingress=all`).
5. **Vercel project** — connect repo; Root Directory `apps/web`; Production promote explicit.
6. **Admin App Hosting backend** — create `black-book-admin-production` with `apphosting.admin.yaml`;
   disable automatic rollouts; roll out with `firebase apphosting:rollouts:create … --force`.
7. **Firestore IAM** — scope Admin SDK usage per SA (no project-wide Editor).
8. **Secret Manager** — per-surface secret accessors only.

## Validation

```bash
pnpm --filter @repo/config test
pnpm --filter @repo/api-public test
pnpm --filter @repo/api-submissions test
pnpm --filter @repo/api-internal test
pnpm --filter @repo/admin test
```

See also [`docs/security/service-surfaces.md`](../../../docs/security/service-surfaces.md) and
[`docs/security/ingress-armor.md`](../../../docs/security/ingress-armor.md) (BB-023).
