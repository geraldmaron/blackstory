# Empty quadrant: place-indexed entity records

*History, pinned to place.* BlackStory is built for readers and researchers who need **entity
records on a map** — people, places, and events with coordinates, citations, confidence, and
archived captures — not a search box that sends you elsewhere. That architectural choice sits in a
gap most heritage portals do not fill.

## Four axes, one gap

When you compare Black history resources on four axes, a useful empty space appears:

| Axis | Question it answers |
|---|---|
| **Entity-shaped** | Is the primary unit a structured record (person / place / event), not just a catalog card? |
| **Place-indexed** | Does every public record carry honest map precision and a pin you can navigate? |
| **General Black history** | Is scope broader than a single corpus (e.g. slavery datasets only) or a single institution? |
| **Machine-queryable** | Can a developer or researcher retrieve records programmatically with stable fields? |

Many excellent projects occupy one or two cells:

- **Aggregation portals** (e.g. [Umbra Search](https://umbrasearch.org/), DPLA-backed discovery)
  excel at wide discovery but link out to host institutions rather than publishing entity records
  with captures.
- **Slavery and freedom corpora** (e.g. [Enslaved.org](https://enslaved.org/)) publish linked open
  data at a scale and specialization BlackStory does not attempt to replicate — but their lane is
  not general place-indexed Black history across eras and topics.
- **Institutional catalogs** preserve holdings but rarely expose place-indexed, cross-collection
  entity graphs tuned for map-first reading.

The **empty quadrant** is the overlap: general Black history, entity-shaped, place-indexed, and
eventually machine-queryable — with evidence you can still open when partner URLs move.

BlackStory aims for that overlap. We are **not there yet** on every axis: the public release is on
the order of thousands of place-indexed entities, capture coverage in production still lags our
architecture, and a queryable developer read surface ships only after quality gates — not before.

## Entity records vs aggregator pointers

Aggregators widen access. They also inherit **link rot** from every partner URL they do not host.

Field review in *The American Archivist* (April 2026) documents a familiar failure mode for
[Umbra Search](https://umbrasearch.org/): materials can remain visible in search results while
**outbound access links break** after a holding institution migrates its repository — Washington
and Lee University holdings were cited as an example. Umbra's grant funding concluded in 2017;
maintenance and expansion are less visible today. Link rot is structural to any portal that treats
URLs as permanent handles.

BlackStory's response is not "aggregators are bad." It is **evidence pinned to place with capture
pointers** — Wayback URLs or content-addressed rows in our evidence ledger — so a reader can
follow the citation without depending on the origin site staying online tomorrow.

| Posture | Aggregator pointer | BlackStory entity record |
|---|---|---|
| Primary unit | Search hit / catalog card | Person, place, or event with map pin |
| Evidence | Link to host institution | Capture pointer + excerpt + confidence |
| Link rot | Inherited from partner URLs | Mitigated by archived capture requirement |
| Scope | Broad discovery | Curated, place-indexed records — growing, not complete |

Deeper contrast and ops detail: [`capture-and-aggregators.md`](./capture-and-aggregators.md).

## Enslaved.org and complementary corpora

[Enslaved.org](https://enslaved.org/) and similar projects serve **slavery and freedom** datasets
with linked open data, person-event graphs, and LOD dumps at a scale oriented to that domain.
BlackStory does not compete on row count or try to subsume those corpora.

Our lane is **general Black history place-indexed entity records** with transparent provenance —
campus movements, institutions, cultural figures, local events, and documented sites across eras.
Where a record touches enslavement or freedom, it is cited and confidence-graded like any other
fact; we do not claim to be the national slavery-data hub.

Readers working primarily in slavery datasets should start with Enslaved.org and allied projects;
readers who need map-first, evidence-visible Black history across topics can use BlackStory as a
complementary surface.

## Capture posture

Every URL-backed citation in a public release is expected to carry an **archived capture pointer**
and a retrieval date. That is how we mitigate aggregator-style link rot without mirroring the open
web.

We measure readiness with a **capture completeness ops bar**: 95% of web citations in the active
release must meet the capture standard before we market a queryable developer surface. That bar is a
**quality gate**, not a boast about covering all of Black history. Production still catches up to
the architecture — treat records missing archived captures as not yet meeting our public evidence
standard.

Operators measure and backfill under bounded Save Page Now budgets; see
`docs/research/capture-completeness-ops-bar.md`.

## What we do not claim

- **Completeness.** BlackStory does not index "all" Black history. Absence on the map is not proof
  nothing happened — it may mean sources have not cleared the publish gate yet.
- **Substitute hosting.** We store pointers, excerpts, and hashes — not a mirror of every partner
  site.
- **Shipped API or MCP marketing.** A PostgREST read surface or public MCP layer is a **planned
  target gated by geo-integrity and capture completeness**, not a product you can rely on today.
  When it ships, it will expose **published views only** — never research drafts or canonical
  editorial tables.

## Further reading

- Captures and aggregators (Umbra contrast) — [`capture-and-aggregators.md`](./capture-and-aggregators.md)
- Capture completeness ops bar — `docs/research/capture-completeness-ops-bar.md`
- Landscape intake — `docs/research/black-history-data-landscape-intake.md`
- Umbra Search review — [American Archivist Reviews Portal, April 2026](https://reviews.americanarchivist.org/2026/04/09/umbra-search-african-american-history/)
- Brand language — `docs/ui/brand.md`
