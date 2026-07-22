# DC Black History Sites — bulk lane triage report

Generated: 2026-07-21T20:34:27.003Z
Fixture generated: 2026-07-19T23:58:49.160Z
Fixture: `/Users/geralddagher/Developer/Projects/blackstory-mobile/packages/firebase/fixtures/discovery-candidates/bulk-dc-sites-2026-07-19.json` (428,146 bytes)

## Counts

| Metric | Value |
| --- | ---: |
| Candidates | 311 |
| Validation errors | 0 |
| With geo | 310 |
| Missing geo | 1 |
| In DC bbox | 310 |
| Out of DC bbox | 0 |
| People category (privacy lane) | 98 |
| Catalog existing match | 28 |
| Catalog new candidate | 282 |
| Fallback data.gov URL | 7 |

## Source categories

| Category | Count |
| --- | ---: |
| Institution | 108 |
| People | 98 |
| Commemorative | 25 |
| Sites of Remembrance | 24 |
| Business | 23 |
| Protest Site | 18 |
| Leisure | 15 |

## Triage dispositions

| Disposition | Count | Meaning |
| --- | ---: | --- |
| enrichment_ready | 193 | New place candidate; proceed to source fetch + enrichment |
| catalog_enrich | 28 | Overlaps published catalog — enrich existing entity |
| privacy_review | 89 | People-typed site; living/residence review before pin |
| geo_hold | 1 | Missing or out-of-bbox coordinates |
| validation_error | 0 | Fixture schema/contract violation |

## Canonical URL hosts (top 8)

| Host | Count |
| --- | ---: |
| historicsites.dcpreservation.org | 192 |
| en.wikipedia.org | 35 |
| www.hmdb.org | 23 |
| catalog.data.gov | 7 |
| www.nps.gov | 6 |
| parkviewdc.com | 5 |
| www.whitehousehistory.org | 3 |
| amhistory.si.edu | 1 |

## Pipeline (no Firebase writes in this script)

1. `import-bulk-source-programs.ts --lane=dc-sites` → git fixture
2. `dry-run-bulk-dc-sites.ts` (this script) → triage report
3. `build-discovery-enrichment-subjects.ts --candidates <fixture>` → fetch sources
4. Operator enrichment + `auto-promote-corsair-keeps.ts` → national-catalog fixture
5. Human `publish-national-catalog.ts` (DRY_RUN=1 first) → Firestore release docs

Regenerate: `node --conditions development --import tsx packages/firebase/scripts/dry-run-bulk-dc-sites.ts`

