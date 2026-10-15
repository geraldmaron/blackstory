# Admin hydration and article management verification

## Diagnosis

Reproduction

- Command: Open a fresh Chrome tab at http://localhost:3048/admin/login after the Base Web dependency change.
- Environment: Running Next.js 16.4.1 Webpack development server, Node 22, Base Web pinned to 16.1.1.
- Data: Signed-out staff login, no database write required.
- Frequency: deterministic on the inspected development graph.
- Observed: React reported server class css-iwOAeq versus browser class css-vtfZW on the login Input.
- Expected: Server and browser controls use the same BlackStory theme.

Hypothesis: An old dependency graph retained a separate Base Web theme context for the provider.
Refuted by: The provider and login controls resolving the same Base Web module version while still producing these classes.
Test: Inspected the compiled login server bundle. The design provider referenced baseui@18.2.0 while LoginClient referenced baseui@16.1.1. Browser style text showed UberMoveText, 200ms transitions and #F3F3F3 for the server class, versus BlackStory font/color variables and 0ms transitions for the client class.
Verdict: supported. This is a stale split theme context, not a random class identifier or console-filter failure.

Cause

- Statement: Cached server modules from two Base Web versions split the provider and Input theme contexts, causing server controls to use Base defaults.
- Evidence: Compiled dependency paths and both generated CSS rules were inspected before editing.
- Accounts for: The class-only mismatch, default Uber typography on server controls, correct browser theme and the LoginClient stack. The console-filter frame only forwards console.error.
- Unexplained: none for the reproduced development failure.
- Confidence: high for this development graph; production build inspection is a separate gate.

Base Web is now explicitly transpiled with the management application, keeping root-provider and subpath controls in the compiled graph. The configuration change caused Next’s own restart; the healthy server was not killed. A fresh reload then produced no captured warning/error logs. No hydration warning is suppressed. A regression test renders the actual provider and subpath Input/Button on the server and checks that neither falls back to default theme classes. The regression test exercises both directions by rendering the same controls without the admin provider (default-theme classes) and with it (distinct branded classes). The stale mixed-version graph was observed before the change; it was not deliberately reintroduced into the running checkout.

## Existing content and deletion

A read-only production metadata query found 48 reference articles, 48 articles in the active public release and zero public articles without an authoring row. The earlier editorial migration is absent in production. The admin library already reads all canonical article rows, including existing CLI-created articles; no seed-only replacement or second CMS was added. Applying the editorial migration captures baseline revisions without inventing author credits.

Deletion is recoverable archiving. The library defaults to active articles and exposes archived records through the state filter. Archived prose is read-only; restoring returns it to draft with a new revision and fresh review required. For a currently public article, archiving requires retraction authority, explicit public-removal confirmation and the exact public release baseline. The shared executor creates and signs a new release, removes only that article, verifies artifacts and activates public/mobile pointers together. Signing failure leaves public content and the authoring row unchanged. Existing immutable releases and revision history remain available. Database constraints prevent publishing an archived row through another writer.

Architecture decision: accepted with controls. Hard deletion would break audit and revision relationships. Keeping a public article silently visible after a “delete” would misstate the result. Recoverable archive plus signed public removal preserves both user expectations and evidence history. Restore never republishes automatically.

Automatic approval review rejected retrieving a full production article payload, citing private-content exposure. Validation uses local production-shaped fixtures instead; no alternate route was used to retrieve that payload.

## Checks

```text
Check: Server theme regression
Command: cd apps/web && fnm exec --using=22 -- node --conditions development --import tsx --import ./test/css-stub.mjs --test src/admin/design-system/provider.test.tsx
Result: pass
Observed: One test passed. Both server-rendered subpath controls received the admin theme instead of Base defaults.
```

```text
Check: Editorial integration, including existing-row CRUD and signed removal
Command: cd apps/web && fnm exec --using=22 -- node /tmp/editorial-local-runner.cjs node --conditions development --import tsx --import ./test/css-stub.mjs --test src/admin/editorial/editorial.integration.test.ts
Result: pass
Observed: Three tests passed. Added cases edit an existing row created outside the editor, archive and restore it, reject stale/unauthorized public removal, prove signing failure atomicity, remove a public article while preserving unrelated catalog data, and retain public/mobile pointer agreement and old history.
```

```text
Check: Local archive migration
Command: supabase migration up --local --workdir /tmp/blackstory-editorial-e2e
Result: pass
Observed: The archive migration applied in the isolated project. Integration verified its archived-draft constraint.
```

```text
Check: Fresh migration chain and cleanup
Command: supabase db reset --local --no-seed --workdir /tmp/blackstory-editorial-e2e --yes
Result: pass
Observed: The full chain, including editorial history and archive migrations, replayed successfully. The disposable browser account count was zero after cleanup.
```

```text
Check: Repository validation
Command: APP_NEXT_DIST_DIR=.next-validation fnm exec --using=22 -- ./scripts/ci-local.sh
Result: pass
Observed: All ten selected lanes passed. An earlier restricted run failed because test workers and Google Fonts downloads were blocked; the rerun with required network/process access passed. The final release-pointer lock was also verified by the three-test local integration run and targeted ESLint.
```

## Browser outcome

```text
Outcome: Staff can find an existing canonical article, edit it, archive it, find it in Archived and restore it to draft.
Surface: Authenticated local Chrome administration with real local Supabase APIs.
Data: Existing canonical article fixture created through SQL, distinct from the editor’s create flow.
Observed: The existing SQL-created record appeared in the library. Browser editing saved revision 5 with the new prose. Archive made revision 6 read-only and removed it from Active articles; the archived filter found it. Restore produced editable draft revision 7 with the prose intact and all prior revisions visible. Both themes were inspected, and no warning/error logs were captured in the inspected editor.
Verdict: proven for the local existing-row journey. Production article bodies were not inspected.
```

A second browser journey opened a controlled released article publicly, then archived it through Settings with the public-removal checkbox and a reason. The editor became archived/read-only; reloading its public URL showed “That page is not here.” This used real local storage, signing and release APIs, not mocked responses.

## Verification record

- Project inspected: diagnosis and existing-content source query above.
- Reuse checked: canonical authoring rows, shared release executor and audited write boundary extended.
- Validation path run: commands and results above.
- Outcome observed: existing-row edit/archive/filter/restore journey above.
- Surface inspected: fresh login and both editor themes inspected; no captured hydration mismatch.
- Diff reviewed: complete staged review before commit, including theme configuration, server/client adapters, permission rules, migration, archive transaction and regression tests.
- Residual risk: production migrations/deployment and native/assistive-technology checks remain outside local validation. The automatic review restriction prevented inspecting remote article bodies. Recovery from deliberately reintroduced stale module caches was not tested in the running checkout.

The local browser fixtures were removed after validation. No production database or article content was changed. Production rollout remains tracked separately.
