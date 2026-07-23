/**
 * Fixture-backed fetch for Phase 1 NHGIS Cook County race population-share and tenure
 * homeownership observations. Loads curated decennial county fixtures; live NHGIS API
 * extract for tenure tables remains optional when NHGIS_API_KEY is registered.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NHGIS_COOK_RACE_POPULATION_SHARE_FIXTURE_FILENAME,
  NHGIS_COOK_TENURE_HOMEOWNERSHIP_FIXTURE_FILENAME,
  NHGIS_HOMEPAGE_URL,
} from './constants.js';
import {
  assertNhgisTenureHomeownershipDecadesPresent,
  assertNhgisThemeImpactDecadesPresent,
  mapNhgisRaceRowsToObservations,
  mapNhgisTenureRowsToObservations,
  parseNhgisCookRacePopulationShareFixtureCsv,
  parseNhgisCookTenureHomeownershipFixtureCsv,
  type Phase1NhgisObservationDraft,
} from './phase1-nhgis-mapper.js';

export type Phase1NhgisFetchResult = {
  readonly observations: readonly Phase1NhgisObservationDraft[];
  readonly rejected: readonly string[];
  readonly decades: readonly number[];
  readonly tenureDecades: readonly number[];
  readonly sourceUrl: string;
  readonly fixturePath: string;
  readonly tenureFixturePath?: string;
};

type FetchOptions = {
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly tenureFixtureCsvText?: string;
  readonly tenureFixturePath?: string;
  readonly retrievedAt?: string;
  readonly requireThemeImpactDecades?: boolean;
  readonly requireTenureDecades?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
);
const DEFAULT_FIXTURE_PATH = join(FIXTURE_DIR, NHGIS_COOK_RACE_POPULATION_SHARE_FIXTURE_FILENAME);
const DEFAULT_TENURE_FIXTURE_PATH = join(
  FIXTURE_DIR,
  NHGIS_COOK_TENURE_HOMEOWNERSHIP_FIXTURE_FILENAME,
);

function loadFixtureText(
  options: FetchOptions,
): { readonly text: string; readonly path: string } {
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

function loadTenureFixtureText(
  options: FetchOptions,
): { readonly text: string; readonly path: string } | undefined {
  if (options.tenureFixtureCsvText !== undefined) {
    return {
      text: options.tenureFixtureCsvText,
      path: options.tenureFixturePath ?? '(inline tenureFixtureCsvText)',
    };
  }
  if (options.tenureFixturePath !== undefined) {
    return {
      text: readFileSync(options.tenureFixturePath, 'utf8'),
      path: options.tenureFixturePath,
    };
  }
  try {
    return {
      text: readFileSync(DEFAULT_TENURE_FIXTURE_PATH, 'utf8'),
      path: DEFAULT_TENURE_FIXTURE_PATH,
    };
  } catch {
    return undefined;
  }
}

export function fetchPhase1NhgisObservations(
  options: FetchOptions = {},
): Phase1NhgisFetchResult {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const requireThemeImpactDecades = options.requireThemeImpactDecades ?? true;
  const requireTenureDecades = options.requireTenureDecades ?? true;
  const { text, path } = loadFixtureText(options);
  const parsed = parseNhgisCookRacePopulationShareFixtureCsv(text);

  if (requireThemeImpactDecades) {
    assertNhgisThemeImpactDecadesPresent(parsed.rows);
  }

  const observations: Phase1NhgisObservationDraft[] = [
    ...mapNhgisRaceRowsToObservations(parsed.rows, retrievedAt),
  ];
  const rejected = [...parsed.rejected];
  let tenureDecades: readonly number[] = [];
  let tenureFixturePath: string | undefined;

  const tenureFixture = loadTenureFixtureText(options);
  if (tenureFixture) {
    const tenureParsed = parseNhgisCookTenureHomeownershipFixtureCsv(tenureFixture.text);
    if (requireTenureDecades) {
      assertNhgisTenureHomeownershipDecadesPresent(tenureParsed.rows);
    }
    observations.push(...mapNhgisTenureRowsToObservations(tenureParsed.rows, retrievedAt));
    rejected.push(...tenureParsed.rejected);
    tenureDecades = tenureParsed.rows.map((row) => row.decade);
    tenureFixturePath = tenureFixture.path;
  }

  return {
    observations,
    rejected,
    decades: parsed.rows.map((row) => row.decade),
    tenureDecades,
    sourceUrl: NHGIS_HOMEPAGE_URL,
    fixturePath: path,
    ...(tenureFixturePath ? { tenureFixturePath } : {}),
  };
}

export {
  DEFAULT_FIXTURE_PATH,
  DEFAULT_TENURE_FIXTURE_PATH,
};
