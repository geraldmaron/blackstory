---
title: Research methodology
description: How claims, evidence, and confidence reach a publishable record.
nav: concepts
order: 3
---

# Research methodology

BlackStory pins history to place. A publishable record needs claims, evidence,
provenance, and confidence, not assertion alone.

For the human case behind these rules, read [Why BlackStory](./about.md).

## Principles

1. **Evidence before assertion.** Public prose cites released evidence.
2. **Place is first-class.** Locations carry precision; coarsened points are
   never labeled as exact addresses.
3. **Confidence is visible.** Uncertainty is glyph-encoded; color is never the
   only signal.
4. **Living-person care.** Unknown living status is treated as living; no public
   residential addresses.
5. **Promotion gate.** Research and LLM enrichment cannot publish. Human and
   policy gates promote released projections only.
6. **Juxtaposition is not causation.** Context indicators beside a law or place
   are published measurements for comparison, not automated proof of policy
   impact.

## Pipeline (high level)

```
discovery adapters
        ↓
 quarantine / triage
        ↓
  research cases
        ↓
claims · evidence · confidence lineage
        ↓
   promotion gate
        ↓
 released public projection
```

Operating detail lives in the repository under `docs/research/` and
`docs/methodology/`.

## Landscape: entity records, not aggregator pointers

Most Black history portals excel at **discovery**: one search across hundreds of
institutions. They often link out to host sites rather than publishing **entity
records** with map pins, citations, and archived captures. When a holding
institution migrates its repository, those outbound links can break. Field
review of [Umbra Search](https://umbrasearch.org/) in *The American Archivist*
(April 2026) documents that failure mode.

BlackStory's primary unit is different: a **place-indexed entity record**
(person, place, or event) with evidence you can still open when the origin site
moves. Wayback URLs or content-addressed capture pointers, plus confidence
grades and honest map precision.

Specialized corpora such as [Enslaved.org](https://enslaved.org/) serve slavery
and freedom datasets at a scale and focus we do not replicate. Our lane is
**general Black history** across topics and eras, curated and growing. Not
complete. Not a substitute for domain-specific archives.

## Juxtaposition, not causation

Users will ask what a law or policy *did* to Black communities in a place.
Academic-grade answers require evidence. Automated pipelines that emit "Policy Z
caused incarceration to rise X%" invent causation BlackStory must not publish.

Allowed shapes:

| Shape | Allowed language |
|-------|------------------|
| Law / case entity with evidenced claims | Enacted, overturned, challenged |
| Place-time indicator | In year Y, the published rate for Black residents in jurisdiction S was R (source…) |
| Derived ratio / gap | Black-White rate ratio was V in year Y, with formula and input ids |
| Juxtaposition binding | Shown beside these indicators for the same jurisdiction and era, for context, not as proof of effect |
| Causal claim | Only as a heritage claim with peer-reviewed or equivalent citation |

When a binding is shown, the product includes a fixed disclaimer: context
indicators are published measurements from named custodians. Showing them with a
law or place does not establish that the law caused the indicator values.

## Quality before breadth claims

We do not claim to index all Black history. Absence on the map is not proof
nothing happened. It may mean sources have not cleared the publish gate yet.

URL-backed citations are expected to carry **archived captures** before they
meet our public evidence standard. A capture completeness bar (95% of web
citations in the active release) gates when we market a queryable developer read
surface. That bar measures evidence readiness, not coverage of the field.

A machine-queryable public API or MCP layer is a **planned target**, not a
shipped product today. When it ships, it will expose published records only.

## Related repository docs

- Empty quadrant and aggregator contrast: `docs/methodology/empty-quadrant-and-aggregators.md`
- Captures and Umbra detail: `docs/methodology/capture-and-aggregators.md`
- Juxtaposition rules: `docs/methodology/juxtaposition-not-causation.md`
- Capture completeness ops bar: `docs/research/capture-completeness-ops-bar.md`
- Context indicator catalog: `docs/research/context-data-source-matrix.md`
