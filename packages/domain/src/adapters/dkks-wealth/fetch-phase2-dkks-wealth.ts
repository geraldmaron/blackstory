/**
 * Fixture-backed fetch for Phase 2 DKKS "Wealth of Two Nations" national
 * wealth-gap observations. Loads the curated author-hosted benchmark-year
 * fixture — no scraping of the workbook at run time.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DKKS_WEALTH_FIXTURE_FILENAME, DKKS_WEALTH_GAP_SOURCE_URL } from './constants.js';
import {
  mapDkksWealthRowsToObservations,
  parseDkksWealthGapFixtureCsv,
  type Phase2DkksWealthObservationDraft,
} from './phase2-dkks-wealth-mapper.js';

export type Phase2DkksWealthFetchResult = {
  readonly observations: readonly Phase2DkksWealthObservationDraft[];
  readonly rejected: readonly string[];
  readonly referenceYears: readonly number[];
  readonly sourceUrl: string;
  readonly fixturePath: string;
};

type FetchOptions = {
  readonly fixtureCsvText?: string;
  readonly fixturePath?: string;
  readonly retrievedAt?: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  __dirname,
  '../../../../ops-data/fixtures/reference-indicators',
  DKKS_WEALTH_FIXTURE_FILENAME,
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

export function fetchPhase2DkksWealthObservations(
  options: FetchOptions = {},
): Phase2DkksWealthFetchResult {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();
  const { text, path } = loadFixtureText(options);
  const parsed = parseDkksWealthGapFixtureCsv(text);
  const observations = mapDkksWealthRowsToObservations(parsed.rows, retrievedAt);

  return {
    observations,
    rejected: parsed.rejected,
    referenceYears: parsed.rows.map((row) => row.referenceYear),
    sourceUrl: DKKS_WEALTH_GAP_SOURCE_URL,
    fixturePath: path,
  };
}

export { DEFAULT_FIXTURE_PATH };
