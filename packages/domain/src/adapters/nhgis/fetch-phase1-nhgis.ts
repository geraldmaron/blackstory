/**
 * Fixture-backed fetch for Phase 1 NHGIS Cook County race population-share observations.
 * Loads curated decennial county race counts — live NHGIS API extract for 1970+ decades is
 * deferred until those tables are registered in NHGIS_DECADE_RACE_TABLES.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NHGIS_COOK_RACE_POPULATION_SHARE_FIXTURE_FILENAME,
  NHGIS_HOMEPAGE_URL,
} from './constants.js';
import {
  assertNhgisThemeImpactDecadesPresent,
  mapNhgisRaceRowsToObservations,
  parseNhgisCookRacePopulationShareFixtureCsv,
  type Phase1NhgisObservationDraft,
} from './phase1-nhgis-mapper.js';

export type Phase1NhgisFetchResult = {
  readonly observations: readonly Phase1NhgisObservationDraft[];
  readonly rejected: readonly string[];
  readonly decades: readonly number[];
  readonly sourceUrl: string;
  readonly fixturePath: string;
};

type FetchOptions = {
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
  readonly requireThemeImpactDecades?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
  NHGIS_COOK_RACE_POPULATION_SHARE_FIXTURE_FILENAME,
);

function loadFixtureText(options: FetchOptions): { readonly text: string; readonly path: string } {
  if (options.fixtureCsvText !== undefined) {
    return {
      text: options.fixtureCsvText,
      path: options.fixturePath ?? '(inline fixtureCsvText)',
    };
  }
  const fixturePath = options.fixturePath ?? DEFAULT_FIXTURE_PATH;
  return {
    text: readFileSync(fixturePath, 'utf8'),
    path: fixturePath,
  };
}

export function fetchPhase1NhgisObservations(
  options: FetchOptions = {},
): Phase1NhgisFetchResult {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const requireThemeImpactDecades = options.requireThemeImpactDecades ?? true;
  const { text, path } = loadFixtureText(options);
  const parsed = parseNhgisCookRacePopulationShareFixtureCsv(text);

  if (requireThemeImpactDecades) {
    assertNhgisThemeImpactDecadesPresent(parsed.rows);
  }

  const observations = mapNhgisRaceRowsToObservations(parsed.rows, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    decades: parsed.rows.map((row) => row.decade),
    sourceUrl: NHGIS_HOMEPAGE_URL,
    fixturePath: path,
  };
}

export { DEFAULT_FIXTURE_PATH };
