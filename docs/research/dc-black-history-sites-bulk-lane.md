# DC Black History Sites — bulk discovery lane

**Source:** District of Columbia Office of Planning / Historic Preservation Office  
**License:** CC BY 4.0 (retain attribution on derived records)  
**Upstream:** ArcGIS FeatureServer layer backing [data.gov catalog entry](https://catalog.data.gov/dataset/black-history-sites-washington)

## Fixture (git-durable)

| Field | Value |
| --- | --- |
| Path | `packages/firebase/fixtures/discovery-candidates/bulk-dc-sites-2026-07-19.json` |
| Candidates | 311 |
| Bytes | ~428 KB |
| Rows fetched | 311 (0 dropped at import) |
| Geo | 310 with lat/lng; 1 missing (`dc-black-history-sites-s4`) |
| Kind | All `place` (ArcGIS `People` type = homes/workplaces of historical figures, not person entities) |

### Source categories

| Category | Count |
| --- | ---: |
| Institution | 108 |
| People | 98 |
| Commemorative | 25 |
| Sites of Remembrance | 24 |
| Business | 23 |
| Protest Site | 18 |
| Leisure | 15 |

## Pipeline (import → Supabase → discovery → publish)

```
ArcGIS FeatureServer
  └─ import-bulk-source-programs.ts --lane=dc-sites
       └─ fixtures/discovery-candidates/bulk-dc-sites-<date>.json  (replay cache; optional)
            └─ load-bulk-candidates-to-supabase.ts --lane=dc-sites
                 └─ bb_research.landscape_candidates  (SoR; research-lane-only)
                      └─ dry-run-bulk-dc-sites.ts  (validate + triage; no public writes)
                           └─ build-discovery-enrichment-subjects.ts --candidates <fixture>
                                └─ operator-cli enrichment-run (LLM judge; quarantine only)
                                     └─ auto-promote-corsair-keeps.ts → national-catalog fixture
                                          └─ human-gated release → bb_public.release_entities
```

**Supabase load (dry-run default):**

```bash
node --conditions development --import tsx \
  packages/firebase/scripts/load-bulk-candidates-to-supabase.ts --lane=dc-sites
```

**Nothing in this lane auto-publishes.** Bulk import stamps `researchLaneOnly: true` and workbook methodology rule 1 applies: source verification, identity resolution, geo review, rights review, and privacy review before any public projection.

## Dry-run triage

```bash
node --conditions development --import tsx \
  packages/firebase/scripts/dry-run-bulk-dc-sites.ts
```

Outputs:

| Artifact | Path |
| --- | --- |
| JSON report | `.cache/bulk-dc-sites/triage-report.json` |
| Markdown summary | `docs/research/dc-black-history-sites-triage-report.md` |

Triage dispositions:

| Disposition | Meaning |
| --- | --- |
| `enrichment_ready` | New place candidate — proceed to source fetch + enrichment |
| `catalog_enrich` | Name overlaps national catalog (~28 of 311) — enrich existing entity, do not duplicate |
| `privacy_review` | ArcGIS `People` category (98) — residence/living-status review before pin |
| `geo_hold` | Missing or out-of-DC-bbox coordinates |
| `validation_error` | Fixture contract violation |

## Firebase target shape (after human promotion)

| Stage | Shape |
| --- | --- |
| Research intake | `researchCases/{caseId}` — state machine starting at `candidate` |
| Discovery record | `discovery-candidate.v1` via `ingestBulkCandidates` (private; never public) |
| Publish fixture | `ReleaseSourceEntity` in `packages/firebase/fixtures/national-catalog/` |
| Public projection | `publicReleases/{releaseId}/entities/{entityId}` |
| Search | `publicSearchIndex/{entityId}` |
| Graph | `entityRelationships/{entityId}` |

Required fields for public release (`ReleaseSourceEntity`): `id`, `kind`, `displayName`, `summary`, `jurisdictionLabel`, `locationPrecision`, `locationLabel`, `lat`, `lng`, and at least one claim with citation meeting confidence gates.

## Re-fetch upstream (operator)

```bash
node --conditions development --import tsx \
  packages/firebase/scripts/import-bulk-source-programs.ts --lane=dc-sites
```

Network required. Writes a dated fixture under `fixtures/discovery-candidates/` and archives raw GeoJSON under `.cache/bulk-sources/dc-sites/`.

## Next human steps

1. Review triage report — prioritize `enrichment_ready` Institution/Commemorative rows first; route `catalog_enrich` to existing DC catalog entities (~84 DC-tagged today).
2. Run enrichment on a bounded batch (e.g. `--max 25`) via `build-discovery-enrichment-subjects.ts` + operator enrichment; never skip privacy review on `People` rows.
3. After enrichment, run `auto-promote-corsair-keeps.ts` and validate with `DRY_RUN=1 publish-national-catalog.ts` before any production Firestore write.
