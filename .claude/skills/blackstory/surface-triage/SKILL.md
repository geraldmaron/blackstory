---
name: blackstory-surface-triage
description: Use when a published surface shows something the record's own data contradicts — a list column reading "Place not recorded" over a record whose page prints a city, a facet that misses records that carry the value, a count that disagrees with the catalog. Triggers on "the inventions in prod are showing no location", "the site says X but the record says Y", "these records are missing Z on /records but not on their page". Not for a record whose data is genuinely absent (that is research, see blackstory-entity-complete), and not for a layout or styling bug with no data claim behind it.
---

# Surface triage (the page disagrees with the record)

A record in this archive is published twice: once as a **projection** in
`bb_public.release_entities`, which is what the entity page reads, and once as a **search doc**
in `bb_public.search_index`, which is what `/records`, `/explore`, search, and every facet read.
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
5. **Authority and done.** May you change code? Write `bb_public`? Is done the merged fix, the
   repaired rows, or the live page? Ask once, up front. Finding out mid-task costs a stall.

## Decision order

Work outward from the data. Stop at the first layer that is wrong.

1. **Is it in the projection?** Query `release_entities.projection` for the field, joined to
   `active_release`. If it is absent here, this is a research or publish-gate problem and the
   surface is telling the truth. Stop.
2. **Is it in the search doc?** Query `search_index` for the same records. **Measure per kind,
   across the whole release.** A kind sitting at 0% while its neighbors sit near 100% names the
   writer immediately: that cohort published through a path the others did not.
3. **Which half of the search row?** `search_index` has real columns (name, kind, status, topics,
   aliases, geohash, related_count, claim_count) and a `facets` jsonb blob. A field with no
   column exists *only* in `facets`, and `upsertSearchIndex` writes `facets = EXCLUDED.facets`,
   a whole-object replace. A key a writer omits is therefore deleted from every row it touches
   again, silently, because `mapPostgresSearchIndexRow` defaults an absent facet instead of
   rejecting the row.
4. **Does the reader read what you think?** `packages/schemas/src/search-index-row.ts` is the one
   mapper for `apps/web`, `apps/api-public`, and the ops publisher. It **prefers the column and
   falls back to the facet**. Confirm against the file, not against a comment: at least one
   repair script still documents a reader behavior that has since been consolidated away, and its
   drift count over-reports by thousands because of it.
5. **Is the page just stale?** `release-scoped-cache.ts` holds release-wide reads for 30 minutes,
   and ops repair scripts upsert under the same release id without bumping `activated_at`. So a
   correct fix shows an unchanged page for up to half an hour. This is documented behavior, not
   a failed fix.

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
`KIND` and carries the guardrails; the four single-key siblings predate it.

Every one of these scripts rests on the drift being **one-directional** — the projection set, the
facet empty, and nothing set on both sides that disagrees. That is not a formality. Verify it per
key on the population you intend to touch. `notabilityBasis` and `notabilityLabels` each have 52
rows where both sides are set and disagree, which is 52 records disagreeing about why they are in
the archive. Picking a winner there is an editorial ruling, not a data sync.

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
- **Never** report the live page as proof while the 30-minute TTL is open.
