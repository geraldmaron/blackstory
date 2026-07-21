# Firebase wind-down checklist (owner)

After Postgres cutover, **do not delete** production Firebase project `black-book-efaaf` or its data without dual verification + a verified export. Prefer pause/archive with Firestore left read-only or unused.

## Already done in-repo (agents)

- [x] Structured data migrated to Supabase `blackstory-app` (ETL package + apply runs)
- [x] Public web can use `PUBLIC_DATA_SOURCE=postgres` + server-only `DATABASE_URL`
- [x] Admin desks use Postgres exclusively; legacy backend selection fails closed
- [x] Operator-cli / quick-add / evidence commits use the Postgres-only `createLiveAtomicStoreFromEnv`
- [x] Discovery kill switches use `bb_ops.kill_switches`; the retired scheduler has no live fallback
- [x] Blobs: Supabase Storage buckets `public-media` (public) + `raw-sources` (private) created; GCS remains dual-serve origin until copy + soak complete (see `docs/data/supabase-storage-cutover.md`)
- [ ] Public-media byte copy GCS → Supabase (operator: `scripts/copy-gcs-public-media-to-supabase.mjs` with service role)
- [ ] Raw-sources byte copy (phase 2)
- [ ] Flip writers / collage hardcodes / new release media URLs after soak
- [x] Pending schema: PostgREST published views + jurisdictions.location applied on `blackstory-app`
- [x] Supabase Auth admin mode: `ADMIN_AUTH_MODE=supabase` + `NEXT_PUBLIC_ADMIN_AUTH_MODE=supabase` with `app_metadata.bb_role`
- [x] Supabase Auth admin user exists with `app_metadata.bb_role=admin`
- [x] Data API schemas limited to `public`, `bb_public`, `bb_submissions` (`supabase/config.toml`)
- [x] **App Hosting cutover (2026-07-21):** Secret Manager `web-database-url`, `admin-database-url`, `admin-supabase-anon-key`; root `apphosting.yaml` / `apphosting.staging.yaml` / `apphosting.admin.yaml` set postgres + supabase auth; staging backend Environment name=`staging`
- [ ] Supabase advisors: **Leaked password protection** still WARN — enable in Dashboard (Management API PATCH returned 403 with available PAT)
- [x] Scheduled Cloud Functions runtime retired; Corsair/systemd is the recurring scheduler
- [x] **App Hosting stays on Firebase** (owner decision 2026-07-21) — public web continues on App Hosting; not part of Supabase cutover
- [ ] Public web request-integrity / remaining Firebase-client surfaces (distinct from App Hosting host choice)
- [x] Mobile + api-public: Firebase App Check retired; direct API callers use `X-BlackStory-Client`; Postgres is the default read path (`PUBLIC_DATA_SOURCE=postgres`)

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
