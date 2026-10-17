# Editorial production rollout

The editorial schema and application release are active in production, including the
navigation-cache correction found and verified during final browser validation. Validation
limits are stated below; no unfinished historical article was published.

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

## Validation limits

The browser native upload chooser remains unproven: the extension filechooser event timed out
and native control reported no available window. No browser permission was broadened. Real
production storage byte upload, authenticated readback and anonymous denial passed; the
synthetic storage fixture was removed. Native iOS and assistive technology sessions are outside
this web/backend rollout. No unfinished historical prose or synthetic fixture was published.

## Publication execution budget

The final provider check found a default 300-second request limit and 4,210 active entities.
Preparing and reading back the full catalog may exceed that default. Article publish, archive
and rollback routes therefore declare an 800-second platform limit. The shared executor starts
no further artifact work after eight minutes, leaving time for bounded in-flight upload/readback
requests and transaction rollback. Existing failure atomicity and concurrency controls remain.
This is a bounded synchronous release operation; catalog-scale production throughput has not
been benchmarked. The alternative is a durable publication job, which remains a larger change.
Decision: accepted with controls; platform termination must not be the intended failure path.

## First activation and recovery

Production PR #298 merged as `3b3a3b45a4b73fc32024e166277fc4dd5c6e7eb1`. Web build
`dpl_ALQHaQDP6q1xBJazGpZhMCZJTGtp` and API build `dpl_6WxpT33UzLSrBjxED1bgp8PPRVZ7`
became ready. The authenticated library displayed all 48 existing articles. Anonymous staff
pages redirected and APIs returned 401, including the newly protected gallery. However, the
dynamic `/records` check returned 500, and runtime logs explicitly reported missing `DATABASE_URL`.
The home page still returned 200 from cache and staff data used a separate credential.

Root cause: deleting the shared database variable's Preview target through the CLI removed the
entire entry, including Production. The web deployment was rolled back to
`dpl_31oExSwwMLSeXaQ9TK8AV2jHCqiE`; `/records` and `/stories` returned 200 again. The API
remained healthy on the new build. No article was edited, published or retracted in this failure.
The owner explicitly approved a replacement web-only login restricted to `web_public`, held
in 1Password and installed only in Production. The API and admin credentials are preserved.

Provenance run 38681357896 reported success after rollback; it therefore does **not** certify
the failed new web build. The release procedure requires matching the active provider build
identity with the runtime smoke evidence; a green health check alone is insufficient.

## Repaired activation

The owner-approved `blackstory_web_runtime` login has only the existing `web_public` membership.
Superuser, database/role creation and RLS bypass are false. Its credential is held in the native
Database item `3vvt7hah7xe5s6nclzyf5gdkvm` in the project vault, with concealed password and
connection string. Exact custody readback passed. Direct login read 48 released articles;
article-draft SELECT and canonical UPDATE were denied with PostgreSQL 42501. Preview has no
`DATABASE_URL` or `ADMIN_DATABASE_URL`. API and admin credentials were preserved.

The initial privilege probe failed on the intended denied canonical schema. Provisioning was
resumed from the existing vault item and role, without creating another identity. The corrected
probe exercised the allowed read and forbidden operations separately before installing the
Production-only sensitive variable.

Command: `vercel redeploy dpl_ALQHaQDP6q1xBJazGpZhMCZJTGtp --target production --no-wait`.
The rebuilt deployment `dpl_5uCugoj2S7ht8x65MXwEQbTrU3sF` became READY at release commit
`3b3a3b45a4b73fc32024e166277fc4dd5c6e7eb1`. The rebuilt deployment did not yet own the custom-domain alias; `vercel promote dpl_5uCugoj2S7ht8x65MXwEQbTrU3sF --yes --timeout 60s` activated it.
The provider alias API explicitly mapped `blackstory.app` to that deployment.

```text
Check: Anonymous production boundaries after repaired activation
Command: node /tmp/editorial-production-boundaries.mjs
Result: pass
Observed: Public home, records, stories, about and login returned 200; staff pages and file-like staff paths redirected to login; editorial APIs and MCP returned 401; raw internal Pages runbooks returned 404.
```

```text
Check: Production provenance and health after repaired activation
Command: gh workflow run deploy-production.yml --ref main -f commit_sha=3b3a3b45a4b73fc32024e166277fc4dd5c6e7eb1 -f prior_release_sha=d2f77b56bbe580a5486fa01288aa43d4e4cfc80e -f confirm=deploy
Result: pass
Observed: Run 38682575799 completed successfully, including required Health Check Production and E2E Smoke Production. The custom-domain mapping was independently verified. API bootstrap returned 200.
```

## Browser navigation diagnosis

Reproduction

- Command: Open a saved draft, archive it, follow Articles, select archived and reopen its row within the client cache lifetime.
- Environment: Authenticated Chrome on the new production workspace; dynamic client route cache configured for 30 seconds.
- Data: Private synthetic production-editorial-validation draft, distinct from the original 48 articles.
- Frequency: Observed once during final lifecycle validation, within the cache window.
- Observed: Library showed archived revision 5; editor navigation showed editable revision 4.
- Expected: Reopening the archived row shows read-only revision 5 and Restore to drafts.

Hypothesis: Client route snapshots survive successful article mutations.
Refuted by: A fresh reload also returning editable revision 4.
Test: Reload immediately returned archived revision 5, while client navigation had returned revision 4; read the mutation helper and existing contributor/entity router refresh patterns.
Verdict: supported. Database state and API authorization were correct; the article editor did not invalidate prefetched route snapshots after its record refresh.

Cause

- Statement: Successful article mutations refreshed local component state but left the Next.js client route cache intact.
- Evidence: Archive result, library state, stale navigation and fresh reload above; article refresh helper lacked the existing router.refresh pattern.
- Accounts for: Correct archive transaction and library count, stale editable page on client navigation, and correct page after reload.
- Unexplained: none for this observed sequence.
- Confidence: high for the observed sequence, with the corrected browser sequence verified below.

The correction reuses `next/navigation` router.refresh after the authenticated record readback.
It invalidates prefetched library/editor snapshots while preserving component state and text typed
during in-flight writes. A full browser navigation would also fetch current state, but would
unnecessarily discard the editor component. Decision: accepted with controls; existing revision
checks continue to reject stale writes independently of UI cache behavior.

## Live browser lifecycle and preservation

```text
Outcome: Staff can find existing prose and create, save, reopen, edit, coauthor, privately preview, archive and restore an article.
Surface: Authenticated Chrome at blackstory.app/admin/stories/articles with live production services.
Data: All 48 existing canonical articles plus one explicitly synthetic private validation draft.
Observed: Library displayed 48 of 48 before the fixture. Chapter: Buying a Home opened its complete body with enabled editing controls; it was not edited. A new private draft saved revision 1, Gerald Dagher and Neo author credits persisted, reload retained the draft, and a subsequent body edit saved revision 4. Private preview identified revision 4 and both credits, and correctly named missing period/place/source blockers rather than rendering an incomplete article. Archive made revision 5 read-only; Archived filtering found it. Restore made revision 6 editable and preserved prose and credits. Cleanup archived it as revision 7. Client navigation showed a stale snapshot during this journey; the correction and repeat proof are recorded separately.
Verdict: Save/edit/coauthor/archive/restore proven live. The navigation correction repeat proof is below. Native file selection remains unproven.
```

Light and dark editor screenshots were inspected. The original articles were not rewritten to
add bylines. The synthetic article remains archived with audit history, outside the active
library. Its public `/stories/production-editorial-validation` URL returned 404.

Before the browser write, this independent preservation query returned 48 rows and checksum
`906f35ce6460473b4a6e3b72ec955799`:

```sql
SELECT count(*),
       md5(string_agg((to_jsonb(a)-ARRAY['contributors','revision','archived_at'])::text,'' ORDER BY id))
FROM reference.articles a;
```

After cleanup, the identical query excluding only `slug='production-editorial-validation'`
returned the same 48 rows and checksum. The active release still contained 48 articles.
The owner-approved recovery export and earlier migration preservation hash remain the
separate migration rehearsal evidence above.

```text
Check: Navigation correction repository release lanes
Command: APP_NEXT_DIST_DIR=.next-validation fnm exec --using=22 -- ./scripts/ci-local.sh --base origin/main
Result: pass
Observed: All ten selected lanes passed. Generated next-env.d.ts validation-directory paths were restored to the tracked version; no generated build output is included.
```

Follow-up validation is explicitly tracked: native file selection in `repo-vrp2q`, isolated
catalog-scale publication performance in `repo-m0fm8`, and pre-existing dependency advisories
in `repo-nsody`. None is reported as passing. No synthetic or unfinished historical article
was published to exercise the release executor.

## Final correction activation and browser regression

PR #300 merged the cache correction to staging. PR #301 completed all 24 reported checks
without failures, including application tests and external security review, then merged as
`433865468bd8773dd5200ff066bfcdf413cf2669`. Production deployment
`dpl_HnmBEAtC2JUqAGiuoofWoKyRaCHq` became READY; the provider alias API explicitly mapped
`blackstory.app` to it. No additional migration or credential change was required.

```text
Check: Final lifecycle navigation regression
Command: Authenticated Chrome: restore fixture; Articles → active row → editor; archive fixture; Articles → archived filter → row → editor, without reloading between mutations and navigation.
Result: pass
Observed: Restore produced revision 8; reopening through the library showed revision 8 with Title enabled. Archive produced revision 9; reopening through Archived showed revision 9 with Title disabled and the archived notice. Prose and Gerald Dagher/Neo author credits persisted. No warning/error logs were captured in the final editor tab. The first restore attempt happened before client hydration settled and the reason field was reset; after the ready state, the ordinary control completed successfully.
```

This repeats the observed stale-navigation sequence against the corrected release and checks
both directions. It is a manual browser regression, not an automated browser test. The earlier
unfixed production sequence provides the failing observation; the cause was not deliberately
reintroduced into Production.

```text
Check: Final public/private boundaries
Command: node /tmp/editorial-production-boundaries.mjs
Result: pass
Observed: The same public 200, staff 307, API 401 and internal documentation 404 checks passed against deployment dpl_HnmBEAtC2JUqAGiuoofWoKyRaCHq.
```

Final preservation query again returned 48 original rows and checksum
`906f35ce6460473b4a6e3b72ec955799`. The synthetic fixture is an archived draft at revision 9;
its revisions and audit history are retained through normal product recovery. The active public
release still has 48 articles. Final screenshots are local inspection artifacts, outside Git.

```text
Check: Final release production health and provenance
Command: gh workflow run deploy-production.yml --ref main -f commit_sha=433865468bd8773dd5200ff066bfcdf413cf2669 -f prior_release_sha=3b3a3b45a4b73fc32024e166277fc4dd5c6e7eb1 -f confirm=deploy
Result: pass
Observed: Run 38684131567 completed successfully after the corrected deployment was active, including required health and E2E smoke. Main CI run 38683792332 also completed successfully at the same commit.
```

## Closing verification record

- Project inspected: existing authoring/release authority, migration chain, staff permissions, storage, hosting and client-cache behavior were inspected; this release affects admin web flows and production schema/configuration, while public projections remain release-scoped.
- Reuse checked: canonical articles, shared release executor, existing web_public capability and contributor/entity router refresh patterns were reused. No second CMS, permission layer or secret-loading framework was introduced.
- Validation path run: the full Node 22 ci-local commands and results above, prior three-test real-services editorial integration, production migration dry run, anonymous boundaries and hosted release checks.
- Outcome observed: existing chapter body, all 48 library rows, controlled draft persistence, coauthor credits, private revision preview blockers and archive/restore navigation were observed in the live browser.
- Surface inspected: light/dark editor views and final archived credits; no captured final editor hydration warning. Native chooser remains not done due tooling restrictions; native iOS and assistive technology are not attempted in this web rollout.
- Diff reviewed: scoped source correction and final documentation/tracker changes reviewed before their respective commits; generated next-env changes were removed.
- Residual risk: native browser file selection, catalog-scale publication throughput and pre-existing dependency advisories remain tracked. Signed public activation/removal/rollback was exercised in isolated real-services integration, not by publishing synthetic content to Production.
