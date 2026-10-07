---
name: blackstory-surface-triage
description: Use when a published surface shows something the record's own data contradicts — a list column reading "Place not recorded" over a record whose page prints a city, a facet that misses records that carry the value, a count that disagrees with the catalog. Triggers on "the inventions in prod are showing no location", "the site says X but the record says Y", "these records are missing Z on /records but not on their page". Not for a record whose data is genuinely absent (that is research, see blackstory-entity-complete), and not for a layout or styling bug with no data claim behind it.
---

# Surface triage (the page disagrees with the record)

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

A record in this archive is published twice: once as a **projection** in
`published.release_entities`, which is what the entity page reads, and once as a **search doc**
in `published.search_index`, which is what `/records`, `/explore`, search, and every facet read.
The release builder writes both. Anything that writes one without the other, or writes one from
a stale idea of the other, produces exactly this class of bug: a page that knows the answer next
to a list that does not.

Treat "showing no X" as a claim about **one surface**, never about the catalog, until measured.

## Intake: five lines before any code

An operator report usually arrives shorter than this. Fill the gaps yourself from the running
site rather than asking, but write them down before you start, because each one narrows the
search:

1. **Surface + URL.** The exact page, with its query string. `/records?kind=invention` is a
   different reader from `/entity/{id}`, and the whole bug usually lives in that difference.
2. **The literal string on screen.** Quote it. `"Place not recorded"` greps straight to
   `build-records-index.ts`. A paraphrase greps to nothing. This is the single highest-value
   line in the report.
3. **Expected value, for one named record.** "`inv_latimer_carbon_process` should read New York,
   New York."
4. **Counter-evidence that narrows it.** Usually: the same record's entity page is correct. That
   one observation converts "data is missing" into "a writer or reader is dropping it" and skips
   an entire research detour.
5. **Authority and done.** Identify whether authorization covers code, published rows or
   activation, and whether done means a proposed fix or the verified live page. Reuse explicit
   session authorization; ask only for a consequential action not already covered.

## Decision order

Work outward from the data. Stop at the first layer that is wrong.

1. **Is it in the projection?** Query `release_entities.projection` for the field, joined to
   `active_release`. If it is absent here, this is a research or publish-gate problem and the
   surface may be faithfully displaying incomplete data. Route the missing fact to research;
   do not infer historical truth from agreement between database and page.
2. **Is it in the search doc?** Query `search_index` for the same records. **Measure per kind,
   across the whole release.** A kind sitting at 0% while its neighbors sit near 100% names the
   writer immediately: that cohort published through a path the others did not.
3. **Which half of the search row?** `search_index` has real columns (name, kind, status, topics,
   aliases, geohash, related_count, claim_count) and a `facets` jsonb blob. A field with no
   column exists _only_ in `facets`, and `upsertSearchIndex` writes `facets = EXCLUDED.facets`,
   a whole-object replace. A key a writer omits is therefore deleted from every row it touches
   again, silently, because `mapPostgresSearchIndexRow` defaults an absent facet instead of
   rejecting the row.
4. **Does the reader read what you think?** `packages/schemas/src/search-index-row.ts` is the one
   mapper for `apps/web`, `apps/api-public`, and the ops publisher. It **prefers the column and
   falls back to the facet**. Confirm against the file, not against a comment: at least one
   repair script still documents a reader behavior that has since been consolidated away, and its
   drift count over-reports by thousands because of it.
5. **Is the page reading Postgres at all?** This is the step that costs the most time when it is
   skipped, because every layer below it can be correct while the site shows the old value.
   Production sets `APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL`, and `shouldPreferReleaseArtifacts`
   then serves prebuilt `entities.json` / `search-index.json` from the CDN instead of the
   database. The staleness guard only checks that the artifact's `releaseId` matches the live
   active-release pointer — and an in-place backfill does not change the release id, so a stale
   artifact passes that check and keeps serving. **Any ops-data backfill must be followed by a
   authorized run of `publish-release-catalog-artifacts.ts` under the current publication
   contract in CLAUDE.md. Do not dispatch a redundant workflow or assume a schedule will
   repair it.** Verify the artifact itself, not just the database:
   `…/storage/v1/object/public/public-media/public/releases/{releaseId}/search-index.json`.
6. **Is the page just stale?** Only after the artifact is confirmed current. `release-scoped-cache.ts`
   holds release-wide reads for 30 minutes and does not watch the database, so a correct fix shows
   an unchanged page for up to half an hour after the artifact republishes. Note this is a
   _second_ layer, not an alternative explanation to the artifact one — reaching for it first is
   how you end up waiting half an hour for a cache that was never the problem.

## Verify below the cache

Never conclude from the live page alone while the TTL is open, and never report "fixed" on a
database read alone either. Prove the composed value the reader would produce: pull the real rows
and run them through the real mapper and the real surface builder in one short script.

```
cd apps/web && set -a && . ./.env.local && set +a && export DATABASE_SSL=1
node --conditions development --import tsx <script>.mts
```

That answers "does the code now produce the right string" immediately. Then confirm the live page
separately once the TTL lapses, and report the two facts as two facts.

## Repairing published rows

Prefer a **facet copy from the projection** over a republish. The projection is already correct,
so a copy needs no builder run and cannot alter prose, claims, status, or geometry; a republish
rebuilds all of it to fix a facet. `backfill-search-facets-projection.ts` takes `FACET_KEYS` and
`KIND` and carries the guardrails; the four single-key siblings predate it. Whichever you run,
the job is not finished when the rows are written. Follow the catalog-artifact publication
path in step 5, then verify the artifact and live surface. Database repair alone is not a
verified public correction.

Every one of these scripts rests on the drift being **one-directional** — the projection set, the
facet empty, and nothing set on both sides that disagrees. That is not a formality. Verify it per
key on the population you intend to touch. When both sides hold materially different values,
compare evidence and publication revision before selecting either one. The projection is not
inherently true merely because it is populated.

## Distinguish stale subsets from conflicting assertions

1. Compare arrays as sets. A strict subset is a candidate stale snapshot; verify which
   reviewed revision is current before copying it. A larger set may contain unsupported data.
2. Check evidence for every added inclusion basis. Empty `evidenceIds` is an evidence gap;
   do not synchronize it into a new surface merely to eliminate drift.
3. Research true differences. Distinguish a missing supported assertion from a richer but
   unsupported formulation, an altered qualifier or testimony presented as settled fact.
4. Measure the current population and keep the query/result with the repair. Counts from an
   old incident are examples, not evidence about today's release.

## Do / Never

- **Do** measure per kind before believing a fix is scoped to one cohort. The reported kind is
  usually the visible tip of a wider population.
- **Do** fix the writer, not just the rows. A backfill that runs against a writer still dropping
  the key buys one release cycle. That is exactly why the jurisdiction backfill had to exist twice.
- **Do** bind a regression test to the real reader, not to a literal. A round-trip through
  `mapPostgresSearchIndexRow` fails when someone adds a reader key and forgets the writer; an
  assertion against a hand-written object does not.
- **Never** widen a repair past the measured, guardrail-clean subset because the query was easy to
  widen. Scope it by kind, state what you left, and file the rest.
- **Never** write `''` where a value is absent. An empty string satisfies the reader's
  `typeof === 'string'` check and publishes a blank over a value some earlier pass got right.
  Omit the key.
- **Never** infer that all readers see a fix from one fresh response. Verify the artifact,
  release identity and relevant cache behavior; report any cache window still outstanding.
- For interaction, accessibility or mobile usability defects, use `blackstory-experience-review`;
  agreement between data layers does not prove an interface is usable.
