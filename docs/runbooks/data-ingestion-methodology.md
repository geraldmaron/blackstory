# Data Ingestion Methodology

Owner directive 2026-07-18: one repeatable method for bringing any external dataset into
Black Book. This runbook is the pattern; the census/ACS/Opportunity-Atlas/HOLC ingestions
(landed 2026-07-18) are the reference implementations.

## The pipeline (every source, no exceptions)

1. **Register before you acquire.** Add an entry to
   `packages/domain/src/external-data-sources.ts`: direct data URL (never a marketing page),
   custodian, license verdict, vintage, geography, cadence, `registryState: 'disabled'`.
   Recording a source is never approval to ingest it.
2. **Resolve rights first.** License verdict decides the lane:
   - `public-domain` / `attribution-required` → may ingest; attribution travels on every doc
     (`license` field).
   - `noncommercial` (CC BY-NC etc.) → may ingest into a **client-closed** collection only;
     rights review required before any public surface (see `holcAreas`).
   - `unverified` → do not download until terms are verified (see `sundown-towns-osf`).
   Entity-bearing bulk corpora additionally go through `launch-corpora.ts` vetting; sundown
   and lynching data go through `historic-safety/source-registry.ts` (dignity rules,
   confidence labels preserved verbatim).
3. **Archive the raw artifact and record the acquisition through the harness.** Upload the
   untouched download to
   `gs://black-book-efaaf-raw-sources/raw-sources/<source>/<version>/<file>` with a
   `.sha256` sidecar (bucket is uniform-access, public-access-prevention enforced), then call
   `recordDatasetAcquisition` (`packages/firebase/src/external/capture.ts`) — it writes the
   EXISTING evidence-provenance chain (`evidenceSources` → `sourceItems` → `retrievalEvents`
   → `sourceCaptures`, with `snapshotStorageObject` pointing at the archived file). The
   digest also becomes `datasetChecksum` on every derived doc and is recorded back on the
   external-data-sources entry. Never invent a parallel provenance mechanism — the capture
   chain is the queryable system of record.
4. **Parse fail-closed.** Assert the dataset's own metadata before parsing rows — variable
   labels against `variables.json` (census pattern), expected header columns (CSV pattern),
   expected feature properties (GeoJSON pattern). A drifted upstream schema must throw, not
   silently mis-ingest. The 2020 decennial pull proved this: the P1_003N/P1_004N label
   assertion caught a real wrong-variable bug before a single row landed.
5. **Suppression, not sentinels.** Upstream missing/suppressed markers (ACS negative
   sentinels, empty cells, below-reliability estimates) become an omitted field plus an
   entry in `suppressed` — never a stored sentinel value, never a fabricated zero
   (no-false-absence, BB-051).
5b. **Ingest the coverage denominator with the data.** When a source is voluntarily reported
   or unevenly collected, the participation/coverage series is not optional context — it is
   part of the dataset, and a count without it is misleading. UCR hate crime is the worked
   example: Philadelphia County (630k Black residents) shows 4 reporting agencies and 185
   anti-Black incidents 2020–2024 while Monmouth County NJ (41k Black residents) shows 33
   agencies and 442 — a reporting-coverage artifact, not a finding about either place.
   Store the per-record reporting count AND the source's own participation table, and keep
   the collection client-closed until a surface renders them together.
6. **Provenance quartet on every doc.** `{source, sourceUrl, retrievedAt, contentHash}` per
   `public-numeric-policy.ts` category 3; `sourceUrl` is always keyless. Bulk-derived docs
   also carry `datasetChecksum` and `license`.
7. **Idempotent loads.** `contentHash` over stable fields only (exclude `retrievedAt`/
   timestamps); writers skip on hash match, preserve `createdAt` on update. Re-running a
   loader against unchanged upstream must be a 100% `unchanged` no-op — this is the
   verification step, not an optimization.
8. **Rules gate by default-closed.** New collections start `allow read: if false` unless
   the data is public-domain published statistics feeding an existing surface
   (`censusCountyDecades`, `acsCountyProfiles`). Big collections (tract-level, ~85k docs)
   stay closed until a server-side bounded surface exists — a public rule invites
   full-collection scans.
9. **Verify with counts + spot checks.** Expected row counts recorded up front (e.g.
   ~3,220 counties, 52 state fan-outs); per-request row count must equal docs written;
   `rejected` surfaced, never dropped; spot-check known values (Cook County 2000 =
   5,376,741).
10. **Track in beads.** One bead per source ingestion referencing the registry id
    (`external-data:<id>`); `bd remember` for cross-session facts.

## Tool selection (are we using a scraper package? — mostly no, deliberately)

Decision tree, in order:

1. **Structured API exists** (census, DPLA, CDC Socrata, HMDA) → typed adapter in
   `packages/domain/src/adapters/<source>/` with injectable `fetch` (the `FetchLike` /
   `SafeHttpClient` port pattern — see `census-demographics/fetch-county-populations.ts`,
   `internet-archive/shared/http-port.ts`). API keys are caller-supplied, stored in Secret
   Manager + `.env.local`, never read inside the adapter.
2. **Bulk file exists** (TIGER, LODES, Opportunity Atlas, HOLC GeoJSON, CRDC ZIPs) → direct
   download + checksum + stream-parse in a `packages/firebase/scripts/ingest-*.ts` script
   (pattern: `ingest-opportunity-atlas.ts` streams 2.6GB/7,897 columns without buffering).
   Prefer bulk over API pagination whenever both exist — reproducible, checksummable, one
   retrieval event.
3. **Neither** (HTML-only sources) → the existing adapter framework still applies
   (`wikimedia`, `rss`, `common-crawl` adapters show the shape); rate limits and rights
   come from the registry contract. We do NOT add a headless-browser scraping dependency
   until a registered source actually requires it — every source in the current registry
   (19 entries) is API- or bulk-served. If one ever does, it gets its own adapter behind
   the same contract, not an ad-hoc script.

Discovery-lane campaigns (`workers/research/`, Corsair systemd, operator-cli discovery commands)
write **private candidates and ledger runs in Postgres** via quarantine gates — not Firestore.
Dataset ingestion (this runbook) is for *carrying* published data faithfully. Don't mix the lanes: statistics never go through the
candidate pipeline, and scraped candidates never skip corpus vetting.

## Researched-entity records (national catalog lane)

Human-or-agent researched entities (the `fixtures/national-catalog/*.json` →
`publish-national-catalog.ts` path) are a third lane with its own bar:

- Every record: real, web-verified, with citation URLs from authoritative custodians
  (NPS/NRHP, institutions themselves, state encyclopedias, university archives).
- Coordinates must pass state-bbox containment QA
  (`scripts/qa-catalog-fixtures.ts`) before publish; `manual_research` match method.
- After fixture edits, run the Census location audit (deterministic, cached, no LLM):
  `node --conditions development --import tsx packages/firebase/scripts/audit-entity-locations.ts`.
  Street-address pins beyond the precision drift threshold can be auto-corrected with
  `--apply-street-corrections`. Named places: run
  `enrich-entity-locations.ts --apply` (Wikidata P625 → git-durable
  `national-catalog-location-overrides.json`; raw JSON under `.cache/wikidata-entities/`).
  Live APIs are enrichment-only — publish/map read overrides + EntityLocation, never live
  geocoders. Never snap to US state/city centroids; parent-site snaps are capped at 15km,
  otherwise retain the pin and honesty-downgrade precision. Operator one-off:
  `operator-cli locate --entity-id … --address …` (see
  `.claude/skills/black-book/locate/SKILL.md`).
- Dignity framing per BB-051: presence and institution-building, never deficit;
  `sensitivityClass` only where violence is the documented subject.
- Claims carry `confidenceLevel` honestly (`high` only when the cited source states it
  directly) — and never numeric scores (public-numeric-policy).
- DRY_RUN publish validates everything against `publicEntityProjectionSchema` before any
  write.

## Reference implementations

| Pattern | File |
| --- | --- |
| API adapter, fail-closed dictionary assertion | `packages/domain/src/adapters/census-demographics/` |
| Per-state fan-out with retry + batched writes | `packages/firebase/src/demographics/acs-load-cli.ts` |
| Bulk CSV stream-ingest with reliability screening | `packages/firebase/scripts/ingest-opportunity-atlas.ts` |
| Bulk GeoJSON with geometry-in-Storage reference | `packages/firebase/scripts/ingest-holc-areas.ts` |
| Signed-URL bulk source + deterministic geo crosswalk + coverage denominator | `packages/firebase/scripts/ingest-hate-crime.ts` |
| Idempotent doc loader (compare-then-set) | `packages/firebase/src/demographics/load-cli.ts` |
| THE batch upsert + writer contract (use this, never re-implement) | `packages/firebase/src/external/batch-upsert.ts` |
| THE acquisition capture chain (evidenceSources→…→sourceCaptures) | `packages/firebase/src/external/capture.ts` |
| THE provenance zod fragments (compose, never restate) | `packages/firebase/src/firestore/statistic-provenance.ts` |
| Catalog fixture QA gate (state-bbox + precision-decimals) | `packages/firebase/scripts/qa-catalog-fixtures.ts` |
| Acquisition registry | `packages/domain/src/external-data-sources.ts` |
| Rights-restricted corpus vetting | `packages/domain/src/launch-corpora.ts` (HOLC entry) |
| Dignity-lane sources | `packages/domain/src/historic-safety/source-registry.ts` |
