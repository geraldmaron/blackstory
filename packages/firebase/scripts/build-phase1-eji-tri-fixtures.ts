/**
 * Builds full Illinois CDC EJI + EPA TRI county fixtures from live downloads (with cache).
 * Writes committable rollups under packages/firebase/fixtures/reference-indicators/.
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-phase1-eji-tri-fixtures.ts --live
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CDC_EJI_IL_FULL_FIXTURE_FILENAME,
  fetchPhase1EjiCountyObservations,
} from '../../domain/src/adapters/cdc-eji/index.js';
import {
  EPA_TRI_IL_FULL_FIXTURE_FILENAME,
  fetchPhase1TriCountyObservations,
} from '../../domain/src/adapters/epa-tri/index.js';
import {
  buildTriFacilityCountyMap,
  triFixtureCsvFromRows,
  triRowsFromReportingForms,
} from '../../domain/src/adapters/epa-tri/live-tri-illinois.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, '../fixtures/reference-indicators');

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const live = hasFlag('live');
  const retrievedAt = new Date().toISOString();

  const ejiResult = await fetchPhase1EjiCountyObservations({
    live,
    allIllinoisCounties: true,
    retrievedAt,
  });

  const triResult = await fetchPhase1TriCountyObservations({
    live,
    allIllinoisCounties: true,
    retrievedAt,
  });

  const ejiFixturePath = join(FIXTURE_DIR, CDC_EJI_IL_FULL_FIXTURE_FILENAME);
  if (ejiResult.cachePath) {
    writeFileSync(ejiFixturePath, readFileSync(ejiResult.cachePath, 'utf8'), 'utf8');
  }

  const triFixturePath = join(FIXTURE_DIR, EPA_TRI_IL_FULL_FIXTURE_FILENAME);
  if (triResult.cachePaths && triResult.cachePaths.length > 0) {
    const facilityPayload = JSON.parse(
      readFileSync(triResult.cachePaths[0]!, 'utf8'),
    ) as readonly Record<string, unknown>[];
    const facilityCountyMap = buildTriFacilityCountyMap(facilityPayload);
    const allRows = [];
    for (const cachePath of triResult.cachePaths.slice(1)) {
      const reportingPayload = JSON.parse(readFileSync(cachePath, 'utf8')) as readonly Record<
        string,
        unknown
      >[];
      const yearMatch = cachePath.match(/tri-il-reporting-(\d{4})\.json$/);
      const reportingYear = yearMatch ? Number(yearMatch[1]) : NaN;
      const parsed = triRowsFromReportingForms(
        reportingPayload,
        reportingYear,
        facilityCountyMap,
        undefined,
      );
      allRows.push(...parsed.rows);
    }
    writeFileSync(triFixturePath, triFixtureCsvFromRows(allRows), 'utf8');
  }

  const cookEji = ejiResult.observations.find((obs) => obs.jurisdictionId === 'county:17031');
  const cookTri2023 = triResult.observations.find(
    (obs) => obs.jurisdictionId === 'county:17031' && obs.referencePeriod === '2023',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        live,
        ejiMode: ejiResult.mode,
        triMode: triResult.mode,
        ejiCountyCoverage: ejiResult.countyCoverageCount,
        triCountyCoverage: triResult.countyCoverageCount,
        ejiObservations: ejiResult.observations.length,
        triObservations: triResult.observations.length,
        ejiFixturePath: ejiResult.cachePath ? ejiFixturePath : null,
        triFixturePath: triResult.cachePaths?.length ? triFixturePath : null,
        ejiCachePath: ejiResult.cachePath ?? null,
        triCachePaths: triResult.cachePaths ?? null,
        cookCounty: {
          ejiEnvironmentalBurdenScore: cookEji?.estimate ?? null,
          ejiTractCount: cookEji && 'tractCount' in cookEji ? cookEji.tractCount : null,
          triFacilityCount2023: cookTri2023?.estimate ?? null,
          priorPilotEji: 0.74,
          priorPilotTri2023: 12,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
