# Wikidata place-first portfolio query packs

**Bead:** `repo-2ztn.8` (WS7)  
**Portfolio wave:** [`repo-tt2u.8`](../.beads/issues.jsonl) — source portfolio wave one  
**Intake rejection:** [`black-history-data-landscape-intake.md`](./black-history-data-landscape-intake.md) §3.2

Structured Wikidata discovery candidates for the source portfolio without identity-essentializing SPARQL. Query packs are place-first or authority-first; **P172 (ethnic group) alone is rejected as a primary harvest strategy.**

## Rejected strategy

| Approach | Verdict | Why |
|---|---|---|
| Mass SPARQL filtering on `wdt:P172` (ethnic group: African American) | **Reject as primary** | Dignity/methodology risk — essentializes identity and bypasses place/authority evidence |

The domain module exposes `REJECTED_ETHNIC_GROUP_ONLY_SPARQL_EXAMPLE` and `assertPlaceFirstSparqlValid()` so compiled queries cannot ship without a place or authority anchor (`P19`, `P937`, `P131`, `P649`, or `P1435`).

## Domain API (`@repo/domain` → `query-packs/wikidata-place-first/`)

Parent agent merges `packages/domain/src/query-packs/wikidata-place-first/index.ts` into the query-packs barrel (not the package root barrel in this bead).

| Module | Purpose |
|--------|---------|
| `types` | Strategy enum, pack spec, compiled query, dry-run, fixture response types |
| `constants` | Portfolio wave bead id, adapter source id, rejection note |
| `guards` | Reject ethnic-group-only SPARQL; document rejected example |
| `seeds` | US-state and occupation Wikidata QID seeds |
| `packs` | Versioned `QueryPack` definitions (`buildQueryPack`) |
| `sparql-compiler` | Compile place-first / authority-first SPARQL (fixture mode) |
| `dry-run` | Reviewable compiler output without live Query Service calls |
| `fixture-parser` | Parse fixture JSON responses |

## Versioned query packs

| Pack id | Strategy | Entity kind | Theme | Anchor |
|---|---|---|---|---|
| `qp-wikidata-person-place-occupation` | `person_place_occupation` | `person` | `civil_rights` | Birth/work place in seeded US state (`P19` / `P937` + `P131*`) + occupation (`P106`) |
| `qp-wikidata-place-nrhp-linked` | `place_nrhp_linked` | `place` | `historical_place` | NRHP reference number (`P649`) within seeded US state (`P131*`) |

Each pack carries semver, `contentHash`, and `versionId` per [`query-packs.md`](./query-packs.md). Discovery runs stamp the composite version id via the shared query-pack contract.

### Initial geographic seeds

Deep South portfolio wave (expand per campaign):

- Alabama (`Q173`)
- Georgia (`Q1428`)
- Mississippi (`Q1494`)

Occupation seeds for `person_place_occupation` (examples): civil rights activist (`Q82955`), educator (`Q37226`), minister (`Q42603`).

## Fixture mode (no live mass SPARQL)

This bead ships **fixture SPARQL results and dry-run compiler output only**. Do not execute compiled queries against `query.wikidata.org` until:

1. Source-policy approval under `repo-tt2u.8`
2. Campaign budgets and rate limits are registered
3. Adapter kill-switch posture matches other disabled-by-default portfolio sources

Fixtures:

| File | Role |
|---|---|
| `fixtures/person-place-occupation-sparql-response.v1.json` | Sample Query Service JSON for person/place/occupation strategy |
| `fixtures/place-nrhp-linked-sparql-response.v1.json` | Sample Query Service JSON for NRHP-linked places |
| `fixtures/dry-run-compiled-queries.v1.json` | Summary of compiled query counts for review |

Dry-run in tests or locally:

```typescript
import { buildWikidataPlaceFirstDryRun } from '@repo/domain/query-packs/wikidata-place-first';

const dryRun = buildWikidataPlaceFirstDryRun({
  compiledAt: new Date().toISOString(),
});
// dryRun.queries — 12 fixture-mode SPARQL strings (3 states × 3 occupations + 3 NRHP)
// dryRun.portfolioWaveBead === 'repo-tt2u.8'
```

Run tests (fixture-driven):

```bash
node --conditions development --import tsx --test \
  packages/domain/src/query-packs/wikidata-place-first/wikidata-place-first.test.ts
```

## Relation to source portfolio wave (`repo-tt2u.8`)

These packs feed **wave one** of the curated source portfolio alongside NRHP MPL (`repo-2ztn.6`), Chronicling America (`repo-2ztn.7`), and DPLA gap analysis (`repo-2ztn.9`). Wikidata candidates remain **secondary reference** tier until relevance, capture, and publish gates pass — same posture as the existing Wikimedia adapter ([`wikimedia-adapter.md`](./wikimedia-adapter.md)).

## Acceptance mapping

| Criterion | Implementation |
|---|---|
| Place-first / authority-first packs | `person_place_occupation`, `place_nrhp_linked` strategies + versioned `QueryPack`s |
| Explicit rejection of ethnic-group-only harvest | `ETHNIC_GROUP_ONLY_HARVEST_REJECTION`, guards, rejected SPARQL example |
| Fixture outputs | JSON fixtures + `buildWikidataPlaceFirstDryRun` |
| Links to `repo-tt2u.8` | `WIKIDATA_PLACE_FIRST_PORTFOLIO_WAVE_BEAD`, doc header |
| Tests | `wikidata-place-first.test.ts` |
| File headers | All modules |

## Deferred (not this bead)

- Live Wikidata Query Service HTTP client
- Discovery pipeline integration (`stampDiscoveryRun` wiring)
- Firestore persistence for pack effectiveness metrics
- Registry UI approval for `src_wikidata` portfolio campaigns
