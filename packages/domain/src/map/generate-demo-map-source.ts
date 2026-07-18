/**
 * One-off generator for the `/map` demo route's static artifact
 * (`apps/web/src/app/map/map-source.seed.json`).
 *
 * This is deliberately a script, not part of any package's normal build: it stands in for the
 * release pipeline described in `map-source.ts` (not wired live yet; see
 * `workers/publication/MAP_SOURCE_INTEGRATION.md`). Running this script against fixture data
 * is the same shape of operation a real release activation would perform against live public
 * projections — build the source once, write an immutable artifact, let the app read it
 * statically (ADR-008 bounded/static-first doctrine).
 *
 * Run with: pnpm --filter @repo/domain exec tsx
 * src/map/generate-demo-map-source.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { redactLocationForPublic } from '@repo/security';
import { buildMapSource } from './map-source.js';
import { MAP_SOURCE_DEMO_FIXTURES } from './fixtures.js';

const OUTPUT_PATH = fileURLToPath(
  new URL('../../../../apps/web/src/app/map/map-source.seed.json', import.meta.url),
);

function main(): void {
  const result = buildMapSource({
    releaseId: 'rel_demo_fixture_001',
    generatedAt: '2026-07-17T00:00:00.000Z',
    entities: MAP_SOURCE_DEMO_FIXTURES,
    redactLocation: redactLocationForPublic,
  });

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(
    `Wrote ${result.featureCollection.features.length} feature(s), ` +
      `${result.stateAggregates.length} state aggregate(s), ` +
      `${result.countyAggregates.length} county aggregate(s) to ${OUTPUT_PATH}`,
  );
}

main();
