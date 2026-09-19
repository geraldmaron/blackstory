# Archive reading verification

Engineering record, 18 September 2026. This is a verified web increment, not completion of the Life Worlds research program or a claim that every repository check is green.

## Scope and reuse

Web-only changes touch Lives composition and selection, Room evidence/cards, Stories catalog and article blocks, Records orientation, and the web image CSP. No database writes, canonical entity changes, stored schema changes, mobile changes, new packages, or paid research workflows. Existing public URLs and optional card props remain compatible.

Inspected the repository instructions, current UI direction and protected experiences, Room patterns, DestinationIcon, ArticleBody, Lives adapters/tests, manifests and validation scripts. Reused the Room evidence kit, existing destination vocabulary, source-authored story images, existing entity/chapter routes, and domain ACS vintage helper. No parallel icon, publication, or research system was added. The archive figure consolidates the existing article image pattern rather than duplicating it.

Source locators, rights, rejected candidates, audience hypotheses, adversarial decisions and the bounded execution brief are in [the research record](./lives-archive-reading.md). The security decision is accepted with controls: two exact image hosts only, no broader script/connect access, no-referrer images, independent text/provenance. Remote host availability and visitor IP disclosure remain tradeoffs.

## Commands

```text
Check:    Web types
Command:  pnpm --filter @repo/web typecheck
Result:   pass
Observed: TypeScript exited 0.

Check:    Full web unit suite
Command:  pnpm --filter @repo/web test
Result:   fail
Observed: 2,573 tests; 2,565 pass, seven fail, one skip. The seven failures match the pre-change baseline.

Check:    Repository lint
Command:  pnpm lint
Result:   fail
Observed: Four pre-existing errors, zero warnings, all outside changed files.

Check:    Production web build
Command:  pnpm --filter @repo/web build
Result:   pass
Observed: Production compilation, prerendering and route generation completed; exit 0.

Check:    Whitespace integrity
Command:  git diff --check
Result:   pass
Observed: No whitespace errors.
```

Changed TypeScript files also passed this exact command:

```sh
pnpm exec eslint apps/web/src/app/records/RecordsIndex.tsx apps/web/src/app/stories/page.tsx apps/web/src/components/article/ArticleBody.tsx apps/web/src/components/article/ArticleBody.test.ts apps/web/src/components/lives/LivesMilestoneExperience.tsx apps/web/src/components/lives/lives-archive-reading.test.tsx apps/web/src/components/room/Evidence.tsx apps/web/src/components/room/RoomCards.tsx apps/web/src/components/room/index.ts apps/web/src/lib/lives/lives-archive.ts apps/web/src/lib/lives/lives-milestones.ts apps/web/src/lib/lives/lives-milestones.test.ts apps/web/src/lib/web-security/csp.ts apps/web/src/lib/web-security/web-security.test.ts --max-warnings 0
```

```text
Check:    Changed TypeScript lint
Command:  The full eslint command immediately above
Result:   pass
Observed: Exit 0, no errors or warnings. This is not a substitute for the failed root lint.
```

Formatting was checked with `pnpm exec prettier --check` over every changed TS/TSX/CSS and UI/research Markdown file. It reported all matched files conform to Prettier. The whole-repository formatting sweep was not run. No staging-to-main PR was opened; the full cross-package `scripts/ci-local.sh` lane runner and mobile/Python suites were not run for this web-only increment.

The seven web failures concern two Methodology assertions, measurement legend dimensions, research coverage/lineage metadata, zoom max clamp, a Room map-moment guard, and the shared home/pin cached loader. The Room guard also emits a failing parent suite line; it is not an eighth failing test. Root lint errors are unused identifiers in HomeFirstPaint, books detail, PopulationDecadeSpine, and an unused expression in scripts/shot.mjs. These were not silently repaired as part of this change.

## User-visible proof

```text
Outcome:  Readers encounter sourced historical objects and contextual accounts, follow visible years with real evidence, and branch into related records and chapters without blank era panels.
Surface:  Live localhost:3048 Lives, Stories, housing chapter, Rooms, Records, Data and Law.
Data:     Actual local Postgres-backed public data plus the inspected editorial objects, not stubbed fetches.
Observed: All six question readers render archival material and working handoffs; only evidence-bearing eras have jump links; document images load and chronology/definitions remain visible.
Verdict:  proven for the bounded increment; comprehensive life-stage/class/region coverage is not claimed.
```

## Surface inspection

Both light and dark themes were exercised in Chromium with real routes and screenshots. Layout measurements excluded closed disclosure content.

| Surface | Widths checked | Observed |
| --- | --- | --- |
| All six Lives questions | 320, 768, 1440 | No horizontal overflow. Home/place/school/education/work/count show 5/5/2/3/3/6 populated era panels. All five distinct archival images load. |
| School reader | 320, 375, 430, 768, 1024, 1440 | No overflow; earlier qualifying Black-specific evidence selected instead of a broad historical nonwhite proxy. |
| Stories | 320, 375, 430, 768, 1024, 1440 | Three real-media catalog rows with icons; no empty shelf image spans. |
| Buying a Home | 375, 768, 1440 | Seven primary documents start open; repeated internal title/date removed. Final phone screenshot inspected after that correction. |
| Rooms, Records, Data, Law | 375, 1440 | No overflow, one h1 each. Existing reading layouts retained; shared card metadata and Records icons visible. |

Keyboard Enter changes the question, opens the image description, and follows an era fragment. New question choices, year links, transcript summaries and handoffs meet the 44px target. An invalid color-only outline shorthand was discovered and corrected; rendered focus is a solid 3px ring in both themes. Date, caption, place and citation contrast samples are at least 4.54:1 in light and 6.1:1 in dark. This is sampled verification, not a complete WCAG audit or assistive-technology test.

A 375px reduced-motion check with LOC image requests deliberately aborted preserved the caption, source link and expandable verbal reading, with five populated place panels and no horizontal overflow. No new motion was introduced. Real linked entity/place/chapter routes and the school-desegregation search returned HTTP 200. Source imagery was visually compared with its wording, including correcting the Du Bois land chart description from bars to money bags.

Screenshot tooling occasionally caused input caret-style hydration warnings; subsequent hydrated navigations were clean. This record does not claim every existing console warning was diagnosed. WebKit, assistive technology, 200% text zoom, and cold production deployment were not exercised.

## Broader surface decisions

Repair now: Lives chronology/objects, Stories media and empty plates, article document visibility, shared Room metadata/focus, Records orientation icons. Keep: Data charts and Law layout, which already express their material appropriately. Protect unchanged: Memorial opening and map precision/dignity. Continue in existing workstreams: broader control migration and geographic/class/life-stage coverage, additional community accounts, formal research-packet integration and measured research costs.

## Change review and residual risk

Full implementation diffs and new editorial/test files were reviewed against the scoped acceptance criteria. Optional props preserve callers; CSP additions are image-only; no new dependency, generated documentary imagery, credentials or personal data were introduced. Beads was compared semantically: only the scoped issue and the two existing workstream notes changed before closing/tracking updates; other export changes were escaping/order noise. Generated browser traces and screenshots are excluded from the commit.

Residual risks: remote images may fail (text fallback observed; preservation/mirroring needs a separate rights-aware decision); local examples cannot represent entire classes/regions (explicit scope plus continued source research); the pre-existing test/lint baseline remains red (repair and rerun those gates); untested browsers/assistive technology require their own verification. The public reading layer is deliberately small and curated, not a replacement for the research publication pipeline.

## Verification record

- Project inspected: answered: see Scope and reuse ("Web-only changes").
- Reuse checked: answered: see Scope and reuse ("Reused the Room evidence kit").
- Validation path run: answered: see Commands ("2,573 tests; 2,565 pass, seven fail, one skip").
- Outcome observed: answered: see User-visible proof ("All six question readers render archival material").
- Surface inspected: answered: see Surface inspection ("Both light and dark themes were exercised").
- Diff reviewed: answered: see Change review ("reviewed against the scoped acceptance criteria").
- Residual risk: listed in Change review and residual risk, with the checks or decisions that settle each.
- Commit-and-pr: scoped archival-reading increment on staging, not the default main branch; full diff/secrets review, imperative summary with rationale, no attribution trailer; commit/push authorized by project instructions. No PR requested or opened.
