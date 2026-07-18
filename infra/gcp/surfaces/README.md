# Deployable surface matrix (BB-021)

Machine-readable source: [`surface-matrix.json`](./surface-matrix.json). Typed runtime checks:
[`packages/config/src/surfaces.ts`](../../../packages/config/src/surfaces.ts).

Companion isolation design (SAs, buckets, WIF): [`../isolation-matrix.json`](../isolation-matrix.json).

## Surfaces

| Surface | App | Runtime | Network posture | Service account |
|---------|-----|---------|-----------------|-----------------|
| Public web | `apps/web` | Firebase App Hosting | Public CDN | `web-runtime@black-book-efaaf.iam.gserviceaccount.com` |
| Public read API | `apps/api-public` | Cloud Run | Public read (Armor) | `api-public@…` |
| Submissions API | `apps/api-submissions` | Cloud Run | Public, rate-limited | `api-submissions@…` |
| Internal publication API | `apps/api-internal` | Cloud Run | **Private** (no public ingress) | `api-internal@…` |
| Admin console | `apps/admin` | Cloud Run + IAP | IAP-protected | `admin@…` |

Firestore (ADR-011) holds canonical data; blobs stay in the four GCS buckets from BB-005. Surface
separation is enforced by **distinct deployables**, **typed capability checks**, **Firestore rules +
Admin SDK SA boundaries**, and **network posture** (private ingress / IAP).

## Public web binding

- Source: `apps/web`
- App Hosting config: `apps/web/apphosting.yaml` (+ `apphosting.production.yaml`, optional staging)
- Proposed backend id: `black-book-web-production`
- Contract doc: `apps/web/SURFACE.md`
- Runtime SA: `web-runtime` — no quarantine/evidence access, no publish permission

## Per-surface deployment pipelines (stubs)

Full rollout is **BB-062**. Until then, each surface has a named job in the production workflow
design. The BB-010 workflow (`.github/workflows/deploy-production.yml`) already establishes OIDC/WIF
identity; surface jobs will impersonate only the target runtime SA.

| Job (planned) | Target | Impersonated SA | Notes |
|---------------|--------|-----------------|-------|
| `deploy-web-app-hosting` | App Hosting backend | `web-runtime` | `firebase deploy` / App Hosting API |
| `deploy-api-public` | Cloud Run `black-book-api-public` | `api-public` | `--ingress=all` + Armor |
| `deploy-api-submissions` | Cloud Run `black-book-api-submissions` | `api-submissions` | Strict rate limits |
| `deploy-api-internal` | Cloud Run `black-book-api-internal` | `api-internal` | **`--ingress=internal-and-cloud-load-balancing`** |
| `deploy-admin` | Cloud Run `black-book-admin` | `admin` | IAP enabled on backend service |

Deploy identity: `github-deploy@black-book-efaaf.iam.gserviceaccount.com` via WIF
(`infra/gcp/wif/`). No long-lived JSON keys.

## Human provisioning checklist (not applied in repo)

1. **WIF apply** — `infra/github/scripts/apply-wif.sh --apply`; set GitHub Environment vars.
2. **Service accounts** — create runtime SAs from `../service-accounts.matrix.md`.
3. **Cloud Run ingress** — internal-only for `api-internal`; IAP + LB for `admin`.
4. **Cloud Armor** — attach to public API + submissions services. Design:
   [`../armor/`](../armor/) (BB-023); security narrative
   [`docs/security/ingress-armor.md`](../../../docs/security/ingress-armor.md). Deploy public APIs
   with `--ingress=internal-and-cloud-load-balancing` (not `--ingress=all`).
5. **App Hosting backend** — create `black-book-web-production` with `web-runtime` SA.
6. **Firestore IAM** — scope Admin SDK usage per SA (no project-wide Editor).
7. **Secret Manager** — per-surface secret accessors only.

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
