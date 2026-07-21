# Firebase wind-down checklist (owner)

After Postgres cutover, **do not delete** production Firebase project `black-book-efaaf` or its data without dual verification + a verified export. Prefer pause/archive with Firestore left read-only or unused.

## Already done in-repo (agents)

- [x] Structured data migrated to Supabase `blackstory-app` (ETL package + apply runs)
- [x] Public web can use `PUBLIC_DATA_SOURCE=postgres` + server-only `DATABASE_URL`
- [x] Admin desks feature-flagged via `ADMIN_DATA_SOURCE` (defaults to postgres when `DATABASE_URL` / `APP_DATABASE_URL` is set)
- [x] Operator-cli / quick-add / evidence commits use `createLiveAtomicStoreFromEnv` (Postgres AtomicStore when ops source is postgres)
- [x] Discovery kill-switch resolver reads `bb_ops.kill_switches` in postgres mode (env override still wins)
- [x] Blobs intentionally remain in GCS / Firebase Storage (Postgres holds refs only)
- [x] Supabase Auth admin mode: `ADMIN_AUTH_MODE=supabase` + `NEXT_PUBLIC_ADMIN_AUTH_MODE=supabase` with `app_metadata.bb_role`
- [x] Supabase Auth admin user exists with `app_metadata.bb_role=admin`
- [x] Data API schemas limited to `public`, `bb_public`, `bb_submissions` (`supabase/config.toml`)
- [x] **App Hosting cutover (2026-07-21):** Secret Manager `web-database-url`, `admin-database-url`, `admin-supabase-anon-key`; root `apphosting.yaml` / `apphosting.staging.yaml` / `apphosting.admin.yaml` set postgres + supabase auth; staging backend Environment name=`staging`
- [ ] Supabase advisors: **Leaked password protection** still WARN — enable in Dashboard (Management API PATCH returned 403 with available PAT)
- [ ] Cloud Functions discovery ops postgres env (follow-up bead `repo-wehm`)

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
   - Production env: `PUBLIC_DATA_SOURCE=postgres`, `ADMIN_DATA_SOURCE=postgres`, working `DATABASE_URL`
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

## Still Firestore-dependent (intentional / rollback)

- Firebase Storage / GCS blobs
- Optional `ADMIN_DATA_SOURCE=firestore` / `OPS_DATA_SOURCE=firestore` rollback flag
- Optional `--catalog-from=firestore` for editorial soft-match
- Legacy national-catalog / demographics load CLIs under `packages/firebase/scripts` (schedule cutover behind same AtomicStore)
- Firebase Auth when `ADMIN_AUTH_MODE=firebase` (default for emulator)

## Rollback

- Flip `PUBLIC_DATA_SOURCE=firestore` / `ADMIN_DATA_SOURCE=firestore` + production break-glass if Postgres reads/writes fail
- Firestore export + prior release artifacts remain the recovery path for structured data until owner retires Firebase
