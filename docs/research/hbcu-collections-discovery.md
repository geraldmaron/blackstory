# HBCU Special Collections discovery

Discovery methodology for HBCU special collections and university archives — Howard's Moorland-Spingarn Research Center, Fisk's John Hope and Aurelia E. Franklin Library, Tuskegee's University Archives, Hampton's University Archives, and the cross-institution HBCU Library Alliance Digital Collection. These repositories are among the richest Black history sources in existence and are largely **absent from federal aggregator databases**: some surface through DPLA hubs, others only through standalone EAD finding aids or local digital repositories. Discovery produces **private research candidates only** — never public entities (ADR-009).

## Doctrine: scholarly class, strong for synthesis — still evidence before assertion

Research-kernel profile `packages/research-kernel/profiles/black-history.v1.json` maps sourceClass `scholarly` → claimClass `historical-synthesis` → fitness **`strong`**, with the limitation "Capture cited primary evidence for consequential atomic claims where available." University special collections are that source class, so:

- `registerHbcuCollectionSource` wraps `registerSource` with research-kernel `sourceClass: 'scholarly'` (constants + contract notes carry it; `HBCU_COLLECTIONS_SOURCE_CLASS`).
- Evidence-source classification is the constitution token `primary_archival` — finding aids describe primary archival holdings.
- "Strong" applies to the *institution's descriptive synthesis*, not to any downstream claim: candidates remain private leads until the normal claim/evidence/review pipeline runs. A finding-aid abstract is a pointer to evidence, not evidence itself.

## Invariants

| Invariant | Enforcement |
|-----------|-------------|
| Discovery cannot publish (ADR-009) | `assertCampaignCannotPublish()` at campaign entry; `assertDiscoveryCannotPublish` blocks `write_public_projection` / `create_public_entity` / `activate_release` / `publish_snapshot`; no public projection or release write paths anywhere in the module |
| Safe fetch only | `@repo/domain` performs **no network I/O**. The campaign is fixture-first (`dplaSearchJson` + injected `HbcuAdapter`); any live `HbcuAdapter` implementation MUST fetch exclusively through `@repo/security` safe-fetch (contract note on the interface) |
| Adapter disabled by default | `registerHbcuCollectionSource` ships `registryState: 'disabled'`; campaign approval (`approveSourcePolicy`) is run-scoped in-memory only, mirroring `archive-dpla-campaign.ts` |
| Rights / dignity | Rights default `unknown`; `full_text_republication`, `commercial_reuse`, `biometric_extraction` prohibited. Snippets capped to evidence-pointer limits (≤320 chars / ≤60 words). Forbidden payload keys include `streetAddress` / `residentialAddress` — living addresses never public. Bulk OCR, container-list text, and item bytes never persist |
| No fabricated URLs | Every `collectionUrl` / `findingAidBaseUrl` in the seed fixture is a real public portal verified reachable at seed time (2026-07-24); `parseHbcuCollectionSeeds` re-validates URL syntax on load |

## Modules

| Module | Purpose |
|--------|---------|
| `packages/domain/src/adapters/hbcu-collections/index.ts` | `HbcuCollectionSource` contract, `HbcuAdapter` port (`listFindingAids(institution)`, `extractCandidates(findingAid)`), `createHbcuCollectionsAdapterContract`, disabled-by-default `registerHbcuCollectionSource`, seed parser, snippet-capped candidate normalizer. Self-contained: deliberately does **not** import `finding-aid` (owned by the County Archive Ladder methodology); small shared shapes are duplicated locally |
| `packages/domain/src/adapters/hbcu-collections/fixtures/hbcu-collections.v1.json` | Seed roster: 5 real HBCU collections (Howard MSRC, Fisk Franklin Library, Tuskegee Archives, Hampton Archives, HBCU Library Alliance Digital Collection) with verified public URLs |
| `packages/domain/src/discovery/hbcu-campaign.ts` | `runHbcuCampaign` — dual-lane gather → classify → dedupe → obscurity ranking → yield summary. Mirrors `archive-dpla-campaign.ts` shape |
| `packages/domain/src/discovery/hbcu-campaign.test.ts` | Inline-fixture tests (no network): dual-lane yield, contributor filter, obscurity attachment, snippet caps, disabled registration, cannot-publish, seed-fixture validation |

## Campaign flow (`hbcu-collections-discovery.v1`)

1. `assertCampaignCannotPublish()` — fail closed before any work.
2. **DPLA hub lane** (tunes the existing community DPLA v2 adapter — never federal `dpla-items-v1`): `parseDplaSearchResponse` → `filterDplaDocsToHbcuHubs` keeps only docs whose provider/contributor matches a seeded `dplaContributorMatch` fragment (case-insensitive substring; provider names vary across hubs and the July 2026 aggregation transition) → `normalizeDplaBatch`. Skipped non-HBCU docs are counted in `subBudget.dplaNonHbcuSkipped`, never silently dropped.
3. **EAD finding-aid lane**: per seeded `lane: 'ead-finding-aid'` source, register (disabled) + run-scope approve, then injected `HbcuAdapter.listFindingAids(institution)` → `extractCandidates(findingAid)` → `normalizeHbcuBatch` (provenance stamp, stable id `hbcu:{institution}:{findingAidId}:{component}`, snippet caps, forbidden-key strip).
4. `applyHbcuSubBudgets` — shared ceiling 300; EAD lane 120 leads (the records federal aggregators never surface), DPLA hub lane 180.
5. `runDiscoveryCampaign` — boundaries `{ countries: ['US'], adapterIds: ['dpla', 'hbcu-collections-v1'] }`, budget 300/40/10/2; content-hash dedupe merges duplicates without losing provenance; optional catalog propose/review match.
6. `scoreObscurity` (`obscurity.v1`) on every survivor; `rankByObscurity` orders leads so operators review the most under-attested first. Catalog-relative heuristic only (`OBSCURITY_METHODOLOGY_DISCLAIMER` on the result).
7. `summarizeCampaignYield` (snippet doctrine re-asserted) + optional post-rank editorial hook. Result: `{ kind, adapterIds, seededSourceIds, subBudget, campaign, ranked, yield, editorialReviews, disclaimer }`.

## Seeded collections (verified URLs)

| Institution | Collection | Lane | URL |
|-------------|-----------|------|-----|
| Howard University | Moorland-Spingarn Research Center (finding aids via Digital Howard) | ead-finding-aid | <https://msrc.howard.edu/> / <https://dh.howard.edu/> |
| Fisk University | John Hope and Aurelia E. Franklin Library Special Collections | dpla-hub | <https://www.fisk.edu/academics/john-hope-and-aurelia-e-franklin-library/> |
| Tuskegee University | University Archives | ead-finding-aid | <https://www.tuskegee.edu/libraries/library_services/archives.html> |
| Hampton University | University Archives | ead-finding-aid | <https://hamptonu.edu/archives/> |
| HBCU Library Alliance | Digital Collection (AUC Woodruff Library; incl. Spelman materials) | dpla-hub | <https://hbcudigitallibrary.auctr.edu/> |

Spelman College materials currently route through the HBCU Library Alliance digital collection; promote Spelman to a standalone seed once its archives expose a stable public finding-aid portal we can verify.

## Integration (parent agent applies — this methodology does not edit barrels)

Add to `packages/domain/src/adapters/index.ts`:

```typescript
// HBCU special collections (scholarly / finding aids) — fixtures-first, registered disabled.
export * from './hbcu-collections/index.js';
```

Add to `packages/domain/src/discovery/index.ts`:

```typescript
export {
  HBCU_CAMPAIGN_KIND,
  HBCU_CAMPAIGN_ADAPTER_IDS,
  HBCU_SUB_BUDGET_POLICY,
  matchHbcuContributor,
  filterDplaDocsToHbcuHubs,
  applyHbcuSubBudgets,
  runHbcuCampaign,
  type HbcuSubBudgetSnapshot,
  type HbcuRankedLead,
  type HbcuCampaignResult,
  type RunHbcuCampaignInput,
} from './hbcu-campaign.js';
```

Add the test file to the `packages/domain` `test` script list: `src/discovery/hbcu-campaign.test.ts`.

No migration required (registry entries are in-memory/Firestore-later per `adapters/registry.ts`); if a durable table ever becomes necessary, use migration timestamp prefix `20260724000010`.

## Open follow-ups

- Live `HbcuAdapter` implementation (safe-fetch, EAD/XML + local repository HTML) behind the existing approval gates.
- DPLA hub queries scoped by `dataProvider` at request time (`fetch-search.ts`-style builder) so the contributor filter is a second net, not the only one.
- Per-institution query packs (e.g. Moorland-Spingarn manuscript divisions) once operator review validates the default `institutional_records` pack yield.
