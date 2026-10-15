# Editorial workspace verification

Implementation checked locally on October 14–15, 2026. Production migration and deployment have not run. The historical article remains an unfinished private working draft.

## Scope and reuse

Outcome: staff can compose and return to a durable article, manage ordered Gerald Dagher and Neo credits, cite sources, connect records, preview a saved revision and publish an approved revision through the existing release executor.

Inspected the article CLI, public renderer, canonical write boundary, intake review, staff permissions, release signing/activation, admin patterns and brand tokens. Repository searches found the existing article lifecycle, quarantined intake and shared publication executor. Those capabilities were extended. The process-local cover editor was removed rather than retained as another CMS. Base Web owns private management controls; Tiptap adapts the existing typed article body. Public prose does not store editor JSON or arbitrary HTML.

Blast radius: private reference article and contributor tables, immutable revision/review/media/publication records, private storage, entity proposals, canonical audit/outbox writes, signed article artifacts, public contributor snapshots and Article structured metadata. Public and mobile release pointers still activate together. Existing public articles default to empty credits until explicitly assigned.

Architecture decision: accepted with controls. The strongest failure mode is a second publication authority or loss of evidence in a rich editor. The alternative was extending the old cover-only form. Shared lifecycle validation, typed block round trips, exact-revision approval, transaction locks, immutable history and signed artifact readback control these risks. Dependency rationale and hydration controls are in the editorial UI pattern.

## Automated checks

Check: Repository CI selection and quality gates
Command: APP_NEXT_DIST_DIR=.next-validation fnm exec --using=22 -- ./scripts/ci-local.sh
Result: pass
Observed: All ten selected lanes passed: install, validate, unit-js-packages, unit-js-apps, contract-security-a11y, coverage, build-typecheck, e2e, governance and security-policy. Final run used Base Web 16.1.1 on Node 22.

Check: Final local production build
Command: cd apps/web && APP_NEXT_DIST_DIR=.next-validation fnm exec --using=22 -- node /tmp/editorial-local-runner.cjs pnpm exec next build --webpack
Result: pass
Observed: Production compilation and generation of all 130 static pages completed, using isolated local Supabase configuration. Served with the same runner and pnpm exec next start --port 3050 for browser checks.

Check: Local editorial database, authorization and publication integration
Command: cd apps/web && fnm exec --using=22 -- node /tmp/editorial-local-runner.cjs node --conditions development --import tsx --import ./test/css-stub.mjs --test src/admin/editorial/editorial.integration.test.ts
Result: pass
Observed: Three tests passed, zero failed. Covers concurrent first saves, stale revisions, trusted credits, review invalidation, restoration, publication/rollback, failed signing atomicity, entity evidence and permissions, private bytes and public media readback.

Check: Existing management publication regression
Command: cd apps/web && fnm exec --using=22 -- node /tmp/editorial-local-runner.cjs node --conditions development --import tsx --import ./test/css-stub.mjs --test src/admin/work/publish-work.integration.test.ts
Result: pass
Observed: One test passed, zero failed.

Check: Fresh migration chain
Command: supabase db reset --local --no-seed --workdir /tmp/blackstory-editorial-e2e --yes
Result: pass
Observed: Full migration chain replayed in the isolated local project, including editorial workspace tables and privacy constraints.

Check: Public corrections credential isolation
Command: docker exec -i supabase_db_blackstory-editorial-e2e psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < supabase/tests/editorial-privacy.sql
Result: pass
Observed: Public corrections access could read the control correction but could not read, alter or forge private editorial proposals or read drafts. Transaction rolled back its fixtures.

## Browser evidence

Outcome: Staff can edit a saved article, restore history, select canonical records and assign Gerald plus Neo credits.
Surface: Authenticated local Chrome admin, using real local Supabase APIs and storage.
Data: Private research working draft, two-revision recovery fixture, canonical entity fixture and controlled publishable article with a real source URL.
Observed: Save/reopen and automatic saving retained prose; restoration created a new revision without reloading; canonical name search linked the selected ID; entity Identity selection submitted Organization and displayed “Saved kind.” Gerald and Neo appeared in ordered credits. A controlled approved article rendered publicly with matching byline and Person/Organization structured metadata; the related public entity showed the article under Cited in.
Verdict: proven for these local journeys. The historical working draft was not published.

Outcome: Management remains usable in both themes and on a narrow screen.
Surface: Desktop Chrome and 400px Chrome device emulation.
Data: Populated editor, article library, contributor profiles and canonical entity.
Observed: Light and dark screenshots inspected; compact shell and toolbar, library cards, stacked controls, modal inspector, Escape dismissal and focus return observed. The 400px viewport had no horizontal overflow. Modal stacking covered the writing toolbar. Fresh page inspection showed no hydration error after Styletron and field-ID fixes. A local production build on port 3050 also rendered both themes and the 400px inspector with no captured warning/error logs; Escape returned focus to its opener and width equaled scroll width. The final dependency uses Base Web 16.1.1 because its declared Node >=18 engine supports this repository’s Node 22; Base Web 18 requires Node 24.
Verdict: proven for inspected Chrome surfaces; native iOS and screen-reader sessions were not run.

Outcome: An editor uploads an inline image from the block inspector.
Surface: Base Web file uploader in Chrome.
Data: Existing BlackStory icon used only as a disposable local fixture, with credit, rights and image description.
Observed: Inspector and enabled upload control rendered. Chrome extension file access blocked automated chooser completion; native fallback had no available window. No extension permission was changed. Backend integration independently verified real private upload bytes and their published readback.
Verdict: not proven for the browser chooser; a manual upload in ordinary Chrome remains required. Backend proof does not establish chooser behavior.

Screenshots are session artifacts outside the repository: admin-editor-light.png, admin-editor-dark.png and admin-editor-mobile.png. Disposable test accounts are removed after browser validation; a reset after the first final pass verified zero matching accounts. The final cleanup also resets only the disposable editorial project.

## Limits and follow-up

Production migration, deployment, production signing identity and production storage policies require rollout verification. Native iOS, assistive-technology sessions and production-scale latency were not checked. The historical draft still needs primary-document inspection, source corroboration and editorial review. The dependency audit has existing repository advisories tracked in the issue tracker; no advisory path was found through the added Base Web, Styletron or Tiptap libraries. Legacy transitive React peer ranges remain a dependency risk.

## Verification record

- Project inspected: answered above, “canonical write boundary, intake review, staff permissions”.
- Reuse checked: answered above, “Those capabilities were extended.”
- Validation path run: checks above record exact commands and observed results.
- Outcome observed: local journeys above, “restoration created a new revision without reloading”; browser chooser explicitly not proven.
- Surface inspected: browser evidence above, “Light and dark screenshots inspected”.
- Diff reviewed: final staged review recorded before commit; review covers persistence, permissions, publication, UI adapters, dependencies and generated files.
- Residual risk: limits above; manual chooser test and production rollout verification settle the remaining environment-specific gaps.
