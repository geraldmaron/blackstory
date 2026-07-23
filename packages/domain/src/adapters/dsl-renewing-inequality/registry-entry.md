# Registry entry — paste into `EXTERNAL_DATA_SOURCES`

Parent bead merges this block into `packages/domain/src/external-data-sources.ts` (do **not**
register in this scaffold bead).

```typescript
  {
    id: 'dsl-renewing-inequality',
    displayName: 'Renewing Inequality: urban renewal project attributes + polygons',
    custodian: 'University of Richmond Digital Scholarship Lab',
    homepageUrl: 'https://dsl.richmond.edu/panorama/renewal/',
    dataUrl:
      'https://raw.githubusercontent.com/americanpanorama/Renewing_Inequality_Data/master/Data/non_spatial_data.csv',
    license: {
      name: 'CC BY-NC-SA 4.0 (DSL vector derivatives); federal characteristics reports public domain',
      verdict: 'noncommercial',
      notes:
        'Same DSL family as mapping-inequality-holc — vector GeoJSON and derived map products ' +
        'require attribution and are noncommercial; rights review required before revenue-bearing ' +
        'surface use. Chicago pilot parses 1955–1966 project attributes only; polygons gated.',
    },
    vintage: 'Federal urban renewal characteristics reports 1955–1966; partial city polygons',
    geographies: ['city'],
    cadence: 'irregular',
    checksumSha256: '88fb5f3aa228bdd42af6dac537c9f8ac923b70dcdd519acc8dbde0ac8fda9fc5',
    registryState: 'disabled',
    notes:
      'Chicago pilot: 43 projects with attributes in 1955–1966; 17 Chicago polygon features in ' +
      'ur_projects.geojson (incomplete). Public surfaces cite-only until rights review clears ' +
      'target surface.',
  },
```

## Adapter import (parent merges `adapters/index.ts`)

```typescript
export * from './dsl-renewing-inequality/index.js';
```

## Indicator catalog merge (parent merges `phase1-indicator-catalog.ts`)

Import definitions from `statistics/phase1-dsl-renewing-inequality-indicator-catalog.ts`.
