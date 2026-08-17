---
name: blackstory-entity-verify
description: Confirms which entity a record is, sources a period-honest place, sets precision, and assigns era. Use when verifying location, confirming time period, resolving homonyms, finding a pin, checking period of significance, or asking which Bethel AME / Clinton High / Charles Young this is. Not Census geocoding of an already-sourced address.
---

# Entity verify (identity, place, period)

Judgment playbook. Commands live in
[`docs/research/research-operations.md`](../../../../docs/research/research-operations.md).
Do not load `perspectives/researcher` or `docs/research-workflow` recency rules here.
Archival sources are supposed to be old.

`locate` geocodes a sourced address. This skill finds and confirms the facts that make that
address, precision, and era honest.

## Order

1. **Identity** (which namesake)
2. **Place** (source a site, then geocode)
3. **Period** (activity / event, not designation)
4. **Gate** (bbox / geo-integrity, coarsen, report)

Stop at the first unresolved step. An unmatched identity is not a pin to invent.

## Identity

```
Task:
- [ ] Kind matches (person / place / school / org / event / …)
- [ ] Place and years separate this namesake from others
- [ ] Ambiguous Wikidata/LCNAF candidates left unmatched
```

Homonyms are normal. The reconciliation queue
(`docs/research/entity-reconciliation-review-queue.md`) exists because "Clinton High School"
and "Charles Young" are many records. Pick nothing unless kind + place + years collapse to one
candidate.

**Do:** leave `no_match` rather than guess; treat Wikidata as a candidate list; withhold
living residential addresses (unknown living = living).

**Never:** take the first QID; merge two real people or schools because the names match;
use a painting, interview NAID, or sports-player stub as the entity.

## Place

Source an address or named place from a custodian, then run `locate`. Source ladder, in order:

1. The institution or NPS/NRHP site record
2. State encyclopedia / SHPO / local historic preservation office
3. Period map, directory, or finding aid that names the site in the relevant years
4. Wikidata P625 only as enrichment, never as publish-time truth

Pin kind is part of the fact. Default to the *site of the history*, not a birthplace, grave,
or modern HQ, unless the record is about that other anchor.

Precision (from the locate verb; no LLM, ever):

| Evidence | Precision | Drift cap |
|---|---|---|
| Street number | `institution` | ≤150m |
| Named campus/place | `campus` | ≤500m |
| Neighborhood / district | `neighborhood` | ≤1600m |
| City only | `city` | do not sharpen |

Dignity: no residential precision on living people; a coarsened point is never labeled as an
exact address; parent-site snaps cap at 15km, otherwise keep the pin and downgrade precision.
Never snap to a US state or city centroid.

When you have a sourced address, use [`blackstory-locate`](../locate/SKILL.md). Batch audits:
`packages/firebase/scripts/audit-entity-locations.ts`,
`packages/firebase/scripts/enrich-entity-locations.ts`.

**Never:** invent coordinates; invent a street so Census will "confirm" it; call Nominatim from
product `/locate`; use live geocoders at publish time.

## Period

`resolveEraEvidence` in `@repo/domain-core/era` (consumed by web/mobile anatomy) already
refuses to treat a National Register listing year as when the history happened. Honor that.

Separate these dates. Do not mash them into one chip:

| Kind | What it is | Public era? |
|---|---|---|
| Activity / event window | When the history happened | Yes, via `eraBuckets` |
| Lifespan | Birth / death | Only if the record is the person |
| Founding / demolition | Building lifecycle | When attested, not guessed |
| Period of significance | NRHP significance span | Yes, if the source states it |
| Designation / listing year | Administrative event | No (keep on the claim) |

A church listed in 2001 with no other dated claim has an undocumented era. That is the honest
answer until a period of significance is ingested.

Intake `--era` is an unverified label. Do not treat it as confirmed.

## Gate

After a pin exists:

1. Declared `stateCode` must contain the WGS84 point
   (`docs/research/geo-integrity-gate.md`, `evaluateGeoIntegrityPublishGate`).
   Mismatches are an audit list. Do not auto-rewrite coordinates to pass.
2. Catalog fixtures: `packages/firebase/scripts/qa-catalog-fixtures.ts` (state-bbox +
   precision decimals).
3. Re-publish so projections pick up `EntityLocation` overrides. This skill still cannot
   promote. That is a separate publication-role action.

## Output

For each entity report:

- identity: matched / unmatched / needs-human, with the disambiguators used
- place: sourced address or named place, source URL, proposed precision
- locate: dry-run JSON (`decision.action`), or skipped if no sourced address
- era: buckets + which date class each year came from
- blockers: missing identity, unsourced site, designation-only dates, geo mismatch

## Related

- CLI locate: [`docs/research/research-operations.md`](../../../../docs/research/research-operations.md#locate)
- Completeness (images, related, context): [`blackstory-entity-complete`](../entity-complete/SKILL.md)
- Corroboration of claims: [`blackstory-claim-corroborate`](../claim-corroborate/SKILL.md)
- Gold-corpus geographic-ambiguity cases: [`docs/research/gold-corpus.md`](../../../../docs/research/gold-corpus.md)
