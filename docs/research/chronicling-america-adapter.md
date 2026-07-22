# Chronicling America historic newspapers adapter

Fixtures-first adapter for the Library of Congress **Chronicling America** collection (NDNP digitized US newspapers). Produces `AdapterCandidateRecord` metadata for Black press and local newspaper leads — figures and institutions often absent from federal place records.

## Domain API (`@repo/domain` → `adapters/chronicling-america/`)

Parent agent merges `packages/domain/src/adapters/chronicling-america/index.ts` into the adapters barrel.

| Module | Purpose |
|--------|---------|
| `contract` | Default `SourceAdapterContract` for registry registration |
| `definition` | Full adapter definition (rights, retention, export filter) |
| `client` | Defensive loc.gov JSON search/item parsing (fixture-driven) |
| `normalizer` | Shared normalization to `AdapterCandidateRecord` |
| `parser` | Fixture batch + search-response orchestration |
| `registration` | Disabled-by-default registry helper |
| `export-filter` | Strip OCR full text and image tile blobs |
| `retention` | Required metadata gate before candidate stamping |

## API base URLs

As of 2025, Chronicling America is accessed exclusively via the **loc.gov JSON API** (the legacy `chroniclingamerica.loc.gov` dedicated API is retired).

| Operation | URL pattern |
|-----------|-------------|
| Collection search | `https://www.loc.gov/collections/chronicling-america/?q={query}&fo=json&dl=page` |
| Item detail | `https://www.loc.gov/item/{lccn}/?fo=json` |
| Resource / page | `https://www.loc.gov/resource/{lccn}/{date}/?fo=json` |
| Legacy citation (stable) | `https://chroniclingamerica.loc.gov/lccn/{lccn}/` |

Useful query parameters:

- `fo=json` — JSON response format (required)
- `dl=page` — page-level results (preferred for discovery)
- `dl=title` — newspaper title-level results
- `c` — results per page (default 25)
- `sp` — page number
- `start_date` / `end_date` — date range filters

Official references:

- [Chronicling America API guide](https://www.loc.gov/apis/additional-apis/chronicling-america-api/)
- [loc.gov JSON API parameters](https://www.loc.gov/apis/json-and-yaml/requests/parameters/)
- [Search results response shape](https://www.loc.gov/apis/json-and-yaml/responses/search-results/)

## Adapter identity

| Field | Value |
|-------|-------|
| Adapter ID | `chronicling-america-v1` |
| Kill switch | `adapter:chronicling-america-v1` |
| Stable ID scheme | `ca-lccn-resource` |
| Classification | `primary_archival` |
| Distinct from | Federal fixture adapter `loc-collections-v1` |

Registry starts **disabled** until policy approval (`registerChroniclingAmericaSource` + `approveSourcePolicy`).

## Campaign budget defaults

Aligned with `@repo/security` `DEFAULT_RESEARCH_CAMPAIGN_BUDGET` and discovery roster caps — exported as `CHRONICLING_AMERICA_CAMPAIGN_BUDGET`:

| Cap | Default | Reference |
|-----|---------|-----------|
| `maxCandidates` | 500 | `DEFAULT_RESEARCH_CAMPAIGN_BUDGET.maxCandidatesPerRun` |
| `maxQuarantined` | 40 | Discovery campaign roster standard |
| `maxDeadLetter` | 10 | Discovery campaign roster standard |
| `maxRetriesPerCandidate` | 2 | Discovery campaign roster standard |

Operational limits on the adapter contract itself:

- Rate limit: 20 requests/minute, burst 3 (matches federal LoC family)
- Expected records per run: 50
- Export payload cap: 8 KiB per candidate (bulk OCR/image keys stripped)

## Black press coverage purpose

Chronicling America preserves digitized runs of African American newspapers — titles such as the *Chicago Defender*, *Pittsburgh Courier*, and *Weekly Pelican* — through NDNP and ACLS-sponsored microfilm. BlackStory uses this adapter to:

1. Surface **local and obscured figures** referenced in Black press coverage but missing from NRHP, census, or federal catalog records.
2. Anchor claims to **bibliographic metadata and outbound URLs**, not OCR full text.
3. Prioritize **place-first, evidence-before-assertion** leads that editorial can corroborate before publish.

This adapter does **not** archive the newspaper corpus. OCR `full_text`, image tiles, and page segments are stripped at the adapter boundary and never stored in Supabase.

## Dignity notes

- **No crime-heat rendering** — newspaper hits are bibliographic leads, not violence-adjacent heat maps.
- **No sensational framing** — titles and subjects are stored as metadata; editorial copy remains human-reviewed.
- **Evidence-pointer doctrine** — summaries are capped to 320 characters / 60 words; full page OCR is prohibited.
- **Public domain posture** — pre-1928 NDNP content is treated as public domain with cite + short excerpt permissions only.
- **People with context** — candidates carry publication title, place, and date so editorial can identify persons with PERSON / ROLE / PLACE / YEAR before any map pin.

## Fixtures

| File | Mimics |
|------|--------|
| `fixtures/search-response-sample.json` | loc.gov collection search (`results` + `pagination`) |
| `fixtures/item-response-sample.json` | loc.gov item detail (`item` envelope) |
| `fixtures/export-batch-sample.json` | Pre-normalized export batch (federal-style fixture path) |

## Validation

```bash
node --conditions development --import tsx --test \
  packages/domain/src/adapters/chronicling-america/chronicling-america.test.ts
```

Parent should add this path to `packages/domain/package.json` `test` script when merging the barrel.

## Non-goals (this bead)

- Live unbounded LoC harvest
- Full newspaper corpus storage in Supabase
- Registry UI wiring or scheduled campaign job (follow-on bead)

## Deferred

- Discovery campaign orchestration (`discovery-campaign-chronicling-america` scheduled job)
- Firestore persistence for adapter runs
- Python mirror under `workers/research/`
