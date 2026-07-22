# Captures and aggregators

*History, pinned to place.* BlackStory is built around **entity records** — people, places, and
events with coordinates, evidence, and confidence — not a search box that sends readers elsewhere.
That difference matters when you compare this archive to aggregation portals.

## What BlackStory stores

Every published web citation is expected to carry an **archived capture pointer**: a Wayback URL
or a content-addressed row in our evidence ledger (`source_captures`), plus a retrieval date.
Readers can follow the evidence without depending on a third-party site staying online tomorrow.

We measure readiness with a **capture completeness ops bar** (95% of URL-backed citations in the
active release must meet that standard before we market a queryable developer surface). That bar
is a quality gate, not a boast about covering all of Black history.

## Aggregators: what they do well

Portals such as [Umbra Search: African American History](https://umbrasearch.org/) excel at
**discovery** — one search across hundreds of institutions, sample searches, classroom-friendly
entry points, and no paywall. Umbra draws heavily from the Digital Public Library of America and
similar partners; it has earned recognition for widening access to digitized materials.

If you need a wide net across already-digitized collections, aggregators remain useful tools.

## Where aggregators fray

Field review in *The American Archivist* (April 2026) documents a familiar failure mode: Umbra
**does not host the underlying files**. It links out. When a holding institution migrates its
repository, those outbound links can break — the reviewer found Washington and Lee University
materials visible in Umbra with **no working access links** after a migration. Link rot is not
unique to Umbra; it is structural to any aggregator that treats URLs as permanent handles.

Sustainability adds another layer. Umbra's grant funding concluded in 2017; ongoing maintenance
and expansion are less visible today. A resource can remain valuable while its long-term reliability
is uncertain.

BlackStory's response is not "aggregators are bad." It is **evidence pinned to place with captures
you can still open when the origin site moves**.

| Posture | Aggregator (e.g. Umbra) | BlackStory |
|---|---|---|
| Primary unit | Search hit / catalog card | Entity record with map pin |
| Evidence | Link to host institution | Capture pointer + excerpt + confidence |
| Link rot | Inherited from every partner URL | Mitigated by archived capture requirement |
| Scope claim | Broad discovery | Curated, place-indexed records — growing, not complete |

## Enslaved.org and other corpora

[Enslaved.org](https://enslaved.org/) and similar projects serve **slavery and freedom** datasets
with linked open data at a scale BlackStory does not attempt to replicate. Our lane is general
Black history **place-indexed entity records** with transparent provenance — complementary, not
competing on row count.

## What we do not claim

- **Completeness.** BlackStory does not index "all" Black history. We publish what passes evidence
  and dignity gates — currently on the order of thousands of release entities, not millions of
  aggregated links.
- **Substitute hosting.** We delegate full-page preservation to the Internet Archive where
  possible; we store pointers, excerpts, and hashes — not a mirror of the open web.
- **API marketing before quality.** A queryable PostgREST or MCP surface ships only after geo-integrity
  and capture-completeness bars are met (see research ops memo:
  `docs/research/capture-completeness-ops-bar.md`).

## How to read a BlackStory record

1. **Place first** — map pin reflects stored precision; coarsened points are labeled honestly.
2. **Evidence visible** — citations show source, excerpt, capture link, retrieval date.
3. **Confidence encoded** — dispute and uncertainty stay attached; we do not flatten contested
   history into a single certain sentence.

If a record lacks an archived capture on a web source, treat it as **not yet meeting our public
evidence standard** — regardless of whether the entity appears in a release snapshot.

## Further reading

- Empty quadrant and landscape position — [`empty-quadrant-and-aggregators.md`](./empty-quadrant-and-aggregators.md)
- Umbra Search review — [American Archivist Reviews Portal, April 2026](https://reviews.americanarchivist.org/2026/04/09/umbra-search-african-american-history/)
- Capture ops bar — `docs/research/capture-completeness-ops-bar.md`
- Landscape intake — `docs/research/black-history-data-landscape-intake.md`
- Brand language — `docs/ui/brand.md`
