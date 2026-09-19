# Production release

Public web and staff administration share the `apps/web` Vercel deployment. Merging to the
configured production branch (`main`) can immediately build and activate that commit through
Vercel Git integration. There is no separate repository-controlled promotion step. A feature PR
into `staging` is separate from the deliberate `staging` to `main` release PR.

## Current release boundary

The coordinated release remains under maintenance. Production has the signed Dunbar replacement
release and the authorized database migration is complete: all 14 pending files advanced the
ledger from 61 to 75 versions, the ten `bb_*` responsibility schemas were replaced by the current
namespaces, and staff metadata moved to `app_role`. The previously tested web/API clients are
deployed from SHA `e0a6faf07393f79aeab0629b6b9ac2952d421d6a`; follow-up static-nonce hydration
fixes are not deployed. The API deployment
`dpl_693wvmnFYhFzVNgnWWo1AAg6Q6or` is READY against production Postgres; the web deployment
`dpl_6RrpCJX853CKcUR7VfP9ctHV4JjU` is READY with maintenance still ON. The matched recovery
proved RPO 0 and RTO 14,400 seconds.

The frozen cutoff is `2026-09-19T04:43:09.299Z`, with recovery completed at
`2026-09-19T05:07:26.655Z` in 1,457.356 seconds. Web maintenance remains active; Preview database
credentials are removed; direct deployment URLs require SSO. Both Vercel cron
lists are empty and the four scheduled GitHub workflows are disabled. The final transaction check
found no active or idle-in-transaction client and no prepared transaction. Live execution details
and private recovery locations are retained in the owner-only cutover record. The
[framework audit](../research/framework-audit.md) records the sanitized evidence.

Two isolated database paths have been exercised with the final migration files:

- A clean Supabase-managed database accepted all 75 migration files in one uninterrupted replay.
- A restored production application dump matched 133 source tables, 412,140 rows and all stored
  table hashes before upgrade. `supabase db push --include-all` advanced its 61-row ledger to 75
  rows. All original table counts remained unchanged and all 132 comparable common-column hashes
  matched. The only shape that could not be compared column-for-column was the empty
  `model_invocations` table. Six tables were added and 14 source-linked capture origins were
  backfilled; 55 captures without a source-item relationship were left uninferred.

This is historical evidence for the checked-in clean and restored-data migration paths. The application dump
did not contain Auth, Storage metadata, provider Auth settings or database roles, so it is not a
complete recovery set. A later authorized private Auth/Storage snapshot was also restored:
170 tables and 421,166 rows matched, including one staff Auth identity, 301 Storage metadata rows and
61 migrations. Queried grants, RLS/policies and role memberships matched, and five access probes
passed. A matching-version local Auth API also verified the restored staff identity/role, token
issuance, authenticated user lookup and session revocation. See the [audit evidence](../research/framework-audit.md) for exact scope and commands.
These component proofs did not establish a matched-cutoff Storage/application restore, approved
recovery time, production credentials, PostgREST cache convergence or a production cutover. The
later owner-only matched recovery and postcutover verifier closed those gates. The verifier found
the `20260918154322` frontier, 10 current and zero old responsibility schemas, 11 expected
generated columns, zero invalid constraints, PostgREST `public,published,submissions`, one admin
`app_role` and zero `bb_role`, exact mapped counts/full-row hashes for 133 original tables and
424,903 rows, 14 new capture origins, five other new tables, and passing anonymous and privileged
function denials. The deployed client canary passed four API claims/citations checks and HTTP 200
checks for `/`, `/records`, `/explore`, the place surface and the login route. Anonymous admin
checks returned 401/307 and fresh Auth release checks returned 200. The fresh JWT carried
`app_role=admin` with no `bb_role`; current-user lookup matched that role, and read-only SQL role
probes denied missing and `bb_role`-only claims while admitting the `app_role` admin claim. The
browser `/admin/login` UI still renders “Loading sign-in”. Local follow-up fixes pass theme and
headline browser checks, but are not deployed; local credential-flow validation is unavailable
without `NEXT_PUBLIC_SUPABASE_URL` and the anon key. Login UI verification and reopening remain
pending.

## Release prerequisites

1. Review the complete diff, current [architecture](../architecture.md), migration history and the
   exact commit to release. Do not treat an old ADR, preview, dry run or local restore as release
   approval.
2. Run `fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging` on the final tree. For
   this database change, retain the successful clean-chain, restored-data upgrade, SQL
   authorization and public/admin surface evidence with the release record.
3. Set an approved RPO and RTO. Any target written before a complete timed restore is proposed and
   unmeasured. Complete the executed-restore evidence required by
   [backup and recovery](./backup-restore.md). The application-dump rehearsal does not establish a
   production failover target.
4. Create and verify one matched pre-cutover recovery set:
   - either a provider-supported database/Auth recovery point or a freeze-time logical bundle that
     includes application schemas, `auth`, `storage`, migration history, required roles and grants,
     and a sanitized provider Auth configuration inventory;
   - an export of `supabase_migrations.schema_migrations`, table counts and stable table hashes;
   - a sanitized staff-role inventory sufficient to verify `app_metadata.bb_role` before cutover;
     keep tokens and application secrets out of that inventory and the shared execution log;
     the separate full Auth recovery dump requires owner-only protection;
   - complete inventories and recoverable copies of every required `raw-sources` and
     `public-media` object, with downloaded-byte hashes, access-policy checks and readback from an
     isolated destination;
   - the old application, API and worker build identities that match that database and auth state.

   A paid provider clone is optional only after the complete logical bundle has restored into an
   isolated Supabase environment and met the approved RPO/RTO with Auth users, role metadata, RLS,
   Storage references and application surfaces intact. The existing application dump does not meet
   that bar. A database hash is not an object checksum. The audit verified all 58 referenced raw objects,
   and all 228 available media objects referenced by release projections (457,165,770 bytes),
   with local readback and access checks. One further referenced Dunbar school image is absent
   from Supabase, and an authenticated object describe returns `404` at its old GCS location.
   The signed replacement `rel_20260918_dunbar_media_correction_001` removes that current reference
   and preserves the original signed release as superseded history. A required-object inventory
   must include both replacement release artifacts and explicitly report the unavailable historical
   reference. A historical missing object is not recovered by removing its current reference. The remaining
   unreferenced objects in the 242-object bucket were not restored.
5. Confirm that Preview database credentials are removed or point to an isolated destination.
   Visibility of masked variables does not prove they differ from Production credentials.
6. Confirm that the release operator can access Supabase, Vercel and every deployed API or worker
   surface with uncompromised administrator identities. Verify the production branch, domains,
   environment targets and current providers rather than inferring them from repository files.
7. Prepare one sanitized execution log that records the tested commit, backup identifiers and
   hashes, migration plan, deployed build identities, operators, start/end times and every failed
   or uncertain command. Keep credentials out of commands, logs and bundles.

### Repair immutable release data

Do not update an active release row in place. Create a replacement release from the active release,
apply the approved canonical correction, and carry the release ID consistently through entity
projections, search document IDs/facets, articles and their content hashes, redirects, graph rows,
legal snapshots and theme packets. `evidence.published_citations` is derived from the active
release and must not be inserted into directly.

Before activation, verify equal row counts, compare every projection after excluding release
metadata and the approved field change, and prove the source release hashes are unchanged. Build
the replacement entity and search artifacts at their new release paths, verify zero forbidden
references, upload and read them back, then build and sign the release manifest with
`buildReleaseManifest` and `signReleaseManifest` from `@repo/domain`. Verify it with
`verifySignedReleaseManifest`; never put a placeholder signature into production.

Activate through the database's authorized publisher gate, not a raw
`published.active_release` update: call `bb_publication.activate_release(release_id)` before the
namespace cutover or `publication.activate_release(release_id)` afterward. This gate records the
audit event and rejects research identities. A reviewed one-time operator script may connect these
existing primitives; a new reusable publishing service is not required for this correction. Load
an ECDSA private key and nonempty key ID from the configured secret store, and retain the matching
public key for verification. The repository currently defines no production release-signing env
name; the current key registry is held privately with its 1Password item references. Record the
selected secret reference, key ID and public verifier before the window without logging private
key material. Purge the release cache and verify the live
database views, artifacts and public surface. Preserve the old release for rollback.

## Coordinated cutover

### 1. Enter maintenance and freeze writes

1. Enable the production web wall using [maintenance mode](./maintenance-mode.md), redeploy and
   verify `503` from a browser without the bypass cookie on `/`, `/robots.txt`, a record URL,
   `/submit/api` and `/admin`. The web proxy is the write boundary for all `apps/web` routes. Keep
   an operator browser on the maintenance bypass for later checks, but do not use it for staff
   writes during the freeze.
2. The web wall does not cover `apps/api-public`, mobile, scheduled jobs or manual operators. Put
   the public API in its seed/fail-closed data mode and verify it opens no application database
   session. Pause publication and stop every research, ingestion, enrichment, preservation and
   release writer at its deployed provider. Re-check GitHub, Vercel, database and any other
   configured scheduler immediately before the window; the 2026-09-18 no-schedule audit is not a
   permanent guarantee.
3. Confirm that no old application, worker or operator process can open a write transaction. Record
   the freeze time and the final database/auth/storage cutoff. Do not proceed while writes can race
   the snapshot or namespace rename.

### 2. Capture the final recovery point

1. Take the matched database/auth recovery point and final storage inventory after the write
   freeze. Preserve the migration ledger, row-count manifest, stable table hashes, object-byte
   hashes and provider backup identifiers.
2. Restore the recovery point to an isolated destination and verify the approved RPO/RTO,
   constraints, indexes, functions, RLS, staff role claims, public projections and required storage
   objects. A schema-only reset is not sufficient.
3. Stop the release if database, auth or storage evidence is incomplete. Do not accept metadata,
   a URL, a historical Wayback pointer or one media sample as proof that current object bytes are
   recoverable.

### 3. Inspect the exact migration plan

Load the production database URL through the approved secret mount or runner without printing it.
Run the CLI with Node 22:

```bash
fnm exec --using=22 -- pnpm exec supabase db push \
  --dry-run \
  --include-all \
  --db-url "$SUPABASE_DB_URL" \
  --yes
```

`--include-all` is mandatory for this upgrade. The bootstrap version
`20260720220000_fresh_install_prerequisites.sql` sorts before production's current migration
frontier. The default push correctly refuses it. On the audited 61-row production history, the
reviewed plan contains that no-op bootstrap plus the thirteen migrations from
`20260918041932_reviewed_claim_assessment_integrity.sql` through
`20260918154322_reconcile_unrecorded_public_projection_schema.sql`.

Stop if the live ledger, schema state or plan differs. Rebuild the isolated rehearsal from the new
frozen snapshot before changing production. Do not use migration-history repair, rename an applied
version, or edit historical SQL to force the plan through. The bootstrap refuses partial or mixed
old/current namespace states, and the projection migration refuses mixed or unexpected generated
columns.

Before applying, confirm that no staff user has conflicting old and new role metadata. The cutover
migration also fails closed on this condition:

```sql
SELECT id
FROM auth.users
WHERE raw_app_meta_data ? 'bb_role'
  AND raw_app_meta_data ? 'app_role'
  AND raw_app_meta_data->'bb_role' IS DISTINCT FROM raw_app_meta_data->'app_role';
```

Resolve any returned identity through the approved auth administration process, refresh the
recovery point, and rehearse again.

### 4. Apply the database cutover

With maintenance and the write freeze still active, run the same reviewed plan without
`--dry-run`:

```bash
fnm exec --using=22 -- pnpm exec supabase db push \
  --include-all \
  --db-url "$SUPABASE_DB_URL" \
  --yes
```

Do not automatically retry a timeout or uncertain result. Read the remote migration ledger and
schema state first. The CLI applies multiple migration files, so an error can leave a valid partial
advance that requires a new diagnosis rather than a blind rerun.

The namespace migration makes one compatibility-free transition:

- `bb_auth`, `bb_audit`, `bb_canonical`, `bb_evidence`, `bb_ops`, `bb_public`,
  `bb_publication`, `bb_reference`, `bb_research` and `bb_submissions` become
  `access_control`, `audit`, `canonical`, `evidence`, `ops`, `published`, `publication`,
  `reference`, `research` and `submissions`.
- Staff metadata moves from `app_metadata.bb_role` to `app_metadata.app_role`. Existing JWTs do
  not acquire the new claim until they are refreshed or replaced.
- PostgREST's `authenticator` schema list becomes `public,published,submissions`; the migration
  sends both config and schema-cache reload notifications.

No compatibility aliases or dual writes exist. Keep every old client stopped until the matching
application and service revision is active.

### 5. Activate matching clients and auth

1. Merge the reviewed `staging` to `main` release PR only inside the maintenance window. Vercel may
   activate the resulting `apps/web` build immediately. Deploy the same tested commit to every
   separately hosted API and worker surface before allowing traffic or work.
2. Confirm the active build identities rather than relying on an HTTP header alone. Do not use a
   Preview with different database credentials as production evidence.
3. Obtain a refreshed or newly signed-in staff session and verify its JWT contains trusted
   `app_metadata.app_role`. Web pages and admin APIs call Auth `getUser` and require the current
   server-returned `app_role`; they do not authorize from a retired JWT claim. An unexpired older
   token can therefore authenticate a user whose current Auth record has the required role.
   PostgREST/RPC authorization instead reads the JWT payload: a token containing only `bb_role`
   must have no staff authority there. Test both boundaries. Session revocation prevents refresh
   but does not guarantee immediate access-token invalidation; use the
   [account-compromise procedure](incidents/account-compromise.md) when forced invalidation is required.
4. Verify that PostgREST exposes only `public`, `published` and `submissions`, resolves the new
   views, and rejects old schema names. If its config or schema cache is stale, use the
   provider-supported reload or restart and keep traffic frozen. Do not recreate `bb_*` aliases to
   mask a stale cache.

### 6. Verify before reopening

Record each result against the frozen baseline:

1. The migration ledger has 75 distinct versions, preserves the deployed NULL name at
   `20260908120000`, and ends at `20260918154322`.
2. All ten current responsibility schemas exist, no `bb_*` responsibility schema remains, all
   eleven projection-derived columns have the expected stored-generated expressions, and no
   application constraint is unvalidated.
3. Every original table remains. Counts and stable hashes over the original columns match the
   frozen manifest except for an explicitly reviewed transformation. New capture origins correspond
   only to existing source-item relationships; captures without one remain uninferred.
4. Database and Storage references still resolve. Required private objects remain private, public
   media delivers through its intended path, and byte hashes match the recovery inventory.
5. Through the maintenance bypass, exercise the home page, records, map, a cited record, a missing
   record, staff login, an unauthorized staff request, source links and the separately hosted
   public API. Verify light and dark themes and inspect runtime/PostgREST errors.
6. A refreshed staff JWT carries the expected `app_role`. Web/admin authorization rejects a
   current Auth user record with a missing or invalid role; database authorization rejects missing
   or retired JWT role claims. Anonymous, public-reader and research-worker denials still hold.
7. A second `supabase db push --dry-run --include-all` reports the database up to date.

Only the named release decision-maker may end the window. Re-enable services in a controlled order:
read-only public API, public web/mobile traffic, submissions, then staff and background writers.
Remove maintenance last, after canary reads and writes remain observable. Record the final state and
retain the recovery point until the replacement backup is independently verified.

## Rollback

The strongest failure mode is a split contract: old code reads `bb_*` and `bb_role`, while the new
database exposes current schemas and `app_role`. Rolling back only Vercel, an API, the database or
auth would create that split. There are no down migrations, aliases or dual-write bridge.

Prefer fixing forward while maintenance and the write freeze remain active when the migrated
database is intact. If rollback is required, keep all traffic and writers frozen and restore a
matched pre-cutover set:

1. Restore the old database and auth recovery point to an isolated destination. It must contain the
   old `bb_*` schemas, matching 61-row migration ledger and `app_metadata.bb_role` state.
2. Restore or verify the corresponding Storage objects and references. Do not point the old database
   at an unmatched object inventory.
3. Verify counts, hashes, constraints, RLS, role claims, public projections and required object
   bytes before routing anything to it.
4. Cut over the restored database/auth state and the recorded old web, API and worker builds as one
   operation. Restore the matching PostgREST schema configuration and reload its cache. Refresh
   staff sessions again so tokens match the restored role claim.
5. Exercise the same public, staff, API and denial checks before reopening reads and then writes.

Application rollback alone does not undo schema or data changes. Git revert alone cannot recover
database, auth or Storage state. Never restore directly over the only production copy, and never
discard either recovery point until the replacement has passed the full verification set.

Keep the sanitized execution log, deployed commit, migration ledger, manifests, backup identifiers
and release/rollback decision together. If any command has an uncertain outcome, leave maintenance
and the write freeze in place and inspect the resulting state before taking another action.
