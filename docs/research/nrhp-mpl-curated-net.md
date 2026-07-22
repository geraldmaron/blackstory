# NRHP Multiple Property Listings — African American curated-net

Research note for WS5 (`repo-2ztn.6`). Documents rights, the filtered inventory approach, and
the fixtures-first disabled adapter at `packages/domain/src/adapters/nrhp-mpl/`.

## What MPL is (and is not)

**Multiple Property Listings (MPL)** are National Register *thematic surveys*: peer-reviewed
Multiple Property Documentation Forms that define eligibility criteria for groups of related
historic resources (schools, churches, civil-rights sites, cemeteries, etc.).

This lane is **not**:

- The existing NRHP **property listing** corpus registered in `launch-corpora.ts` (`corpus: 'nrhp'`)
- The fixture-only federal NPS adapter (`nps-national-register-v1` in
  `packages/domain/src/adapters/federal/nps/`)
- A bulk OCR campaign over MPL PDF bodies

MPL metadata is citation-dense and place-indexable at the *survey* level; individual properties
named inside an MPL still require separate NRHP listing corroboration before entity promotion.

## Rights and policy

| Field | Verdict |
|---|---|
| Custodian | U.S. National Park Service / National Register of Historic Places |
| License | U.S. Government Work — public domain in the United States (17 U.S.C. § 105) |
| Adapter registry state | **`disabled`** until explicit operator policy approval |
| Stored content | MPL inventory metadata + canonical evidence URLs only |
| Prohibited | Bulk OCR / full-text extraction from MPL PDFs; live NPS scrape at scale |

Attribution: National Park Service / National Register of Historic Places. See
`NRHP_MPL_ATTRIBUTION_NOTICE` in the adapter contract module.

**Do not** call `approveSourcePolicy` or enable the adapter kill switch until a human records
policy approval on the bead and updates `external-data-sources.ts` if/when a live inventory
artifact is archived.

## Filtered inventory approach

The curated-net is **not** “all MPL PDFs.” It is a **filtered inventory** of African American
heritage MPL surveys:

1. **Theme allowlist** — `NRHP_MPL_AA_CURATED_THEMES` in `definition.ts` (civil rights,
   Rosenwald schools, AA churches/cemeteries/urban communities, Reconstruction-era resources,
   fraternal societies, etc.).
2. **Relevance gate** — each record must declare `aaHeritageRelevance` of `primary` or
   `significant`. Incidental or untagged surveys are rejected (`not_in_aa_curated_net`).
3. **Metadata-only payload** — title, MPL reference, states, thematic context, coverage period,
   property-count estimates, canonical URL. Forbidden keys (`pdfText`, `ocrText`, `fullText`, …)
   are stripped at normalize time.
4. **Fixtures-first** — `fixtures/sample-mpl-inventory.json` holds 1–3 representative records for
   parser tests. Production inventory loads through the standard acquisition harness
   (`recordDatasetAcquisition`) after rights verification — not ad-hoc scraping.

### Suggested human curation workflow (pre-enable)

1. Start from NPS NRHP data downloads and NPGallery MPL index pages (reference URLs in
   `docs/research/black-history-data-landscape-intake.md` §9).
2. Filter to AA-heritage MPL themes using the allowlist above; record curator rationale per row.
3. Archive the curated inventory JSON + `.sha256` to `gs://black-book-efaaf-raw-sources/…`.
4. Register in `external-data-sources.ts` with `registryState: 'disabled'`.
5. Run the adapter normalizer in canary against the archived artifact; promote only to discovery
   candidates — never auto-publish.

## Adapter surface

| Constant | Value |
|---|---|
| Adapter id | `nrhp-mpl-v1` |
| Registry entry id | `reg_nrhp_mpl` |
| Evidence source id | `src_nrhp_mpl` |
| Stable id scheme | `nrhp-mpl-ref` (`nrhp-mpl:<mplReference>`) |
| Output | `AdapterCandidateRecord` with full provenance quartet via `stampCandidateProvenance` |

Registration helper: `registerNrhpMplAdapter({ store, createdAt })` — always **`disabled`**.

## Explicit non-goals

- **Bulk OCR** of MPL PDF documentation forms
- Live scrape of `nps.gov` / NPGallery at scale
- Treating MPL survey prose as ready-to-publish entity claims without property-level corroboration
- Enabling the adapter without policy approval

## Related references

- Data ingestion methodology: `docs/runbooks/data-ingestion-methodology.md`
- Landscape intake (MPL ROI claim): `docs/research/black-history-data-landscape-intake.md`
- NRHP spatial REST (for future geo cross-check, not live enable): http://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer
- NRHP data downloads: https://www.nps.gov/subjects/nationalregister/data-downloads.htm
