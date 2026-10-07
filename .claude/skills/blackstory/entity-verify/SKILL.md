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
(`docs/research/README.md`) exists because "Clinton High School"
and "Charles Young" are many records. Pick nothing unless kind + place + years collapse to one
candidate.

**Do:** leave `no_match` rather than guess; treat Wikidata as a candidate list; withhold
living residential addresses (unknown living = living).

**Never:** take the first QID; merge two real people or schools because the names match;
use a painting, interview NAID, or sports-player stub as the entity.

## Place

Source an address or named place for the relevant activity and period, then run `locate`.
The following are retrieval starting points, not a truth hierarchy. Local/community
records or period sources may correct a modern institutional page:

1. The institution or NPS/NRHP site record
2. State encyclopedia / SHPO / local historic preservation office
3. Period map, directory, or finding aid that names the site in the relevant years
4. Wikidata P625 only as enrichment, never as publish-time truth

Pin kind is part of the fact, and which anchor is correct depends on what kind of record this
is:

- **Place, event, or any other non-person record:** default to the _site of the history_ —
  not a birthplace, grave, or modern HQ — unless the record is specifically about that other
  anchor.
- **`kind:person` record:** birthplace is the current catalog convention, not a
  claim that all their history happened there. Name the anchor explicitly. A documented
  residence or workplace can be used when appropriate and labeled as such; a biography
  spans places. Keep `jurisdictionLabel`, coordinates and displayed anchor consistent.
  Do not choose a more precise but less relevant address merely to fill a map.

Whichever anchor applies, never invent one to fill the gap — an unsourced anchor is a missing
pin, not a guessed one.

Precision must follow the historical evidence as well as the geocoder result. A precise
match to a modern address does not prove that the historical event occurred there.
Existing locate precision/drift limits:

| Evidence                | Precision      | Drift cap      |
| ----------------------- | -------------- | -------------- |
| Street number           | `institution`  | ≤150m          |
| Named campus/place      | `campus`       | ≤500m          |
| Neighborhood / district | `neighborhood` | ≤1600m         |
| City only               | `city`         | do not sharpen |

Dignity: no residential precision on living people; a coarsened point is never labeled as an
exact address; parent-site snaps cap at 15km, otherwise keep the pin and downgrade precision.
Never replace a documented site with a centroid to make a jurisdiction check pass.
A sourced city-only anchor may use a representative city point at `city` precision
with approximation and anchor meaning visible. It is not an exact birthplace or event
site. If the surface cannot show that distinction, withhold the point or repair the
display; do not sharpen the stored precision. A centroid without sourced city membership
is still a guess.

When you have a sourced address, use [`blackstory-locate`](../locate/SKILL.md).
For batch proposals, inspect `packages/ops-data/scripts/backfill-location-coordinates.ts`
and its dry-run output before applying any correction.

**Never:** invent coordinates; invent a street so Census will "confirm" it; call Nominatim from
product `/locate`; use live geocoders at publish time.

## Period

`resolveEraEvidence` in `@repo/domain-core/era` (consumed by web/mobile anatomy) already
refuses to treat a National Register listing year as when the history happened. Honor that.

Separate these dates. Do not mash them into one chip:

| Kind                       | What it is                | Public era?                      |
| -------------------------- | ------------------------- | -------------------------------- |
| Activity / event window    | When the history happened | Yes, via `eraBuckets`            |
| Lifespan                   | Birth / death             | Only if the record is the person |
| Founding / demolition      | Building lifecycle        | When attested, not guessed       |
| Period of significance     | NRHP significance span    | Yes, if the source states it     |
| Designation / listing year | Administrative event      | No (keep on the claim)           |

A church listed in 2001 with no other dated claim has an undocumented era. That is the honest
answer until a period of significance is ingested.

Intake `--era` is an unverified label. Do not treat it as confirmed.

## Gate

After a pin exists:

1. Declared `stateCode` must contain the WGS84 point
   (`docs/research/geo-integrity-gate.md`, `evaluateGeoIntegrityPublishGate`).
   Mismatches are an audit list. Do not auto-rewrite coordinates to pass.
2. Catalog fixtures: `evaluateGeoIntegrityPublishGate` with sourced jurisdiction polygons and
   precision checks.
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
