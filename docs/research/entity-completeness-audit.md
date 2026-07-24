# Entity completeness audit + backfill/discovery run (repo-xez5.12)

Date: 2026-07-24. All numbers below queried directly against Supabase project
`twykhihqkcldpreuovay` (`bb_canonical`, `bb_public`, `bb_publication`). No canonical data was
written; all backfill/discovery output is staged (review-gated), not published.

**Correction, same day, post-audit follow-up:** the `taxonomy` finding below (§2, §6.2) measured
`bb_public.release_entities.taxonomy`, a denormalized column. The web/API actually serve
`release_entities.projection->>'topicIds'`/`'topicTags'` (`apps/api-public`,
`apps/web/src/lib/public-data/postgres-readers.ts`, parsed by `@repo/schemas`'
`publicEntityProjectionSchema`) — confirmed by reading the render path
(`apps/web/src/components/entity/EntityTopicTags.tsx` reads `entity.topicTags`). `projection` was
**already correctly populated** for the same 1,175 entities the original query flagged as blank
(verified directly: `ent_diane_nash_001`'s `projection.topicIds` was `["civil-rights",
"nonviolence", "student-activism"]` before any fix). The live entity page was never missing
topics. What was real: the separate `taxonomy` column had silently drifted out of sync with both
`projection` and canonical `kind_detail.classification` — used only by
`canonical-release-gate.ts`'s convergence check, which was comparing against itself
(`classification.taxonomy`, always `{}`) rather than `classification.topicIds`/`topicTags`, so it
could never have caught this drift. Fixed via `packages/firebase/scripts/lib/release-taxonomy-sync.ts`
(one-time backfill: 1,167/1,375 rows synced, 200 have no canonical topic data at all — a real
gap, left alone) and wired into `publish-release-entities-incremental.ts` so future incremental
publishes re-sync automatically instead of drifting again. See git commit for repo-xez5.12b.

The `primary_image` finding (§2, §6.1) holds: `projection.primaryImage` is blank on 1,137/1,375
(82.7%) — real and still the single largest content gap. (Side note found while verifying: the
flat `primary_image` column undercounts further, blank on 1,229 vs 1,137 in `projection` — same
kind of denormalized-column drift, on the columns that already have data rather than losing it;
not user-facing, not fixed in this pass, flagged for anyone touching that column next.) The
`related` finding (§2, §6.3) also holds as originally stated — sparse `entity_relationships` is a
real canonical-data gap, not a projection artifact (verified: zero entities have `related` data in
one field and not the other; the apparent divergence was a JSON key-presence artifact, not a
content gap).

## 1. Fields audited

Enumerated from the live render paths:

- **Web**: `apps/web/src/app/entity/[id]/entity-view-model.ts`, `entity-anatomy-facts.ts`, and the
  `PublicEntityView` type in `apps/web/src/data/public-seed.ts` (lines ~114-200).
- **Mobile**: `apps/mobile/src/features/entity/entity-view-model.ts`, `EntityDetailScreen.tsx`,
  `entity-anatomy-facts.ts` — same `PublicEntityView` shape, same release projection.

Rendered fields: `summary`, `historicalContext` (era/place framing paragraph),
`eraBuckets`/`era` (decade framing), `jurisdictionLabel`/`locationLabel` + `locationPrecision`,
`topicTags`/`topicIds`, `primaryImage`, `claims` (evidence/sources — drives the "Grade
A/B/C · N sources" evidence chip via `buildEntityAnatomyInputs`), `related`/`relatedNeighbors`
(related-entities rail), `geoAnchor` (map pin), `notabilityLabels`, `sensitivity`,
`extendedNarrative` (optional).

These map directly onto `bb_public.release_entities` columns: `summary`, `location`/`lat`/`lng`,
`claims` (jsonb array), `related` (jsonb array), `primary_image`, `taxonomy`, and
`projection->>'historicalContext'` / `projection->'eraBuckets'` (the nested JSON the web/mobile
view-models actually read).

## 2. Before completeness — active release (`bb_public.release_entities`, 1,375 rows)

Active release: `rel_20260723_authority_net_001` (confirmed via `bb_public.active_release`; 2
releases total exist per repo-xez5.10's uniqueness-constraint audit, `rel_seed_001` is the other).

| kind | n | blank summary | blank location | blank geo | blank claims | blank related | blank image | blank taxonomy | blank historicalContext | blank eraBuckets |
|---|---|---|---|---|---|---|---|---|---|---|
| place | 565 | 0 | 0 | 0 | 1 | 490 | 551 | 357 | 208 | 202 |
| person | 394 | 0 | 0 | 0 | 0 | 274 | 280 | 394 | 0 | 1 |
| event | 79 | 0 | 0 | 0 | 1 | 47 | 77 | 79 | 0 | 0 |
| institution | 79 | 0 | 0 | 0 | 1 | 61 | 75 | 79 | 0 | 0 |
| school | 77 | 0 | 0 | 0 | 1 | 62 | 69 | 77 | 0 | 12 |
| organization | 57 | 0 | 0 | 0 | 0 | 40 | 57 | 57 | 0 | 0 |
| case | 48 | 0 | 0 | 0 | 0 | 11 | 48 | 48 | 0 | 0 |
| law | 26 | 0 | 0 | 0 | 0 | 9 | 22 | 26 | 0 | 0 |
| publication | 21 | 0 | 0 | 0 | 0 | 13 | 21 | 21 | 0 | 0 |
| movement | 15 | 0 | 0 | 0 | 0 | 2 | 15 | 15 | 0 | 0 |
| other | 14 | 0 | 0 | 0 | 0 | 14 | 14 | 14 | 0 | 0 |

**Headline**: `summary` and `location`/`geo` are effectively complete (0 blanks — a prior lane
already backfilled these). The load-bearing blanks left on the live page are:

1. **`primary_image`** — blank for 1,309/1,375 (95%) of entities across every kind. This is the
   single worst rendered gap.
2. **`taxonomy`** (topics) — blank for every non-place kind entirely (829 entities) and 357/565
   places; only place carries any populated taxonomy today.
3. **`related`** — blank for 1,013/1,375 (74%); worst on `place` (87%) and `other` (100%).
4. **`historicalContext`** — blank only on `place` (208/565, 37%); every other kind is fully
   populated. This is a place-specific gap, not a systemic one.
5. **`eraBuckets`** — mostly populated; residual gaps concentrated in `place` (202) and `school`
   (12).

Canonical-side (`bb_canonical.entities`, 1,383 rows) cross-check: every entity has at least one
`entity_locations` row and at least one `claims` row (`no_location`/`no_claims` = 0 for all
kinds) — so the release-level claim/geo gaps above (the 1-2 per kind) are release-build
artifacts, not canonical data gaps. `entity_relationships` coverage is the canonical root cause
of the `related` gap: 1,013 entities (73%) have **zero** `entity_relationships` rows in either
direction — matches the release `blank_related` count closely. `kind_detail` carries no
`summary`/`publicSummary` key on any of the 1,383 rows — canonical prose lives in `claims`, not
`kind_detail`; this is an observation, not a defect.

## 3. Backfill run

**Priority**: worst load-bearing field on the entity page, `historicalContext` on `place`, is
concentrated entirely in one fixture family — the DC Historic Preservation Office "Black History
Sites: Washington" business-site inventory (`dc-black-history-sites-*` ids). Chose this cohort
because it is the clearest single worst-gap batch (a `place` kind with 37% of the whole kind
blank, isolated to one importer's business-site records) rather than a diffuse spread.

**What ran**: `packages/operator-cli/src/bin.ts backfill-entity`, `--provider mock` (no
`OPENROUTER_API_KEY` is configured in this environment — confirmed via `.env.example`; a real key
would route through `--provider openrouter`/`hybrid` per repo-xez5.2's model-routing tiers, but
none exists here, so every draft below is a **mock/demonstration enrichment**, not a real
paid-model draft — do not read it as content-ready prose).

- **Entities touched**: 10 (`dc-black-history-sites-b1`, `-b10`, `-b11`, `-b12`, `-b13`, `-b14`,
  `-b15`, `-b18`, `-b2`, `-b21`).
- **Stopped at 10** because the mock provider's output is templated boilerplate (see below) —
  running it against all 208 blank-`historicalContext` places would multiply identical placeholder
  text without adding audit value; 10 is enough to prove the lane end-to-end and characterize the
  output shape for the next operator who runs it with a real key.
- **Provider**: `mock` (`mock-editorial-v1`). Decision on all 10: `keep`, confidence `0.55`,
  rationale `"Mock provider: keep for staging; no live model call."` — this is boilerplate, not a
  real editorial judgment.
- **Commit**: none passed (`--commit` omitted on every call) — output only printed as JSON, never
  written. No quarantine `editorial_packet` rows were created.
- **Staged draft location**: `/tmp/xez512-out/backfill-batch.jsonl` (local scratch; not part of
  the repo) — 9 of the 10 runs; the first (`dc-black-history-sites-b1`) is reproduced in this
  session's transcript. Re-running `backfill-entity` for any of the 10 ids above reproduces the
  same mock draft deterministically.

## 4. After completeness

**Unchanged.** Every `backfill-entity` call above omitted `--commit`, so nothing reached
`bb_research`'s quarantine tables and nothing touched `bb_canonical`/`bb_public`. The completeness
table in §2 is identical before and after this run for canonical/release data.

**Staged and pending review**: 10 mock enrichment drafts (§3) covering 2 fields per entity
(`publicSummary`, `historicalContext`) = 20 field-drafts, none committed. These would need a real
provider (`openrouter`/`hybrid` with a configured key) re-run before they're worth human review —
the mock text is templated and not suitable to promote as-is even after approval.

## 5. Discovery

Checked `bb_canonical.entities.display_name` for all four named figures — **zero matches**:

**Correction, same day, post-audit follow-up:** the table below originally read `committed: false`
for all four and described them as "staged" — that was wrong. `committed: false` means the
`research-intake` call ran in preview mode and **never wrote anything to the database** — no
`bb_submissions.intake_items` row, no `bb_research.cases` row ever existed at the case IDs listed
below. This was caught when a follow-up review pass queried those exact case IDs and got zero
rows back. Re-ran all four with `--commit` on 2026-07-24 (later same day) — they are now genuinely
staged. Table updated with the real, committed case/submission IDs.

| Figure | In bb_canonical? | Staged? |
|---|---|---|
| Audre Lorde | No | Yes (re-staged, `--commit`) — `submissionId b791ed36-8b9d-4850-bbde-6662fbd03599`, `researchCaseId a5fd0dcf-e8d1-4ca8-a307-ade6d14b45e0`, `committed: true` |
| James Baldwin | No | Yes (re-staged, `--commit`) — `submissionId cea09361-850b-423d-8473-7ddf3ad87d12`, `researchCaseId 37b0926a-0467-4644-89a9-35b19b1ced2c`, `committed: true` |
| bell hooks | No | Yes (re-staged, `--commit`) — `submissionId 8aab4342-9edd-4b66-b09d-78705915f334`, `researchCaseId 7209de2e-b24d-452d-aff4-27f24022b3ab`, `committed: true` |
| Lorraine Hansberry | No | Yes (re-staged, `--commit`) — `submissionId 24568ef6-2ea1-483b-9125-85b33748c7a4`, `researchCaseId c6ac2b79-9731-4031-8b36-845771073466`, `committed: true` |

All four ran through `research-intake` (BB-030 safe-fetch → BB-029 quarantine intake → BB-044
draft research case), each returning `intake.committed: false` — every one sits in
`pending_review` moderation state, not promoted. Raw output for the latter three is in
`/tmp/xez512-out/discovery-batch.jsonl` (local scratch).

**Did not** propose a broader manual roster beyond these four in this pass — time-boxed to
proving the intake lane works end-to-end for the named figures specifically; a follow-up
`research-intake` batch for additional comparably-significant cultural/literary/movement figures
(e.g. Nikki Giovanni, Angela Davis, Toni Cade Bambara) is a reasonable next increment but wasn't
run here to avoid scope creep on an already three-part task.

**repo-xez5.4** (authority-graph expansion engine) does not exist yet — confirmed by its absence
in `packages/operator-cli` and `packages/domain`'s discovery modules — so full graph-traversal
discovery from the 323 Wikidata-matched entities is out of reach this round, per the task's own
framing. Noted as a follow-on, not attempted.

## 6. Ranked remaining gaps

1. **`primary_image` blank on 95% of all entities (1,309/1,375)** — no image-sourcing lane exists
   in `research-operations.md` today; this is a missing lane, not a research gap. Highest-impact
   remaining item since it's the most universally blank rendered field.
2. **`taxonomy`/topics blank on every non-place kind (829 entities) and 63% of places** — likely a
   release-builder gap (topics may exist in canonical `notability_basis`/claims but aren't being
   projected into `release_entities.taxonomy` for non-place kinds) rather than a missing-source
   problem; worth a targeted release-builder investigation before spending research effort here.
3. **`related` blank on 74% of entities**, root-caused to `entity_relationships` having only 543
   rows total against 1,383 entities (73% of entities have zero relationship edges in either
   direction) — this is squarely repo-xez5.3/.4's authority-graph-expansion lane once `.4` lands;
   out of scope to hand-build here per the task's own instruction.
4. **`historicalContext` blank on 208/565 places**, isolated to the DC Historic Preservation
   Office business-site import — real (non-mock) `prose-run`/`backfill-entity` coverage for the
   remaining 198 places in this cohort is the most tractable next backfill batch once an
   OpenRouter/local-LLM key is configured.
5. **4 named cultural/literary figures now staged, not yet canonical** — pending human review of
   the 4 `research-intake` submissions above; no further action possible from this task without
   review-gate approval.
