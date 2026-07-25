# admin Cloud Run deploy (Firebase App Hosting replacement)

Tracked by `repo-348e.5` (parent epic `repo-348e`: strip Firebase out of the project). Target
architecture is **Cloud Run + IAP**, per `docs/decisions-carryover.md` / ADR-005 — this was the
plan even before Firebase removal became explicit scope, not new scope creep.

`apphosting.admin.yaml` (Firebase App Hosting) still exists and is still the live deploy path.
**Do not delete it** until a real Cloud Run deploy in this runbook has been verified in staging
and DNS/routing has cut over — that is `repo-348e.8`, a separate bead, gated on human action.

## What changes vs. `apphosting.admin.yaml`

| Aspect | apphosting.admin.yaml (current) | Cloud Run (this runbook) |
|--------|----------------------------------|---------------------------|
| Build | Firebase App Hosting buildpack + `scripts/apphosting-build.mjs`, triggered by `GOOGLE_BUILDABLE`/`APPHOSTING_BUILD_TARGET` | `apps/admin/Dockerfile`, built with `gcloud builds submit` or `docker build` |
| Runtime start | App Hosting invokes `node apps/admin/.next/standalone/apps/admin/server.js` directly | Same standalone server, run inside the Docker image (`CMD ["node", "apps/admin/server.js"]` from `WORKDIR /app`) |
| Access control | Firebase Hosting's public edge (no IAP) — app-level auth only (`ADMIN_AUTH_MODE=supabase`) | Cloud Run service **not** `--allow-unauthenticated`; IAP (or an equivalent identity-aware proxy) gates access in front of app-level auth — see IAP section below |
| Scaling config | `runConfig.minInstances/maxInstances/concurrency/cpu/memoryMiB` in YAML | Equivalent `gcloud run deploy` flags (`--min-instances`, `--max-instances`, `--concurrency`, `--cpu`, `--memory`) |
| Secrets | `secret: admin-database-url` / `admin-supabase-anon-key` references resolved by App Hosting | Same Secret Manager secrets, referenced via `--set-secrets` |
| Identity | `admin-runtime@black-book-efaaf.iam.gserviceaccount.com` (kept distinct from web's runtime identity per ADR-005 surface-separation intent) | Same service account, attached via `--service-account` |

The data layer is unchanged: `apps/admin` is already fully Postgres/Supabase-backed
(`ADMIN_AUTH_MODE=supabase`, `ADMIN_DATA_SOURCE=postgres`) — this is a hosting-layer swap only,
not a data migration.

## Required env (Cloud Run)

Same variables as `apphosting.admin.yaml` today, carried over 1:1:

| Variable | Value / source |
|----------|----------------|
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `ADMIN_AUTH_MODE` | `supabase` |
| `NEXT_PUBLIC_ADMIN_AUTH_MODE` | `supabase` |
| `ADMIN_DATA_SOURCE` | `postgres` |
| `DATABASE_URL` | Secret Manager `admin-database-url` |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | `https://twykhihqkcldpreuovay.supabase.co` |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret Manager `admin-supabase-anon-key` |
| `NEXT_PUBLIC_SITE_URL` | `https://blackstory.app` |
| `NEXT_PUBLIC_FIREBASE_*` (project id, auth domain, storage bucket, sender id, app id, api key) | Unchanged — Firebase Auth stays available as the `ADMIN_AUTH_MODE=firebase` rollback path; do not delete the Firebase project as part of this cutover |
| `PORT` | `8080` (Cloud Run default; matches `EXPOSE 8080` / `ENV PORT=8080` in the Dockerfile) |

## IAP — needs a decision before the first real deploy

`docs/decisions-carryover.md` and the bead description name "Cloud Run + IAP" as the target but
do not specify IAP configuration details (OAuth brand/consent screen, authorized principals,
whether IAP or the Supabase operator-role check is the primary gate). Before a human runs the
deploy below in a real environment, someone needs to decide and document:

1. Whether Cloud Run IAP is enabled via `gcloud run services add-iam-policy-binding` +
   `roles/iap.httpsResourceAccessor` restricted to specific operators/group, or via a Load
   Balancer + Identity-Aware Proxy backend service (IAP is not available directly on a Cloud Run
   URL without a serverless NEG + external HTTPS LB in front of it — a Cloud Run service alone can
   only do `--no-allow-unauthenticated` + IAM, which is a lighter-weight approximation of "IAP").
2. Which principals (Google group vs. individual accounts) get `roles/run.invoker` /
   `roles/iap.httpsResourceAccessor`.
3. Whether the existing Supabase `app_metadata.bb_role=admin` check stays as defense-in-depth
   behind IAP, or IAP replaces it. (Recommendation: keep both — IAP as network-layer gate,
   Supabase role check as app-layer authorization; do not treat IAP as a substitute for the
   existing auth check.)

This runbook ships the deploy command with `--no-allow-unauthenticated` (IAM-gated, not public)
as the safe default. Wiring an actual IAP/load-balancer front end is separate GCP console/Terraform
work not included here — see "Requires human action" below.

## Deploy (human operator — requires GCP project access)

```bash
# From repo root after merging to the release branch
gcloud config set project black-book-efaaf

# Build + push (replace TAG with the git SHA being deployed)
gcloud builds submit . \
  --config /dev/stdin <<'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'apps/admin/Dockerfile', '-t', 'gcr.io/black-book-efaaf/admin:TAG', '.']
images: ['gcr.io/black-book-efaaf/admin:TAG']
EOF
# (or, simpler, once TAG is resolved: `docker build -f apps/admin/Dockerfile -t gcr.io/black-book-efaaf/admin:TAG .`
#  followed by `docker push gcr.io/black-book-efaaf/admin:TAG`)

# Deploy / update the service (env vars reference Secret Manager — never inline DATABASE_URL
# or the Supabase anon key)
gcloud run deploy admin \
  --image "gcr.io/black-book-efaaf/admin:TAG" \
  --region us-central1 \
  --platform managed \
  --no-allow-unauthenticated \
  --service-account admin-runtime@black-book-efaaf.iam.gserviceaccount.com \
  --min-instances 0 \
  --max-instances 2 \
  --concurrency 20 \
  --cpu 1 \
  --memory 384Mi \
  --set-env-vars "NEXT_PUBLIC_APP_ENV=production,ADMIN_AUTH_MODE=supabase,NEXT_PUBLIC_ADMIN_AUTH_MODE=supabase,ADMIN_DATA_SOURCE=postgres,SUPABASE_URL=https://twykhihqkcldpreuovay.supabase.co,NEXT_PUBLIC_SUPABASE_URL=https://twykhihqkcldpreuovay.supabase.co,NEXT_PUBLIC_SITE_URL=https://blackstory.app,NEXT_PUBLIC_FIREBASE_PROJECT_ID=black-book-efaaf,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=black-book-efaaf.firebaseapp.com,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=black-book-efaaf.firebasestorage.app,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=332234323945,NEXT_PUBLIC_FIREBASE_APP_ID=1:332234323945:web:e1b31c78e32d95943bfd78" \
  --set-secrets "DATABASE_URL=projects/black-book-efaaf/secrets/admin-database-url:latest,SUPABASE_ANON_KEY=projects/black-book-efaaf/secrets/admin-supabase-anon-key:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=projects/black-book-efaaf/secrets/admin-supabase-anon-key:latest"
```

`NEXT_PUBLIC_FIREBASE_API_KEY` is a client-exposed Firebase Web API key (present in
`apphosting.admin.yaml` as a plain value, not a secret) — carry it the same way if the Firebase
Auth rollback path is being kept live; omit it if that rollback path is being retired first.

Post-deploy smoke (from an operator machine with IAM-authorized `gcloud` credentials, since the
service is not publicly reachable):

```bash
gcloud run services proxy admin --region us-central1 --port 8081
curl -sS 'http://127.0.0.1:8081/' -o /dev/null -w '%{http_code}\n'
```

Rollback: `gcloud run services update-traffic admin --to-revisions=<previous-revision>=100`, or
fail back to `apphosting.admin.yaml` (still live and undeleted) by pointing DNS/routing back at
Firebase Hosting.

## Local build validation

```bash
cd /path/to/repo/root
docker build -f apps/admin/Dockerfile -t admin-cloud-run-local .
docker run --rm -p 8080:8080 \
  -e ADMIN_AUTH_MODE=supabase \
  -e NEXT_PUBLIC_ADMIN_AUTH_MODE=supabase \
  -e ADMIN_DATA_SOURCE=postgres \
  -e SUPABASE_URL=https://twykhihqkcldpreuovay.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_URL=https://twykhihqkcldpreuovay.supabase.co \
  -e SUPABASE_ANON_KEY=<local/staging anon key> \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<local/staging anon key> \
  -e DATABASE_URL=<staging DATABASE_URL> \
  admin-cloud-run-local
curl -sS 'http://127.0.0.1:8080/' -o /dev/null -w '%{http_code}\n'
```

## Requires human action before this bead is fully done

- Run the actual `gcloud builds submit` / `docker build` + `gcloud run deploy` against a real GCP
  project (staging first) — not executed in this pass.
- Decide and configure the IAP front end (Cloud Run IAM-only vs. serverless NEG + external HTTPS
  LB + IAP) per the "IAP — needs a decision" section above, including which principals get access.
- Provision/verify the `admin-runtime@black-book-efaaf.iam.gserviceaccount.com` service account
  has the Cloud Run and Secret Manager IAM bindings it needs (it already exists per
  `apphosting.admin.yaml`'s comments, but its bindings were scoped for App Hosting, not Cloud Run
  IAM-invoker).
- Parity-test the Cloud Run deployment against the current Firebase-hosted admin (per the bead's
  acceptance criteria) before any DNS/routing cutover.
- DNS/routing cutover from the current admin surface to the Cloud Run (or IAP/LB) endpoint.
- Only after the above are confirmed: delete `apphosting.admin.yaml` and decommission the Firebase
  App Hosting backend for admin — that is `repo-348e.8`, not this bead.
