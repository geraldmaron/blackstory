# Runbook: Production cloud apply checklist (BB-079)

**Scope:** The single consolidated list of every "human cloud step remaining" note scattered
across the close comments and READMEs of roughly a dozen closed beads
(BB-005/009/010/011/020/021/023/024/025/027/034/035, plus BB-061's drill), reorganized against the
[ADR-012](../adr/ADR-012-production-environment-resplit.md) three-project topology
(`blackbook-prod` = retained `black-book-efaaf`, `blackbook-staging`, `blackbook-internal`) that
BB-078 designed but did not apply.

**Not executed by this document or by the session that wrote it.** No `gcloud`, `firebase
deploy`, `firebase appcheck:*`, `terraform apply`, `gh repo create`, `gh api --method PUT/POST`,
or other cloud/account-mutating command listed below has been run by any agent session. Every
command in this checklist is written for a human operator (or a future session explicitly
authorized to touch live infrastructure) to run themselves, in order, with the review gates each
source bead already specified.

**Acceptance model (per BB-079):** binary per roster line — applied + verified + evidenced, or
explicitly deferred with reason. Every line item below is currently:

> **Status: DEFERRED — requires live cloud/account action outside this session's authority.**

**How to use this document:** work top to bottom. Each numbered section is independently gate-able
(its own Terraform `false` variables / dry-run scripts), but sections 1-4 are load-bearing for
everything after them (no WIF without a remote; no App Check/Armor/rate-limits/backups/admin/
telemetry without the projects and service accounts they attach to). When a section is actually
applied, replace its status line with `APPLIED — <date> — <verification output / evidence link>`
and copy that line into `bd show black-book-bb079`'s notes/comments (the parent session does the
`bd` mutation; this document is written so each item's status can be copied verbatim).

## Global prerequisites (apply before section 1)

- A human identity with authority to create a GitHub organization/repository, a GCP billing
  account, and administer both.
- `gh`, `gcloud`, `firebase-tools`, `terraform >= 1.6.0`, `jq`, and `node` installed locally.
- Read [ADR-012](../adr/ADR-012-production-environment-resplit.md) and
  [`production-environment-resplit-migration.md`](./production-environment-resplit-migration.md)
  in full before starting section 3 — this checklist references that runbook's 19 steps rather
  than repeating them.
- Read the **"Gaps found during consolidation"** section near the end of this document before
  running section 4 or section 3. Gaps 1–4 (service-account topology, `private-evidence` home,
  named-database Firebase deploy targets, named-database PITR gate) were reconciled by
  `black-book-2ve`; remaining items (IAP README rewrite, Memorystore artifact, submissions-puller
  implementation) still apply.

---

## 1. GitHub remote, rulesets, CODEOWNERS, allowed-actions

**Traces to:** BB-009 (close note: *"Local artifacts + Governance CI; remote rulesets **not**
applied (no remote; `gh` auth invalid)"*).

**Why:** All governance (`main-protection` ruleset, Actions allowlist, secret scanning /
push-protection, CODEOWNERS enforcement) exists as reviewed local JSON under `infra/github/` and
passes `pnpm validate:governance`, but nothing has ever been applied to a real GitHub remote
because no remote exists and the cached `gh` token is invalid. This blocks every downstream item
that depends on a real `repository_id`/`repository_owner_id` (section 2) or a protected `main`
branch (the production-deploy invariant in `infra/github/README.md`).

**Commands:**

```bash
# 1. Fix gh auth (interactive; needs an admin-capable token/scope on the target org/repo)
gh auth login -h github.com
gh auth status

# 2. Create the remote (do not invent a name/visibility without explicit human direction)
gh repo create OWNER/REPO --private --source=. --remote=origin
git push -u origin main

# 3. Optional: create CODEOWNER teams on the org before step 4
#    (security, infra, policies, database, publication) then update .github/CODEOWNERS

# 4. Dry-run governance (safe, prints planned API calls, no mutation)
./infra/github/scripts/apply-governance.sh --dry-run

# 5. Apply (mutating; requires the admin gh session from step 1)
./infra/github/scripts/apply-governance.sh --apply
# If a main-protection ruleset already exists from a prior partial apply:
./infra/github/scripts/apply-governance.sh --apply --force

# 6. Record numeric IDs needed by section 2 (WIF)
gh api repos/OWNER/REPO --jq '{repository_id: (.id|tostring), owner_id: (.owner.id|tostring), full_name: .full_name}'
```

Source files: `infra/github/rulesets/main-protection.json`, `infra/github/allowed-actions.json`,
`infra/github/security-settings.json`, `infra/github/scripts/apply-governance.sh`.

**Verify:**

```bash
./infra/github/scripts/check-governance.sh
# Optional strict mode — fails closed if secret scanning/private vuln reporting are absent
./infra/github/scripts/check-governance.sh --strict-security
```

Expected: ruleset `main-protection` present with PR-required + all required checks listed in
`infra/github/README.md`'s "Required CI check names" table; Actions allowlist matches
`allowed-actions.json`; `security_and_analysis` settings match `security-settings.json` (may 403
depending on plan/visibility — script warns rather than fails).

**Cross-reference (do not duplicate here):** root-account hardening for this same GitHub
org/account — hardware security keys/passkeys, removing SMS 2FA, org-wide 2FA-required, offline
recovery codes, separating the billing-owner identity from the day-to-day deploy identity — is
BB-089's scope ("Root-account hardening... added to the BB-079 human-apply checklist" per
BB-089's own Deliver text). Apply it in the same sitting as step 1 above, once BB-089's operator
runbook lands; that runbook is authoritative for the exact steps, not this document.

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 2. WIF / OIDC (GitHub Actions deploy identities)

**Traces to:** BB-010 (close note: *"Declarative WIF + OIDC workflow stub; cloud not applied (no
remote; IDs TBD)"*), extended by BB-078/ADR-012 for per-project deploy service accounts.

**Why:** The WIF pool/provider and the `github-deploy` (blackbook-prod), `github-deploy-staging`
(blackbook-staging, optional), and `github-deploy-internal` (blackbook-internal, optional) service
accounts are fully modeled in Terraform with fail-closed CEL attribute conditions
(`repository_id`, `repository_owner_id`, `ref == refs/heads/main`, `environment`, `workflow_ref`),
but the pool has never been created because the numeric GitHub IDs from section 1 don't exist yet.

**Prerequisites:** Section 1 complete (remote + numeric IDs recorded); `gcloud` ADC login.

**Commands:**

```bash
# 1. Authenticate gcloud
gcloud auth login
gcloud auth application-default login

# 2. Copy and fill the tfvars with section 1's numeric IDs
cp infra/gcp/wif/terraform/envs/prod.tfvars.example infra/gcp/wif/terraform/envs/prod.tfvars
# Edit prod.tfvars: github_owner, github_repository, github_repository_id, github_owner_id

# 3. Dry-run (terraform init + validate + plan; never mutates)
./infra/github/scripts/apply-wif.sh --dry-run

# 4. Apply — creates the pool/provider + blackbook-prod's github-deploy binding (always required)
./infra/github/scripts/apply-wif.sh --apply

# 5. Optional, once section 3 has created blackbook-staging / blackbook-internal:
#    set in prod.tfvars: enable_staging_deploy_identity=true, staging_project_id=blackbook-staging
#                         enable_internal_deploy_identity=true, internal_project_id=blackbook-internal
#    then re-run:
./infra/github/scripts/apply-wif.sh --apply

# 6. Create protected GitHub Environments (production always; staging/internal optional)
gh api --method PUT "repos/OWNER/REPO/environments/production" \
  --input infra/github/oidc/environments/production.json
gh api --method PUT "repos/OWNER/REPO/environments/staging" \
  --input infra/github/oidc/environments/staging.json

# 7. Wire Actions variables (names only — never a JSON key) per infra/github/oidc/README.md:
#    GCP_PROJECT_ID, GCP_WORKLOAD_IDENTITY_PROVIDER (terraform output), GCP_SERVICE_ACCOUNT
```

Source files: `infra/gcp/wif/terraform/` (`wif.tf`, `iam.tf`, `variables.tf`), `infra/gcp/wif/
trust-conditions.md`, `infra/gcp/wif/deploy-roles.md`, `infra/github/oidc/environments/
production.json`.

**Verify:**

```bash
./infra/github/scripts/check-wif.sh
gh api "repos/OWNER/REPO/environments/production" --jq '{name,protection_rules,deployment_branch_policy}'
```

Expected: `check-wif.sh` reports the pool, provider, and per-environment deploy SA bindings live;
no exported SA keys anywhere (`infra/github/oidc/sa-key-removal.md` documents the removal path if
one ever appears). A test deploy workflow run from a fork or non-`main` ref must fail federation.

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 3. Firebase projects, Firestore, rules/indexes

**Traces to:** BB-011 (close note: *"Apps registered; App Hosting/Blaze + Firestore DB + GCP
buckets/IAM still blocked/deferred"*), BB-013 (rules/indexes), BB-078/ADR-012 (three-project
topology + named databases).

**Why:** `black-book-efaaf` has registered web/admin apps but no Blaze billing, no Firestore
database, and no deployed rules/indexes (`infra/firebase/auth-and-app-check.md`'s "Blockers
observed during BB-011" table). BB-078 additionally requires two **new** projects
(`blackbook-staging`, `blackbook-internal`) with `blackbook-internal` hosting named Firestore
databases `raw-ingest`/`curated`.

**For project creation, API enablement, and named-database creation, follow
[`production-environment-resplit-migration.md`](./production-environment-resplit-migration.md)
steps 1–3 — do not duplicate that sequence here.** That runbook uses
`infra/gcp/terraform/multi-project/` gated by `create_new_projects`,
`provision_internal_databases`.

**Everything BB-078's runbook does *not* cover (Blaze, default-DB creation, rules/indexes deploy)
— commands:**

```bash
# 1. Blaze upgrade (link billing) — not in the BB-078 runbook; needed before App Hosting APIs,
#    reCAPTCHA Enterprise (section 5), or any paid API can enable
gcloud billing projects link black-book-efaaf   --billing-account=<ACCOUNT_ID>
gcloud billing projects link blackbook-staging  --billing-account=<ACCOUNT_ID>
gcloud billing projects link blackbook-internal --billing-account=<ACCOUNT_ID>

# 2. Enable Firestore Native mode + default (unnamed) database for blackbook-prod / blackbook-staging
#    (infra/gcp/terraform/multi-project/firestore.tf explicitly does NOT manage these — see its
#    header comment: "blackbook-prod and blackbook-staging keep a single (default) database each")
gcloud firestore databases create --project=black-book-efaaf  --location=us-central1 --type=firestore-native
gcloud firestore databases create --project=blackbook-staging --location=us-central1 --type=firestore-native

# 3. Deploy rules + indexes to each project's default database
firebase deploy --only firestore:rules,firestore:indexes --project=black-book-efaaf
firebase deploy --only firestore:rules,firestore:indexes --project=blackbook-staging

# 4. Mirror .firebaserc (root, outside every bead's file ownership) per runbook step 14
#    infra/firebase/.firebaserc.example already shows the target shape (default/production/staging/internal)

# 5. Re-register apps/admin's Firebase app under blackbook-internal per runbook step 15
firebase apps:create WEB "Black Book Admin" --project=blackbook-internal
```

Source config: `infra/firebase/firebase.json`, `infra/firebase/firestore.rules`,
`infra/firebase/firestore.indexes.json`, `infra/firebase/.firebaserc.example`.

**Resolved by `black-book-2ve`:** `infra/firebase/firebase.json` now declares deploy targets for
the named databases `raw-ingest` and `curated` (rules + indexes). Deploy with
`firebase deploy --only firestore:rules,firestore:indexes` after the databases exist.

**Verify:**

```bash
firebase firestore:databases:list --project=black-book-efaaf
firebase firestore:databases:list --project=blackbook-internal   # expect raw-ingest, curated, (default)
gcloud billing projects describe black-book-efaaf --format='value(billingEnabled)'   # expect True
node --test infra/gcp/terraform/multi-project/tests/isolation-invariants.test.mjs
```

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 4. Buckets and service accounts (11 named SAs, 4 buckets, PAP/UBLA, per-secret IAM)

**Traces to:** BB-005 (`infra/gcp/service-accounts.matrix.md`, `infra/gcp/storage-buckets.matrix.md`,
`infra/gcp/terraform/`), split across projects by BB-078/ADR-012.

**Why:** BB-005 designed 11 least-privilege service accounts and 4 UBLA/PAP buckets in a single
project; none is provisioned. BB-078 then redesigned the *topology* (not the roles) so that
`research`, `publication`, `security`, and `admin`(→`admin-app`) move to `blackbook-internal`,
joined there by two new cross-project identities (`promotion`, `submissions-puller`), while
`web-runtime`, `api-public`, `api-submissions`, `api-internal`, `migrations`, `backup` stay in
`blackbook-prod` (mirrored into `blackbook-staging`).

**Resolved by `black-book-2ve`:** the single-project stub no longer lists the four ADR-012-relocated
identities; `private-evidence` is provisioned as `blackbook-internal-private-evidence` in the
multi-project module. Apply multi-project gates in order per `infra/gcp/terraform/multi-project/README.md`
(`provision_internal_buckets` before relying on that bucket). If a legacy
`black-book-efaaf-private-evidence` bucket exists in prod, migrate objects before decommissioning it.

**Commands:**

```bash
# 1. blackbook-prod: reconciled SA list (web-runtime, api-public, api-submissions, api-internal,
#    migrations, backup, github-deploy) + public-media/exports/quarantine buckets
cd infra/gcp/terraform
terraform init -backend=false
terraform validate
terraform plan  -var-file=envs/prod.tfvars
terraform apply -var-file=envs/prod.tfvars   # human-reviewed; do not skip plan review

# 2. blackbook-staging: mirrored SAs (same 6 as prod, no github-deploy prod alias)
cd infra/gcp/terraform/multi-project
terraform apply -var-file=envs/prod.tfvars -var provision_staging_service_accounts=true

# 3. blackbook-internal: research/publication/security/admin-app/promotion/submissions-puller
terraform apply -var-file=envs/prod.tfvars -var provision_internal_service_accounts=true

# 4. One-way promotion cross-project IAM (promotion/security/submissions-puller -> blackbook-prod;
#    per-database IAM inside blackbook-internal) — requires step 3's internal SAs to already exist
terraform apply -var-file=envs/prod.tfvars -var apply_cross_project_iam=true

# 5. Per-secret IAM (not a single stub — bind individually as secrets are created)
gcloud secrets add-iam-policy-binding <SECRET_NAME> \
  --member="serviceAccount:<sa>@<project>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" --project=<project>
```

Source files: `infra/gcp/terraform/{locals.tf,buckets.tf,service_accounts.tf,iam.tf}`,
`infra/gcp/terraform/multi-project/{service_accounts.tf,iam-cross-project.tf,locals.tf}`,
`infra/gcp/service-accounts.matrix.md`, `infra/gcp/storage-buckets.matrix.md`,
`infra/gcp/iam-boundaries.md`, `infra/firebase/iam-minimal.md`.

**Verify:**

```bash
node --test infra/gcp/terraform/multi-project/tests/isolation-invariants.test.mjs
gcloud iam service-accounts list --project=black-book-efaaf
gcloud iam service-accounts list --project=blackbook-internal
gcloud storage buckets describe gs://black-book-efaaf-quarantine \
  --format='value(iamConfiguration.publicAccessPrevention,iamConfiguration.uniformBucketLevelAccess.enabled)'
# Negative case (AC-ISO-2/3): no blackbook-prod principal resolves any role in blackbook-internal
gcloud projects get-iam-policy blackbook-internal --format=json | grep -i 'black-book-efaaf'   # expect no match
```

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 5. App Check (reCAPTCHA Enterprise, monitor then enforce)

**Traces to:** BB-024 (close note: *"Human gaps remain: create/register the reCAPTCHA Enterprise
provider and enable Firebase-console enforcement only after monitor metrics are healthy"*).

**Why:** Server-side App Check verification (`APP_CHECK_MODE=monitor|enforce`), replay rejection,
and telemetry are fully implemented and tested in `apps/api-public`/`apps/api-submissions`. What's
missing is entirely console/API-side: the reCAPTCHA Enterprise key doesn't exist, App Check hasn't
registered a provider for either app, and enforcement hasn't been flipped on.

**Commands:**

```bash
# 1. Create the reCAPTCHA Enterprise key bound to the public web origin(s) (requires Blaze, section 3)
gcloud recaptcha-enterprise keys create \
  --project=black-book-efaaf \
  --display-name="black-book-web-appcheck" \
  --web \
  --domains=black-book-efaaf.web.app,black-book-efaaf.firebaseapp.com,<production-domain> \
  --integration-type=SCORE

# 2. Register the key with Firebase App Check for "Black Book Web"
#    (Firebase console: Project Settings -> App Check -> apps/web -> Register -> reCAPTCHA
#    Enterprise; no firebase-tools CLI subcommand for this step as of writing — console-only,
#    matching infra/firebase/auth-and-app-check.md's documented sequence)

# 3. Set the site key for the web runtime
#    NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY=<key> in apps/web/apphosting*.yaml (already wired to
#    initializeAppCheckScaffold — see infra/firebase/auth-and-app-check.md)

# 4. Deploy both custom APIs with APP_CHECK_MODE=monitor first; watch app_check_verification metrics
# 5. Once monitor metrics are healthy, flip APP_CHECK_MODE=enforce on both APIs (env var, redeploy)
# 6. Enable Firebase-console enforcement for Firebase products separately (console-only step)
```

Source: `infra/firebase/auth-and-app-check.md` (full 9-step sequence), `packages/firebase`
App Check guard exports, `apps/api-public`/`apps/api-submissions` App Check middleware.

**Verify:**

```bash
# app_check_verification metrics show mode=monitor, then mode=enforce, with healthy outcome rates
# Confirm the stable failure decision:
curl -i https://<api-public-host>/v1/entities/x -H "X-Firebase-AppCheck: invalid"  # expect 401 APP_CHECK_REQUIRED once enforce is live
```

Expected: missing/invalid/replayed tokens produce `401 APP_CHECK_REQUIRED` only after enforce
mode; monitor-mode telemetry shows no raw token or verifier error in logs (redaction spot-check).

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 6. Cloud Armor and protected public API ingress

**Traces to:** BB-023 (close note ordered human-apply list, quoted below).

**Why:** BB-023 delivered the full design (policies, ALB/NEG/CDN docs, geo controls, emergency
deny runbook, load-test plan, metrics checklist) with 6/6 tests passing, but explicitly "no live
apply." The close comment's own ordered list is the source for this section.

**Commands:**

```bash
# 1. Create Armor policies from the declarative JSON (native gcloud import supports JSON)
gcloud compute security-policies create black-book-api-public-armor --project=black-book-efaaf
gcloud compute security-policies import black-book-api-public-armor \
  --file=infra/gcp/armor/policies/api-public-policy.json --file-format=json --project=black-book-efaaf

gcloud compute security-policies create black-book-api-submissions-armor --project=black-book-efaaf
gcloud compute security-policies import black-book-api-submissions-armor \
  --file=infra/gcp/armor/policies/api-submissions-policy.json --file-format=json --project=black-book-efaaf

# 2. Create serverless NEGs + backend services (CDN on api-public only) — see alb-neg-design.md, cdn-design.md
# 3. Create global external HTTPS load balancer + DNS (api.blackbook.app, submit.blackbook.app)
# 4. Lock Cloud Run ingress to the LB only
gcloud run services update black-book-api-public      --project=black-book-efaaf --ingress=internal-and-cloud-load-balancing
gcloud run services update black-book-api-submissions  --project=black-book-efaaf --ingress=internal-and-cloud-load-balancing

# 5. Run infra/gcp/armor/load-test-plan.md in staging; wire infra/gcp/armor/metrics-alerts-checklist.md
# 6. Set infra/gcp/armor/ingress-matrix.json's status to applied (repo edit, out of this bead's file ownership)
```

Source: `infra/gcp/armor/{ingress-matrix.json,policies/*.json,alb-neg-design.md,cdn-design.md,
emergency-deny-runbook.md,load-test-plan.md,metrics-alerts-checklist.md}`. Note: the `gcloud
compute security-policies import ... --file-format=json` invocation is inferred from gcloud's
documented import/export support for the SecurityPolicy resource shape the policy JSON already
matches (`name`, `type`, `rules[].match.expr.expression`, `rateLimitOptions`); the repo's own
README only states the human-step bullet, not this literal command — verify the exact flag syntax
against the `gcloud` version in use before running.

**Verify:**

```bash
node --test infra/gcp/armor/armor-policy.test.mjs   # local policy-shape acceptance, already passing pre-apply
curl -I https://api.blackbook.app/health            # expect 200 via LB hostname
curl -I https://<direct-run-app-url>/health          # expect failure/blocked (AC-ARMOR-2)
```

Expected per `infra/gcp/armor/README.md`'s acceptance table: AC-ARMOR-1 (LB-only ingress),
AC-ARMOR-2 (direct `run.app` fails), AC-ARMOR-3 (429 on sustained flood + metrics), AC-ARMOR-4
(priority-10 emergency deny flips without redeploy — see `emergency-deny-runbook.md`).

**Note:** `infra/gcp/surfaces/surface-matrix.json` still shows `ingress=all` from BB-021; BB-023's
close comment flags that this section supersedes it at apply time — update that matrix's status
alongside step 6 (out of this checklist's file ownership; note for whoever executes this).

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 7. Rate-limit backing store (Memorystore/Redis)

**Traces to:** BB-025 (close note: *"Remaining live work: Cloud Run middleware wiring, shared
Redis/Memorystore RateLimitStore, BB-034 telemetry export, BB-059 load tests, production matrix
tuning"*).

**Why:** The policy matrix, token-bucket evaluator, and per-endpoint guards
(`createPublicRateLimitGuard`/`createSubmissionsRateLimitGuard`) are complete and tested, but they
run against a bounded **in-memory** store (`createInMemoryRateLimitStore`) that does not survive
multiple Cloud Run instances/revisions. `docs/security/rate-limits.md` explicitly says "Production
should swap the store interface for Redis/Memorystore... without changing policy math."

**GAP (flag):** unlike every other section, there is no Terraform stub, gcloud script, or design
doc anywhere in `infra/` for the Memorystore instance itself — `grep -ril "memorystore|redis"`
across `infra/`, `docs/`, and `packages/security` returns only the one sentence in
`docs/security/rate-limits.md`. The commands below are inferred from standard Memorystore
provisioning, not sourced from a repo artifact — verify sizing/tier/network choices with whoever
owns the BB-025/BB-033 cost model before running.

**Commands (inferred, not sourced from a repo stub):**

```bash
# 1. Provision a Basic-tier Memorystore Redis instance in blackbook-prod (VPC-adjacent to Cloud Run)
gcloud redis instances create black-book-ratelimits \
  --project=black-book-efaaf --region=us-central1 --tier=basic --size=1 \
  --redis-version=redis_7_0

# 2. Mirror into blackbook-staging with a smaller size once section 3 creates that project
gcloud redis instances create black-book-ratelimits \
  --project=blackbook-staging --region=us-central1 --tier=basic --size=1

# 3. Implement a Redis-backed RateLimitStore in packages/security (application code — out of this
#    bead's file ownership; file a follow-up bead if one doesn't already exist) and wire it into
#    apps/api-public / apps/api-submissions in place of createInMemoryRateLimitStore
# 4. Serverless VPC Access connector so Cloud Run can reach the Memorystore instance's private IP
gcloud compute networks vpc-access connectors create black-book-connector \
  --project=black-book-efaaf --region=us-central1 --network=default --range=10.8.0.0/28
```

**Verify:**

```bash
gcloud redis instances describe black-book-ratelimits --project=black-book-efaaf --region=us-central1 \
  --format='value(state,host,port)'   # expect state=READY
pnpm --filter @black-book/security test   # policy math unaffected by store swap
# Load test: confirm rate-limit denials are now consistent across concurrent Cloud Run instances
# (see infra/gcp/armor/load-test-plan.md for the adjacent BB-059 load-test harness)
```

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 8. Backups (Firestore PITR + scheduled exports + retention) and quarterly restore drill

**Traces to:** BB-020 (close note: *"Human cloud steps remaining: enable Firestore+PITR,
provision firestore-backups bucket (terraform stub), bind backup@ IAM, deploy Scheduler jobs, live
quarterly drill"*), BB-061 (close note: *"Repo acceptance met... Live PITR/bucket/scheduler and
quarterly drill remain human cloud follow-up, same pattern as BB-021"*).

**Why:** Export schedule design, retention matrix, RPO/RTO targets, deny-delete IAM design, and
dry-run verification scripts (9/9 passing) all exist. Nothing has been enabled in Firestore or GCP.

**Commands:**

```bash
# 1. Enable Firestore PITR (7-day minimum; extend per infra/firebase/backup/rpo-rto.md)
gcloud firestore databases update --project=black-book-efaaf --database='(default)' --enable-pitr

# 2. Create the backup bucket from the reviewed Terraform stub (copy out of terraform/, review, apply)
cp infra/firebase/backup/terraform/backup-bucket.tf.stub infra/gcp/terraform/backup-bucket.tf
cp infra/firebase/backup/terraform/backup-iam.tf.stub     infra/gcp/terraform/backup-iam.tf
cd infra/gcp/terraform && terraform plan -var-file=envs/prod.tfvars && terraform apply -var-file=envs/prod.tfvars

# 3. Bind backup@ IAM per infra/firebase/backup/iam-backup-protection.md (objectCreator, no delete)
#    — encoded in backup-iam.tf.stub copied above

# 4. Deploy Cloud Scheduler export jobs (prints commands; review before executing with --apply)
bash infra/firebase/backup/gcloud/export-schedule.stub.sh          # dry-run / print-only
bash infra/firebase/backup/gcloud/export-schedule.stub.sh --apply  # human-confirmed execution

# 5. Quarterly restore drill — staging-only credentials, no prod secrets
bash scripts/backup-restore/staging-restore.stub.sh \
  gs://black-book-efaaf-firestore-backups/exports/weekly/<YEAR>/Week-<WW>/full/ \
  black-book-staging-restore
```

Source: `infra/firebase/backup/{README.md,export-schedule.md,retention-matrix.json,rpo-rto.md,
iam-backup-protection.md,gcloud/,terraform/}`, `docs/runbooks/backup-restore.md` (full quarterly
drill procedure — reference, don't duplicate), `docs/runbooks/recovery-rollback-rehearsal.md`.

**GAP (flag):** `infra/gcp/terraform/multi-project/firestore.tf` hardcodes
`point_in_time_recovery_enablement = "POINT_IN_TIME_RECOVERY_DISABLED"` on the named
`raw-ingest`/`curated` databases in `blackbook-internal`, with no gate variable to turn it on.
If PITR is wanted for those two databases (BB-020's RPO/RTO targets don't explicitly exclude
them), that Terraform file needs a follow-up edit — outside this document's file ownership.

**Verify:**

```bash
node scripts/backup-restore/verify-restore.mjs \
  --metadata ./drill/metadata.json --baseline-counts ./drill/baseline-counts.json \
  --baseline-hashes ./drill/baseline-hashes.json --active-pointer ./drill/active-pointer.json \
  --release ./drill/release.json
node scripts/backup-restore/verify-iam-matrix.mjs   # confirms deny-delete IAM matches design
# Manual: attempt gcloud storage rm with web-runtime@ credentials against the backup bucket -> expect 403
```

Then run the recovery rehearsal itself (BB-061):

```bash
node scripts/recovery-rehearsal/run-rehearsal.mjs --dry-run       # timing baseline before the live drill
node scripts/recovery-rehearsal/record-findings.mjs --dry-run --validate
```

Schedule the **live** quarterly drill as a standing calendar item using
`docs/runbooks/recovery-rollback-rehearsal.md`'s one-developer checklist, executed against
`blackbook-staging` credentials only, never `github-deploy`.

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 9. Admin: Cloud Run + IAP, admin Google group, MFA policy verification

**Traces to:** BB-027 (close note: *"Human steps: provision LB/IAP and restricted accessor group,
configure exact IAP JWT audience, enable Firebase MFA and enroll admins, bootstrap first admin
claim via audited Admin SDK path, configure alert sink. No live GCP apply."*), corrected by
BB-078/ADR-012 (direct-attach Cloud Run IAP, not the external-LB pattern BB-027 originally
assumed).

**Why:** Layered IAP-JWT + Firebase-MFA server authorization is fully implemented and tested
(16 focused tests). What's missing is entirely console/IAM: the admin Cloud Run service doesn't
exist behind IAP yet, no administrator access group is provisioned, and Firebase MFA hasn't been
enabled or enrolled.

**Use the BB-078 migration runbook's steps 11–12 as authoritative** (direct-attach IAP on Cloud
Run, no load balancer) — do not follow `infra/gcp/iap/README.md`'s "Human provisioning steps"
literally; that document still describes the superseded external-HTTPS-LB + serverless-NEG
pattern and was explicitly flagged by BB-078 as needing a rewrite before this step is executed for
real (see "Gaps found during consolidation" below).

**Commands:**

```bash
# 1. Deploy the admin Cloud Run service into blackbook-internal (assumes section 4's admin-app SA exists)
gcloud run deploy black-book-admin --project=blackbook-internal --region=us-central1 \
  --service-account=admin-app@blackbook-internal.iam.gserviceaccount.com \
  --no-allow-unauthenticated

# 2. Attach IAP directly to the Cloud Run service (no load balancer — verify exact flag/console
#    step against current GCP docs at execution time; direct-attach Cloud Run IAP is a newer
#    surface than infra/gcp/iap/README.md's design)
gcloud run services update black-book-admin --project=blackbook-internal --region=us-central1 --iap

# 3. Remove any public invoker grants
gcloud run services remove-iam-policy-binding black-book-admin --project=blackbook-internal \
  --region=us-central1 --member=allUsers --role=roles/run.invoker

# 4. Create the administrator access Google group, then grant IAP access only to it
gcloud iap web add-iam-policy-binding --project=blackbook-internal \
  --member="group:admin-team@<domain>" --role="roles/iap.httpsResourceAccessor"

# 5. Enable Firebase Authentication MFA (console: Authentication -> Sign-in method -> Multi-factor);
#    enroll every administrator before granting any admin claim

# 6. Bootstrap the first administrator claim via a reviewed, audited Admin SDK operation
#    (docs/security/admin-identity.md "Human console steps" #3 — no shortcut script exists;
#    write and review the one-off script at execution time, do not leave standing tooling for it)

# 7. Configure the admin alert sink (login failure, new-device, revocation, role-change events)
#    per docs/security/admin-identity.md's alert contract section
```

Source: `docs/runbooks/production-environment-resplit-migration.md` (steps 11–12),
`docs/security/admin-identity.md` ("Human console steps" 1–5), `infra/gcp/iap/{README.md,
admin-iap-policy.json}` (design reference only — pattern is stale, see gap note).

**Verify:**

```bash
node --test infra/gcp/iap/admin-iap-policy.test.mjs   # local policy-shape acceptance (pre-apply)
# Manual negative tests per docs/security/admin-identity.md #4:
#  - allowed IAP user, no Firebase role -> denied
#  - Firebase admin outside IAP group -> denied
#  - non-MFA token -> denied
#  - stale/expired authentication -> denied
#  - revoked token -> denied
curl -I https://black-book-admin-<hash>.run.app/   # expect IAP redirect/401, never a direct 200
```

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## 10. Telemetry: alert policies, dashboards, verify security events flow

**Traces to:** BB-034 (close note: *"Design-only GCP stubs; no live apply"*).

**Why:** The alert-policy catalog, dashboard panel definitions, and their JSON Schemas are
complete and locally tested, but nothing has been imported into Cloud Monitoring, so no security
event has ever actually paged anyone.

**Commands:**

```bash
# 1. Import alert policies (one gcloud call per policy object in the catalog, or a scripted loop)
gcloud alpha monitoring policies create --project=black-book-efaaf \
  --policy-from-file=<(node -e "
    const policies = require('./infra/gcp/observability/security-alerts/security-alert-policies.json');
    console.log(JSON.stringify(policies.alerts[0]));  // repeat per catalog entry, or script the loop
  ")

# 2. Create the dashboard from the panel definitions
gcloud monitoring dashboards create --project=black-book-efaaf \
  --config-from-file=infra/gcp/observability/security-alerts/security-dashboard.json

# 3. Wire notification channels
gcloud beta monitoring channels create --project=black-book-efaaf \
  --display-name="security-alerts-slack" --type=slack --channel-labels=channel_name=#security-alerts
# repeat for the pager rotation channel

# 4. Confirm immediate-notification policies (SEC-ADMIN-01, SEC-PUB-01, SEC-RET-01, SEC-DB-02) route to pager
```

Source: `infra/gcp/observability/security-alerts/{security-alert-policies.json,
security-dashboard.json,README.md}`, `packages/observability/src/security-{anomaly,alerts,
metrics}.ts` (TypeScript source of truth for rule content — the JSON is its Monitoring-facing
projection). Note: the exact `gcloud alpha monitoring policies create` invocation above is
illustrative — the JSON catalog is a custom schema (name/runbook/notification metadata), not a
literal Cloud Monitoring `AlertPolicy` resource per-entry; a human should either write a small
import script that maps catalog entries to `AlertPolicy` bodies, or hand-create each policy in
Cloud Console using the catalog as the spec. The repo's own apply checklist (`README.md` step 1)
says "Import alert policies... into project black-book-efaaf" without a literal command either —
treat this as the one section where the exact CLI syntax needs to be worked out at execution time.

**Verify:**

```bash
node infra/gcp/observability/security-alerts/security-alerts.test.mjs   # local invariants, pre-apply
gcloud monitoring policies list --project=black-book-efaaf --filter='displayName:SEC-'
```

Run synthetic metric injection from `@black-book/observability`'s test suite in staging to confirm
an actual alert fires and reaches the configured channel; spot-check that no App Check token
appears in any log-based metric (redaction check, per the BB-034 sign-off list).

**Status: DEFERRED — requires live cloud/account action outside this session's authority.**

---

## Gaps found during consolidation

Gaps **1–4** below were reconciled by `black-book-2ve` (Terraform + Firebase artifacts validated;
no live cloud apply). Gaps **5–7** remain open before those sections are applied for real.

1. **Service-account topology conflict (section 4) — RESOLVED (`black-book-2ve`).**
   Single-project `locals.tf` no longer lists the four ADR-012-relocated identities; multi-project
   README documents the split.

2. **`private-evidence` bucket location (section 4) — RESOLVED (`black-book-2ve`).**
   Bucket lives in multi-project as `blackbook-internal-private-evidence`; removed from the
   single-project stub; isolation matrix updated. Migrate any legacy prod bucket objects before
   decommissioning.

3. **Named-database rules/indexes deploy target (section 3) — RESOLVED (`black-book-2ve`).**
   `firebase.json` targets `raw-ingest` and `curated` with rules + indexes files.

4. **Named-database PITR gate (section 8) — RESOLVED (`black-book-2ve`).**
   `internal_firestore_pitr_enabled` (default `false`) gates PITR consistently with other
   multi-project switches. Enable in tfvars after cost/RPO review.

5. **`infra/gcp/iap/README.md` describes a superseded IAP pattern (affects section 9).** Already
   flagged by BB-078 itself as a "Known follow-up, not fixed by this runbook" — the document still
   assumes an external-HTTPS-load-balancer + serverless-NEG IAP integration. ADR-012 uses IAP
   attached directly to the Cloud Run service (no load balancer). Section 9 above routes around
   this by following the migration runbook's steps 11–12 instead, but the IAP directory itself
   still needs its own rewrite pass before a human treats it as the primary reference.

6. **No Memorystore/Redis artifact exists anywhere (affects section 7).** Every other section in
   this checklist traces its commands back to a Terraform stub, `gcloud` script, or design doc
   already in the repo. The rate-limit backing store has none — `docs/security/rate-limits.md`'s
   one sentence ("swap the store interface for Redis/Memorystore") is the entire specification.
   Section 7's commands are inferred, not sourced, and should be treated as a starting point for
   review rather than a vetted plan.

7. **`workers/submissions-puller` is granted but unimplemented.** BB-078's own close notes already
   flagged this (not a new finding here, repeated for completeness): the cross-project IAM grant
   for `submissions-puller` (section 4) exists, but the Firestore-pull logic it's meant to run has
   no implementation anywhere in `workers/`. Applying the IAM grant in section 4 is safe (it's a
   least-privilege read grant with no consumer yet), but the puller itself needs a separate
   implementation bead before submissions actually flow from `blackbook-prod` to
   `blackbook-internal`.

## Evidence recording

Each section above ends with a `Status:` line reading `DEFERRED — requires live cloud/account
action outside this session's authority.` That is the correct, expected state of every roster item
at the close of this bead — BB-079's acceptance criterion is binary per line item ("applied +
verified + evidenced, OR explicitly deferred with reason"), and every line item here is the latter.
When `bd update black-book-bb079` records this, each of the ten status lines above can be copied
verbatim as that item's evidence-trail entry; the reason is identical for all ten
("requires live cloud/account action outside this session's authority") per this bead's explicit
safety boundary.

## References

- [`production-environment-resplit-migration.md`](./production-environment-resplit-migration.md) — BB-078's 19-step topology migration (sections 3, 4, 9 reference its steps rather than duplicating them)
- [ADR-012](../adr/ADR-012-production-environment-resplit.md) — the topology every section here targets
- [`docs/security/environment-isolation.md`](../security/environment-isolation.md) — "Verified live vs. designed" table, current as of this checklist
- [`infra/gcp/isolation-matrix.json`](../../infra/gcp/isolation-matrix.json) — machine source of truth for the cross-project grant list referenced in gap #2
- [`recovery-rollback-rehearsal.md`](./recovery-rollback-rehearsal.md), [`backup-restore.md`](./backup-restore.md), [`incident-response.md`](./incident-response.md) — operational runbooks referenced by sections 8–9
