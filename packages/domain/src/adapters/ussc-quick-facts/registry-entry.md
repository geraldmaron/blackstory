# Registry entry — paste into `packages/domain/src/external-data-sources.ts`

Add inside `EXTERNAL_DATA_SOURCES` (alphabetically near other justice sources):

```typescript
  {
    id: 'ussc-quick-facts-drug',
    displayName: 'USSC Quick Facts — federal crack/powder drug sentencing',
    custodian: 'United States Sentencing Commission',
    homepageUrl: 'https://www.ussc.gov/research/quick-facts',
    dataUrl: 'https://www.ussc.gov/research/quick-facts',
    license: { name: 'U.S. government work — public domain', verdict: 'public-domain' },
    vintage: 'USSC Quick Facts fiscal-year publications (crack/powder cocaine trafficking)',
    geographies: ['nation'],
    cadence: 'annual',
    registryState: 'disabled',
    notes:
      'Selective store of published Quick Facts table cells (average sentence months, race shares). ' +
      'Federal FY only — juxtaposition with statutes for drug-policy context. No microdata scrape.',
  },
```

After merge, enable `registryState: 'enabled'` only when parent bead integrates catalog + barrel exports.

## Phase 1 metrics (merge into `phase1-indicator-catalog.ts` from `phase1-ussc-indicator-catalog.ts`)

| metricId | unit | estimateType |
|---|---|---|
| `ussc-average-sentence-months-crack-nation` | months | mean |
| `ussc-average-sentence-months-powder-nation` | months | mean |
| `ussc-black-share-crack-offenders-nation` | percent | percentage |

## Ingest

```bash
# Dry-run
node --conditions development --import tsx \
  packages/firebase/scripts/ingest-phase1-ussc-quick-facts.ts

# Apply
DRY_RUN=0 INGEST_PHASE1_USSC_APPLY=1 DATABASE_URL=postgresql://... \
  node --conditions development --import tsx \
  packages/firebase/scripts/ingest-phase1-ussc-quick-facts.ts
```
