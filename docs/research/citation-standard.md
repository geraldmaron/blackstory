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
- A Wikipedia-only claim contributes **no** corroborating lineage, so the formula caps it below
  `standardPublish` (0.75) on its own. It clears only when an independently-fetched source with a
  different `lineageRootId` backs it.

So the ban was stricter than the project, and the 2,200 existing citations are not violations.
Both halves of the inconsistency were wrong in the same direction: treating the citation as a
binary permit instead of a weight.

## What changed underneath the rule

The rule held; the machinery under it got more honest. Three parts:

- **A lineage is a work, not a domain.** `resolveSourceLineage`
  (`packages/domain-core/src/claims/lineage.ts`) resolves recorded provenance first, then a work
  identifier read out of the URL (patent number, DOI, LOC item, Chronicling America issue, NARA
  catalog id), then the bridge key, then the issuing authority behind the host. A patent read at
  the Patent Office and at a mirror is now one lineage; five papers carrying one wire story are
  one lineage once the wire id is recorded. Host is metadata again.
- **A bridge contributes zero lineage and does not dilute real evidence.** Every Wikimedia
  spelling collapses onto one key, `bridge:wikimedia`. When a real source is present the bridge
  drops out of the quality aggregates entirely, so citing one can no longer *lower* a score. When
  the bridge is all there is, it stays in the aggregates: thin, not absent.
- **The numbers moved.** Wikipedia-only now scores **0.66** with `independentLineageCount: 0`,
  where a lone reputable-secondary host scores **0.72** with one lineage
  (`packages/ops-data/scripts/lib/confidence.test.ts`). Those two used to be the same number,
  which was the tell: a bridge and a heritage-inventory record are not equally good evidence, and
  the old rule could not say so because it counted a hostname as a lineage. Both still sit under
  0.75; neither publishes alone.

## Fitness is claim-relative

Whether a citation is good enough is not a property of the source. It is a property of the
source *and the assertion it is attached to*. `assessSourceFitness(sourceClass, assertionClass)`
(`packages/domain-core/src/claims/source-fitness.ts`) answers that pair over 24 document kinds
and 15 assertion kinds, returning `authoritative`, `strong`, `conditional`, `leadOnly` or
`unfit` with a rationale and the document kind's known limitations.

A patent is the clearest case. It is `authoritative` for what was filed, by whom, and when, and
for the mechanism it claims. It is `unfit` as evidence that the filer was Black: the Patent
Office did not record inventor race, which is why Henry E. Baker had to identify Black inventors
through correspondence and professional networks instead. It is also `unfit` for a superlative
and for commercial or societal impact, and `leadOnly` for place, because the address on a patent
is where the filer was, not where the work happened. `unfit` scores zero authority rather than a
small number, so unfit sources cannot pile up into a supported claim.

The practical rule for a citation: name what the claim asks of the document before deciding the
citation is enough. "Cited to a `.gov`" is not an answer to that question.

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
| Wikipedia is the only source | Write the claim, `confidenceLevel: 'low'`, `independentLineageCount: 0`. Do not put it in the summary. |
| Wikipedia plus an independent institutional source | Cite the institution. The bridge adds no lineage, so this is one lineage, not two. Summary is fine when the institution is fit for the assertion. |
| A "first" / "only" / "largest" | Institutional source or the assertion does not ship. |
| The source is authoritative for a different question than the claim asks | Rewrite the claim to what the document actually settles, or find the document that settles the claim. A patent is not evidence of race, of firstness, or of adoption. |
| Sources disagree on scope or date | Prefer the reading two independent sources share; record the dissent in the issue tracker rather than averaging it into prose. |

`confidenceLevel: 'low'` exists in the contract (`packages/public-contracts/src/v1/claim.ts`) and
is currently unused across the whole release — 9,043 `high`, 336 `medium`, zero `low`. A register
nothing is ever filed under is a register that is not being used honestly. Thin evidence should
look thin on the page, which is a better outcome than the record staying silent.

## Citations are not research depth

How well a claim is cited and how well a record is researched are different measurements taken
with different instruments. `assessResearchMaturity`
(`packages/domain-core/src/research/maturity.ts`) derives a record's depth as one of six states,
`seeded` → `grounded` → `corroborated` → `contextualized` → `deep_research` → `reference`, from
17 gates fed by 29 named deficits (`packages/domain-core/src/research/deficits.ts`). It cannot be
set by hand, only derived, and `reference` does not mean finished.

The rule that keeps the two from being confused: **adding a source must not clear a deficit by
itself.** A record can carry a citation on every sentence and still sit at `seeded`, because the
gates count lineages, fitness and selectors rather than URLs. Display completeness is a third
measurement again, and a fully populated record can be entirely unresearched. See
[entity-completeness-audit.md](entity-completeness-audit.md).

## Related

- [confidence-lineage.md](confidence-lineage.md) — how independent lineage is counted and scored,
  how claim-relative fitness works, and how research maturity is derived.
- [citation-independence-review-signal.md](citation-independence-review-signal.md)
- [entity-completeness-audit.md](entity-completeness-audit.md) — display completeness, which is a
  different question from either of the above.
