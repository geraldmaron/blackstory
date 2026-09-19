/** Deterministic source parsing and ingestion through an injected record writer. */
import { readFileSync } from 'node:fs';
import {
  assertPublishedStatisticProvenance,
  getExternalDataSource,
  hashUtf8,
  sha256Json,
  HISTORICAL_NATIONAL_DECADES,
  FREE_ENSLAVED_SPLIT_DECADES,
} from '@repo/domain';
import {
  censusNationalDecadeId,
  censusNationalDecadeSchema,
  type CensusNationalDecadeDoc,
} from './schema.js';

export const TWPS0056_SOURCE_ID = 'us-census-historical-race-1790-1990';

const EXPECTED_HEADER = 'decade,totalPopulation,blackPopulation,blackFree,blackSlave';

export type CensusNationalDecadeWriteOutcome = 'created' | 'updated' | 'unchanged';

export type CensusNationalDecadeWriter = {
  upsert(doc: CensusNationalDecadeDoc): Promise<CensusNationalDecadeWriteOutcome>;
};

/** One parsed CSV row; free/slave present only for the 1790–1860 split decades. */
export type Twps0056NationalRow = {
  readonly decade: string;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  readonly freeBlackPopulation?: number;
  readonly enslavedBlackPopulation?: number;
};

function parseIntStrict(value: string, field: string, decade: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `twps0056 parse: ${field} for decade ${decade} is not a non-negative integer: "${value}"`,
    );
  }
  return Number(value);
}

/**
 * Parses the normalized twps0056 national CSV, fail-closed. Throws on header drift, unexpected
 * or missing decades, malformed numbers, or a free/slave split that does not reconstitute the
 * Black total (beyond twps0056's independent per-column rounding tolerance of 5).
 */
export function parseTwps0056NationalCsv(csvText: string): Twps0056NationalRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const header = lines.shift();
  if (header !== EXPECTED_HEADER) {
    throw new Error(
      `twps0056 parse: unexpected header. expected "${EXPECTED_HEADER}", got "${header ?? '<none>'}"`,
    );
  }

  const splitDecades = new Set(FREE_ENSLAVED_SPLIT_DECADES as readonly string[]);
  const seen = new Set<string>();
  const rows: Twps0056NationalRow[] = [];

  for (const line of lines) {
    const cells = line.split(',');
    if (cells.length !== 5) {
      throw new Error(`twps0056 parse: expected 5 columns, got ${cells.length} in "${line}"`);
    }
    const [decade, totalRaw, blackRaw, freeRaw, slaveRaw] = cells as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (!(HISTORICAL_NATIONAL_DECADES as readonly string[]).includes(decade)) {
      throw new Error(
        `twps0056 parse: unexpected decade "${decade}" (not in the 1790–1990 registry)`,
      );
    }
    if (seen.has(decade)) {
      throw new Error(`twps0056 parse: duplicate decade "${decade}"`);
    }
    seen.add(decade);

    const totalPopulation = parseIntStrict(totalRaw, 'totalPopulation', decade);
    const blackPopulation = parseIntStrict(blackRaw, 'blackPopulation', decade);
    const hasFree = freeRaw !== '';
    const hasSlave = slaveRaw !== '';

    if (splitDecades.has(decade)) {
      if (!hasFree || !hasSlave) {
        throw new Error(`twps0056 parse: decade ${decade} must carry free AND slave columns`);
      }
      const freeBlackPopulation = parseIntStrict(freeRaw, 'blackFree', decade);
      const enslavedBlackPopulation = parseIntStrict(slaveRaw, 'blackSlave', decade);
      if (Math.abs(freeBlackPopulation + enslavedBlackPopulation - blackPopulation) > 5) {
        throw new Error(
          `twps0056 parse: decade ${decade} free+slave (${freeBlackPopulation + enslavedBlackPopulation}) does not reconstitute Black total (${blackPopulation})`,
        );
      }
      rows.push({
        decade,
        totalPopulation,
        blackPopulation,
        freeBlackPopulation,
        enslavedBlackPopulation,
      });
    } else {
      if (hasFree || hasSlave) {
        throw new Error(
          `twps0056 parse: decade ${decade} must NOT carry free/slave columns (post-emancipation)`,
        );
      }
      rows.push({ decade, totalPopulation, blackPopulation });
    }
  }

  const missing = (HISTORICAL_NATIONAL_DECADES as readonly string[]).filter((d) => !seen.has(d));
  if (missing.length > 0) {
    throw new Error(`twps0056 parse: missing decades ${missing.join(', ')}`);
  }
  return rows;
}

/** Stable fields the per-row `contentHash` covers (excludes retrieval/write timestamps). */
export function censusNationalDecadeContentFields(
  row: Twps0056NationalRow,
  source: string,
  sourceUrl: string,
): Record<string, string | number> {
  return {
    decade: row.decade,
    totalPopulation: row.totalPopulation,
    blackPopulation: row.blackPopulation,
    ...(row.freeBlackPopulation !== undefined
      ? { freeBlackPopulation: row.freeBlackPopulation }
      : {}),
    ...(row.enslavedBlackPopulation !== undefined
      ? { enslavedBlackPopulation: row.enslavedBlackPopulation }
      : {}),
    source,
    sourceUrl,
  };
}

export function buildCensusNationalDecadeDoc(input: {
  readonly row: Twps0056NationalRow;
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly datasetChecksum: string;
  readonly nowIso: string;
}): CensusNationalDecadeDoc {
  const { row, source, sourceUrl, license, datasetChecksum, nowIso } = input;
  const doc: CensusNationalDecadeDoc = {
    id: censusNationalDecadeId(row.decade as CensusNationalDecadeDoc['decade']),
    decade: row.decade as CensusNationalDecadeDoc['decade'],
    totalPopulation: row.totalPopulation,
    blackPopulation: row.blackPopulation,
    ...(row.freeBlackPopulation !== undefined
      ? { freeBlackPopulation: row.freeBlackPopulation }
      : {}),
    ...(row.enslavedBlackPopulation !== undefined
      ? { enslavedBlackPopulation: row.enslavedBlackPopulation }
      : {}),
    source,
    sourceUrl,
    datasetChecksum,
    license,
    retrievedAt: nowIso,
    contentHash: sha256Json(censusNationalDecadeContentFields(row, source, sourceUrl)).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return censusNationalDecadeSchema.parse(doc);
}

export type RunNationalDemographicsLoadOptions = {
  readonly writer: CensusNationalDecadeWriter;
  /** CSV artifact text; defaults to the committed twps0056 national CSV. */
  readonly csvText?: string;
  readonly now?: () => string;
};

export type RunNationalDemographicsLoadSummary = {
  readonly parsed: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly datasetChecksum: string;
};

export function loadDefaultTwps0056Csv(): string {
  return readFileSync(new URL('./data/twps0056-national-1790-1990.csv', import.meta.url), 'utf8');
}

export async function runNationalDemographicsLoad(
  options: RunNationalDemographicsLoadOptions,
): Promise<RunNationalDemographicsLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const csvText = options.csvText ?? loadDefaultTwps0056Csv();

  const source = getExternalDataSource(TWPS0056_SOURCE_ID);
  if (!source) {
    throw new Error(`External source ${TWPS0056_SOURCE_ID} is not registered`);
  }
  if (source.license.verdict !== 'public-domain') {
    throw new Error(
      `Refusing to load ${TWPS0056_SOURCE_ID}: license verdict is ${source.license.verdict}`,
    );
  }

  const rows = parseTwps0056NationalCsv(csvText);
  const datasetChecksum = hashUtf8(csvText).digest;
  const nowIso = now();

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const row of rows) {
    const doc = buildCensusNationalDecadeDoc({
      row,
      source: source.id,
      // Human citation surface — never the raw table01.xlsx machine URL.
      sourceUrl: source.homepageUrl,
      license: source.license.name,
      datasetChecksum,
      nowIso,
    });
    const outcome = await options.writer.upsert(doc);
    if (outcome === 'created') created += 1;
    else if (outcome === 'updated') updated += 1;
    else unchanged += 1;
  }

  return { parsed: rows.length, created, updated, unchanged, datasetChecksum };
}
