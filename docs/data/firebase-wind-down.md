# Firebase wind-down checklist (owner)

After Postgres cutover, **do not delete** production Firebase project `black-book-efaaf` or its data without dual verification + a verified export. Prefer pause/archive with Firestore left read-only or unused.

## Already done in-repo (agents)

- [x] Structured data migrated to Supabase `blackstory-app` (ETL package + apply runs)
- [x] Public web can use `PUBLIC_DATA_SOURCE=postgres` + server-only `DATABASE_URL`
- [x] Admin desks use Postgres exclusively; legacy backend selection fails closed
- [x] Operator-cli / quick-add / evidence commits use the Postgres-only `createLiveAtomicStoreFromEnv`
- [x] Discovery kill switches use `bb_ops.kill_switches`; the retired scheduler has no live fallback
- [x] Blobs: Supabase Storage buckets `public-media` (public) + `raw-sources` (private) created; GCS remains dual-serve origin until copy + soak complete (see `docs/data/supabase-storage-cutover.md`)
- [x] Public-media byte copy GCS → Supabase (`public-media` bucket; GCS retained for dual-serve)
- [ ] Raw-sources byte copy (phase 2)
- [x] Flip writers / collage hardcodes / release primary_image URLs to Supabase (GCS upload bucket retained for Admin SDK dual-serve)
- [x] Pending schema: PostgREST published views + jurisdictions.location applied on `blackstory-app`
- [x] Supabase Auth admin mode: `ADMIN_AUTH_MODE=supabase` + `NEXT_PUBLIC_ADMIN_AUTH_MODE=supabase` with `app_metadata.bb_role`
- [x] Supabase Auth admin user exists with `app_metadata.bb_role=admin`
- [x] Data API schemas limited to `public`, `bb_public`, `bb_submissions` (`supabase/config.toml`)
- [x] **App Hosting cutover (2026-07-21):** Secret Manager `admin-database-url`, `admin-supabase-anon-key`; `apphosting.admin.yaml` set postgres + supabase auth for admin backend
- [ ] Supabase advisors: **Leaked password protection** still WARN — enable in Dashboard (Management API PATCH returned 403 with available PAT)
- [x] Scheduled Cloud Functions runtime retired; Corsair/systemd is the recurring scheduler (ADR-028)
- [x] **Public web DNS on Vercel** (hard-cut 2026-07-22, ADR-027); public web App Hosting configs **retired in-repo** — Vercel is sole public host
- [x] **Public web App Hosting backends deleted (2026-07-22):** `black-book-web-production` and `black-book-web-staging` removed from Firebase
- [x] **Admin re-targeted to Vercel (2026-07-25):** `apphosting.admin.yaml`, `apps/admin/Dockerfile`, `docs/runbooks/admin-cloud-run.md`, and `scripts/apphosting-build.mjs` deleted. Admin is a standalone Vercel project (own `apps/admin/vercel.json`) deployed from git. Credential isolation is the reason it stays separate: its write-capable `DATABASE_URL` lives in admin's own Vercel project env, never in the anonymous public site's runtime.
- [x] **Discovery Cloud Functions + Scheduler deleted (2026-08-15):** 5 Gen2 functions and 5 Cloud Scheduler jobs removed from `black-book-efaaf`. GitHub Actions (`discovery-campaigns.yml`, ADR-028) is the sole scheduler. `gcloud functions list` / `gcloud scheduler jobs list` / `gcloud run services list` are empty.
- [x] **Admin App Hosting + Cloud Run deleted (2026-08-15):** Firebase backend `black-book-admin-production` and Cloud Run service of the same name removed. Do not recreate them.
- [ ] Public web request-integrity / remaining Firebase-client surfaces (distinct from hosting choice)
- [x] Mobile + api-public: Firebase App Check retired from the request path (unused, code still present); direct API callers use `X-BlackStory-Client`; Postgres is the default read path (`PUBLIC_DATA_SOURCE=postgres`)
- [x] Structured SoR is Postgres (ADR-020); Firestore has no live database, rules, or indexes left — repo-side config is fully removed, not just "export/rollback only"
- [x] **`repo-348e.8` (in-repo config removal):** `functions/` (5 Cloud Functions v2 schedules) and `firebase.discovery.json` deleted — the GitHub Actions cron (`discovery-campaigns.yml`, ADR-028) is the sole scheduler now. `.firebaserc` and `infra/firebase/{firebase*.json,firestore*.rules,firestore*.indexes.json,storage.rules}` deleted (no deploy target, no rules/indexes left to deploy). `integration-firebase` CI job and the `migrate-firestore` dry-run jobs in `deploy-staging.yml`/`deploy-production.yml` removed. `packages/firebase/src/rules.integration.test.ts` and `packages/testing`'s Firebase emulator harness deleted (nothing left to test rules against). `@firebase/rules-unit-testing` dropped from `packages/firebase`.
- [x] **`apphosting.admin.yaml` deleted (2026-07-25).** Admin is the standalone Vercel project `apps/admin`. Firebase App Hosting backend `black-book-admin-production` was deleted 2026-08-15.
- [x] `infra/firebase/` retained: `backup/` (Firestore export/restore DR docs + stubs, still referenced by `docs/runbooks/backup-restore.md` and the recovery-rehearsal scripts), `auth-and-app-check.md`, `FIRESTORE_MODEL.md`, `iam-minimal.md`, `registered-apps.json`, `README.md` — reference/history material and backup tooling, not deploy config, and out of `repo-348e.8`'s explicit scope
- [x] `@repo/firebase` (`packages/firebase`) keeps its `firebase`/`firebase-admin` dependencies: still imported for real by `apps/api-public` and `apps/api-submissions` (App Check helper types, `AppCheckCircuitBreaker`, embedding utilities) even though App Check enforcement itself is retired — deleting the dependency would break the build, not just remove dead code
### Owner: enable leaked password protection (HaveIBeenPwned)

1. Open [Auth Providers → Email](https://supabase.com/dashboard/project/twykhihqkcldpreuovay/auth/providers?provider=Email) for project `twykhihqkcldpreuovay`
2. Under **Password** / security settings, toggle **Prevent use of leaked passwords** (HaveIBeenPwned) **on**
3. Save
4. Confirm advisors no longer list `auth_leaked_password_protection` (Security advisors in Dashboard, or MCP `get_advisors` type `security`)

Requires Pro plan entitlement for HIBP. Docs: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Owner console steps (human)

1. **Export backups (required before any destructive action)**
   - Firestore: managed export to a dedicated GCS bucket; record export path + date
   - Confirm GCS public-media + private buckets are still needed (blobs stay)
   - Export Auth users if any remain on Firebase Auth
2. **Verify app no longer requires Firestore for structured SoR**
   - Production env: Postgres public/admin sources and working scoped database URLs
   - Admin auth: `ADMIN_AUTH_MODE=supabase` + provisioned operator with `app_metadata.bb_role=admin`
   - Smoke: home, entity page, search, `/data` demographics, admin research list/transition, quick-add commit
   - Confirm admin writes target Postgres (do not leave silent dual-truth)
3. **Tighten Firebase**
   - Set Firestore rules to deny all client access (keep Admin SDK only if a rollback window is needed)
   - Disable unused Firebase Auth providers for public users if applicable
   - Remove App Hosting / Cloud Functions triggers that write product SoR to Firestore
4. **Pause / archive (preferred over delete)**
   - Disable billing-heavy services you no longer need (functions, unused hosting backends)
   - Leave project intact through a rollback window (suggest ≥30 days after green prod)
5. **Only after dual verification + export OK**
   - Second person confirms export restore test
   - Then optionally delete Firestore database / retire project — **not** an agent action

## Remaining legacy scope (not an approved runtime fallback)

- GCS/blob objects pending an explicit storage decision
- Firestore migration, export, and reconciliation utilities retained only for bounded history/data transfer
- Public web readers and App Check paths awaiting their Firebase-free replacement
- Legacy national-catalog/demographic utilities under `packages/firebase/scripts`; they are not scheduled runtime entry points

## Recovery

- Do not flip admin/operator/scheduled workers back to Firestore. Restore Postgres from verified backups or pause the affected surface.
- Firestore exports and prior release artifacts remain offline recovery evidence until the owner completes the archive window.
