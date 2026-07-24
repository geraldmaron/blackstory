# Entity source drift audit (repo-xez5.10)

Date: 2026-07-24. Read-only investigation across the four places entities exist. See
`docs/decisions-carryover.md` ("Addendum, 2026-07-24") for the precedence rule this audit informs.

## Headline numbers

| Source | Count | Notes |
|---|---|---|
| Git fixture files | 127 files (not 118 — see below) | `packages/firebase/fixtures/national-catalog/` |
| Git fixture unique entity ids, root-level only | 1,248 | excludes `_wave-2026-07-19/` (see below) |
| Git fixture unique entity ids, including `_wave-2026-07-19/` | 1,248 (no new ids) | wave dir adds zero new ids |
| Supabase `bb_canonical.entities` | 1,383 rows | declared system of record |
| Firestore `canonicalEntities` | not queried (no Firestore credentials/tooling available to this task) | still actively written by `publish-national-catalog.ts` |

The bead description said "118 files"; the actual count on disk is **127** (117 at the root plus
9 non-empty lane files under `_wave-2026-07-19/`, plus that directory's `_meta` and
`denylist.json`). Flagging the discrepancy rather than silently reconciling it.

## Fixture-directory finding: `_wave-2026-07-19/` is fully superseded

Every entity id in all nine `_wave-2026-07-19/lane-*.json` files (`lane-a-black-towns.json`
through `lane-h-venues-culture.json`, 15-17 ids each, 127 ids total) is **already present** in a
root-level fixture file (e.g. `lane-a-black-towns.json`'s 15 ids are a full subset of
`black-towns-settlements.json`). `denylist.json` in that directory carries no entity ids at all
(a rejection list, not a catalog chunk). This reads as an early staging wave whose content was
copied/promoted into the permanent root-level files and then left behind rather than removed.

**Delete-candidates (flagging for review per task instructions, not deleting):**
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-a-black-towns.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-b-hbcu-schools.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-c-churches-cemeteries.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-d-museums-archives.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-e-newspapers-publishers.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-f-labor-unions.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-g-west-frontier.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/lane-h-venues-culture.json`
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/denylist.json` (no ids; verify it
  isn't referenced by any import-lane denylist check before removing — not verified in this pass)
- `packages/firebase/fixtures/national-catalog/_wave-2026-07-19/_meta` — check contents before
  removing the directory

`packages/firebase/scripts/catalog-connectivity-report.ts` already reads and reports on this
directory (its own comments independently note "the `_wave-2026-07-19` lane files largely
duplicate ids already present" elsewhere in the fixture set — consistent with this audit's
finding). That script only *reports*; nothing publishes from `_wave-2026-07-19/` directly. Deleting
the directory would need that report script updated to stop expecting it, in addition to human
review of the fixture-history question raised in the task.

## Fixture vs. Supabase drift: 135 entities exist in Supabase only

Root-level fixtures (127 files minus the fully-subsumed wave dir) contain 1,248 unique entity
ids. `bb_canonical.entities` has 1,383 rows — **135 more entities than the fixtures contain**.
This is consistent with the new precedence rule (Supabase can grow past its git seed via direct
promotion/curation) but was not verified id-by-id against `bb_canonical.entities.id` in this pass
(time-boxed); a follow-up should diff the two id sets directly (not just counts) to confirm the
135 are genuinely additive and not, say, id-scheme mismatches (fixture ids are strings like
`ent_naacp_org_001`; confirm `bb_canonical.entities` uses the same id values, not a different
surrogate key, before trusting a raw count comparison for anything precedence-critical).

## Firestore

No Firestore read access was available to this task (no `firebase-admin` credentials configured
for read-only inspection here), so Firestore `canonicalEntities` row/id counts were **not**
independently verified. What is confirmed from source: `packages/firebase/scripts/publish-national-catalog.ts`
still writes `canonicalEntities/<id>` (and `entityRelationships/<id>`, `publicReleases/*`) on every
run, so Firestore is not yet "export/rollback only" in practice — this is the known-drift call-out
now recorded in `docs/decisions-carryover.md`.

## Projection duplication (task item d): confirmed by-design, not a bug

Checked directly against Supabase (`twykhihqkcldpreuovay` project):

- `bb_publication.releases`: exactly 2 rows — `rel_seed_001` (created 2026-07-16) and
  `rel_20260723_authority_net_001` (created 2026-07-23, currently active per
  `bb_public.active_release`).
- `bb_public.release_entities`: 1,375 rows for `rel_20260723_authority_net_001` + 1,367 rows for
  `rel_seed_001` = 2,742 total — matches the epic's reported figure exactly, and matches N=2
  releases.
- `bb_public.release_stories`: 5 rows per release × 2 releases = 10 rows total — same pattern.
- Checked for **real** duplicates within a release: `(release_id, entity_id)` on
  `release_entities` and `(release_id, slug)` on `release_stories` both have **zero** groups with
  count > 1. The apparent "doubling" is fully explained by two immutable per-release snapshots
  (ADR-004 pattern), not hidden duplicate rows.

**Uniqueness constraints added** (applied via `apply_migration`, both succeeded cleanly against
live data — no pre-existing violations, which is itself confirmation there are no real dupes
today):

```sql
alter table bb_public.release_entities
  add constraint release_entities_release_entity_uniq unique (release_id, entity_id);

alter table bb_public.release_stories
  add constraint release_stories_release_slug_uniq unique (release_id, slug);
```

## In-code entity tables (task item c)

- **`MENTION_OVERRIDES`** (`packages/domain/src/graph/mention-resolver.ts`) was a literal `Map` in
  source. Moved to `packages/domain/src/graph/data/mention-overrides.json` (schema-versioned, with
  a `provenance` field and per-entry `note`s carried over from the original code comments,
  including the "deliberately excluded" tokens and why). `mention-resolver.ts` now loads it at
  module-init via `readFileSync`/`import.meta.url`, mirroring the existing fixture-loading pattern
  already used elsewhere in this package (e.g. `src/discovery/oral-history-campaign.ts`,
  `src/relevance/fixtures.ts`). The exported `MENTION_OVERRIDES` symbol and its `ReadonlyMap<string,
  string>` shape are unchanged, so all call sites and the existing test
  (`mention-resolver.test.ts`) needed no changes. Full `@repo/domain` test suite (1,479 tests)
  passes.
- **SearXNG query roster** (`packages/config/src/scheduled-jobs/data/corsair-web-search-queries.json`)
  was **already** a runtime-loaded JSON data file, not code — it already carries `schemaVersion`,
  `updatedAt`, and a `purpose`/`safeties` block, and is read by
  `scripts/run-scheduled-searxng-discovery.sh` and `packages/firebase/scripts/triage-corsair-candidates.ts`
  at runtime. No change needed; it already satisfies the "curation edits don't require a code
  deploy" goal.
- **Full DB migration** (moving these into a `bb_ops`/`bb_reference` table) was judged too heavy
  for this pass and is a follow-up, not done here — flagging as a candidate for `repo-atya` or a
  new bead once the Firestore retirement work needs a single query surface for this kind of
  reference data.

## What was not done in this pass

- Firestore `canonicalEntities` was not queried directly (no credentials/tooling); the "135 rows
  Supabase-only" figure is a fixture-vs-Supabase comparison only, not a three-way reconciliation.
- The 135-entity fixture/Supabase delta was not diffed id-by-id, only by count.
- No fixture files were deleted; the `_wave-2026-07-19/` list above is a recommendation for human
  review, per task instructions.
- The Firestore entity-write path in `publish-national-catalog.ts` was not modified or gated —
  that is `repo-atya`'s scope (ledger cutover), referenced but not executed here.
