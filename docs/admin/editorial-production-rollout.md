# Editorial production rollout

The editorial schema is applied to production. The application release is pending promotion.
This record is updated with the observed deployment identity after activation.

## Scope and decision

The release replaces the legacy cover-only administration with the durable article workspace,
contributors, private media, exact-revision review and signed publication. Existing articles
remain canonical authoring rows; public readers continue to use active release projections.
The unfinished Women's History Month research article is not approved for publication.

The strongest failure mode is new editor code running without its schema or signing identity.
Decision: accepted with controls. Apply the additive schema first, verify unchanged article
hashes, configure Production only, then promote the tested branch. Existing immutable releases
are preserved. The old signing record is empty; the owner approved a new future-release identity.

## Private boundaries and pruning

- `/design-system` and descendants use the existing verified staff-session gate and cannot
  receive public CDN caching. File-like staff slugs cannot skip that gate.
- Draft previews and editorial media independently verify staff identity. Admin APIs retain
  operation permissions. Public article readers use released projections only.
- Removed the unused cover-editor copy after checking repository references. The legacy
  process-local cover implementation was removed in the workspace implementation.
- Removed 136 stale generated documentation files from repository `docs/`. GitHub Pages
  previously served that directory alongside operating markdown. Pages now uses Actions and
  uploads only the curated `apps/docs/out` export. The publish helper no longer copies files
  into repository `docs/`. Public methodology and contributor documentation remain curated.
- Removed the Preview target of `DATABASE_URL`. Production database credentials are not
  provisioned for preview. Deployment URLs retain Vercel SSO protection.

## Migration and recovery evidence

The remote ledger contained 89 migrations. The linked CLI dry run selected exactly
`20261015004456_editorial_workspace.sql` and `20261015032000_article_archive.sql`.
The provider reported completed physical backup 1962668990 from 2026-10-14T11:47:15.660Z,
with PITR disabled. That is existing provider recovery, not a newly rehearsed full failover.

Automatic approval review initially rejected a local article-content export. The owner then
explicitly approved a restricted recovery export. The article table and migration ledger were
exported outside Git into a mode-700 directory with a mode-600 dump. Dump SHA-256:
`bead39f66c3fff92d09c642a92259cf0f6f71cb71d8d677882497961b5877cb6`.
Recovery location remains local and is not part of the public application.

The dump restored 48 article rows into the isolated local database at the pre-editorial schema.
Both migrations then applied. Before and after original-column MD5:
`922bbf8d599cc9a4ab3ea18dd420006b`. There were 48 baseline revisions.
An initial restore selector matched no rows; it was corrected and the baseline rehearsal was
repeated before production mutation. No production article bodies were printed.

Production migration command:
`node /tmp/editorial-prod-db-runner.cjs supabase db push --linked --include-all --yes`.
The runner injects the existing migration credential through environment variables.
Observed: both migrations applied. Production now has 91 migrations, 48 original articles
with the identical original-column hash, 48 baseline revisions and a private editorial bucket.
A second linked dry run reported the remote database up to date.

Production's migration identity cannot `SET ROLE web_public`; the rolled-back SQL privacy test
therefore did not run under that identity. No fixture rows remained. Effective privilege reads
confirmed public draft reads, anonymous revision reads and authenticated staff-account mapping
reads are denied; staff article updates are granted. Local SQL role tests and integration
coverage are retained in the preceding verification records.

## Validation

```text
Check: Final repository release lanes
Command: APP_NEXT_DIST_DIR=.next-validation fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/staging
Result: pass
Observed: All ten selected lanes passed. The initial run failed only the added redirect assertion, which assumed no trailing slash; the corrected assertion and full rerun passed.
```

```text
Check: Curated documentation artifact
Command: DOCS_BASE_PATH=/blackstory fnm exec --using=22 -- pnpm --filter @repo/docs build
Result: pass
Observed: Static home, missing-page handling and the nine curated guides built. Internal repository runbooks are outside that export.
```

## Remaining release checks

Production browser CRUD, deployment identity, anonymous route denial and Pages artifact activation
are pending. The browser native upload chooser remains unproven due to extension file access;
real storage byte upload and public/private readback passed locally. Native iOS and assistive
technology sessions are outside this web/backend rollout.

## Publication execution budget

The final provider check found a default 300-second request limit and 4,210 active entities.
Preparing and reading back the full catalog may exceed that default. Article publish, archive
and rollback routes therefore declare an 800-second platform limit. The shared executor starts
no further artifact work after eight minutes, leaving time for bounded in-flight upload/readback
requests and transaction rollback. Existing failure atomicity and concurrency controls remain.
This is a bounded synchronous release operation; catalog-scale production throughput has not
been benchmarked. The alternative is a durable publication job, which remains a larger change.
Decision: accepted with controls; platform termination must not be the intended failure path.
