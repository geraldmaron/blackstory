# Minimal Firebase / GCP IAM for BB-011

Designed grants only. **Do not apply broad project roles.** Do not create
service-account keys. WIF for GitHub lands in BB-010.

Runtime identities (emails): `<id>@black-book-efaaf.iam.gserviceaccount.com`
— full matrix: [`../gcp/service-accounts.matrix.md`](../gcp/service-accounts.matrix.md).

## Firebase-facing principals

| Principal | Intended Firebase-related roles | Must not have |
|-----------|----------------------------------|---------------|
| Human owners/admins (break-glass) | Firebase Admin / project Owner via org process | Day-to-day runtime attachment |
| `web-runtime` | App Hosting runtime only; Secret Manager accessor on named web secrets | Firestore/Storage Admin; private-evidence; publish |
| `admin` | No Firebase Admin SDK project-wide roles; Auth verify via Admin SDK with least privilege later | Deploy; unrestricted Storage |
| `github-deploy` (WIF) | Deployer roles scoped to App Hosting / Cloud Run after BB-010 | Keys; unprotected PR trust |
| CI (GitHub Actions) | None against `black-book-efaaf` until WIF | Production Firebase tokens in secrets |

## Client identifiers vs secrets

| Kind | Examples | Storage |
|------|----------|---------|
| Public client identifiers | `apiKey`, `appId`, `projectId`, `authDomain`, `messagingSenderId` | Repo / App Hosting env values |
| Server secrets | Sentry DSN, session signing material, reCAPTCHA Enterprise *server* keys if any | Secret Manager; `secret:` refs in App Hosting YAML |

## Bucket IAM (authoritative for evidence)

Default Firebase Storage bucket (if enabled) stays **deny-all in rules**.  
Evidence/media classes use dedicated buckets from the BB-005 matrix — provision
with `gcloud` / Terraform after human confirmation; not created in BB-011.

## Apply checklist (human)

1. Create the eleven SAs if missing (no keys).
2. Bind only matrix roles; verify denials for `web-runtime` / `research` / `api-submissions`.
3. Grant Secret Manager secret-level accessors when secrets exist.
4. After Blaze: create App Hosting backends with `web-runtime` identity; disable auto production rollouts.
