/**
 * Fixture-backed fetch for Phase 1 HUD CHAS Cook County Table 9 cost-burden observations.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME,
  HUD_CHAS_DATA_DOWNLOAD_URL,
  PHASE1_HUD_CHAS_REFERENCE_PERIOD,
} from './constants.js';
import {
  assertChasCookThemeImpactRowsPresent,
  mapChasRowsToObservations,
  parseChasCookCostBurdenFixtureCsv,
  type Phase1ChasObservationDraft,
} from './phase1-chas-mapper.js';

export type Phase1ChasFetchResult = {
  readonly observations: readonly Phase1ChasObservationDraft[];
  readonly rejected: readonly string[];
  readonly referencePeriod: string;
  readonly sourceUrl: string;
  readonly fixturePath: string;
};

type FetchOptions = {
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
  readonly requireThemeImpactRows?: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../../../../firebase/fixtures/reference-indicators',
  HUD_CHAS_COOK_COST_BURDEN_FIXTURE_FILENAME,
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

export function fetchPhase1ChasObservations(options: FetchOptions = {}): Phase1ChasFetchResult {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const requireThemeImpactRows = options.requireThemeImpactRows ?? true;
  const loaded = loadFixtureText(options);
  const parsed = parseChasCookCostBurdenFixtureCsv(loaded.text);

  if (requireThemeImpactRows) {
    assertChasCookThemeImpactRowsPresent(parsed.rows);
  }

  const observations = mapChasRowsToObservations(parsed.rows, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    referencePeriod: PHASE1_HUD_CHAS_REFERENCE_PERIOD,
    sourceUrl: HUD_CHAS_DATA_DOWNLOAD_URL,
    fixturePath: loaded.path,
  };
}

export { DEFAULT_FIXTURE_PATH };
