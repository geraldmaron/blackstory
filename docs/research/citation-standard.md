# What counts as a citation

The editorial question this settles: may a claim in the catalog rest on Wikipedia?

It kept getting answered two different ways. The research passes have been rejecting Wikipedia
outright, which is why some records came out thin. Meanwhile the active release already carries
about 2,200 Wikipedia-cited claims across 549 entities. A rule applied in one lane and not the
other is not a standard — it just means a record's depth depends on who last worked on it.

The code already had the right answer and nobody had written it down.

## The rule

Wikipedia is a **reputable secondary source**. It may carry a claim. It may never be the thing
that corroborates one, and it may never be the sole basis for a superlative.

This is what `packages/ops-data/scripts/lib/confidence.ts` and `lib/tier1-sources.ts` already
implement:

- `classifySourceForConfidence` maps Wikipedia to `reputable_secondary` — a real classification,
  not a rejection.
- `isWikipediaHost` excludes it from every corroboration path in `corroborate-source.ts`.
  Wikipedia is a *bridge* to Tier-1 references, never returned as evidence itself.
- Because a Wikipedia-only claim has one lineage, the confidence formula caps it below
  `standardPublish` (0.75) on its own. It clears only when an independently-fetched source with a
  different `lineageRootId` backs it.

So the ban was stricter than the project, and the 2,200 existing citations are not violations.
Both halves of the inconsistency were wrong in the same direction: treating the citation as a
binary permit instead of a weight.

## Superlatives are the exception, and here is why

"First African American to…" is the highest-risk sentence type in this catalog and the one
readers quote. It gets no Wikipedia-only pass.

The case that forced this: William F. Penn's summary said he was the first African American to
graduate from Yale Medical School, in 1897, on Wikipedia's authority. Yale says the first was
Cortlandt Van Rensselaer Creed, MD 1857 — also the first person of African descent to take a Yale
degree in any discipline. Penn was thirty years later. Yale's own exhibit on early Black students,
which had every reason to say "first" if it were true, does not.

That claim was false for years and cited. A superlative needs the institution that would know:
the school, the association, the state, the archive holding the record.

## In practice

| Situation | What to do |
|---|---|
| Wikipedia is the only source | Write the claim, `confidenceLevel: 'low'`, one lineage. Do not put it in the summary. |
| Wikipedia plus an independent institutional source | Cite the institution; set `independentLineageCount: 2`. Summary is fine. |
| A "first" / "only" / "largest" | Institutional source or the assertion does not ship. |
| Sources disagree on scope or date | Prefer the reading two independent sources share; record the dissent in the issue tracker rather than averaging it into prose. |

`confidenceLevel: 'low'` exists in the contract (`packages/public-contracts/src/v1/claim.ts`) and
is currently unused across the whole release — 9,043 `high`, 336 `medium`, zero `low`. A register
nothing is ever filed under is a register that is not being used honestly. Thin evidence should
look thin on the page, which is a better outcome than the record staying silent.

## Related

- [confidence-lineage.md](confidence-lineage.md) — how independent lineage is counted and scored.
- [citation-independence-review-signal.md](citation-independence-review-signal.md)
