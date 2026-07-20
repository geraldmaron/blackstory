/**
 * Idempotent load/refresh CLI for `censusStateDecades` — twps0056 Tables 15–65 (1790–1990).
 * Mirrors `./national-load-cli.ts`: injectable writer for unit tests; CLI block writes Firestore.
 *
 * Parse target: committed `./data/twps0056-state-1790-1990.csv` (derived from tabs15-65.xlsx;
 * see scripts/derive-twps0056-state.py). Fail-closed on header drift. State Black sums per decade
 * are validated at derivation time against the national CSV.
 *
 * Run:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \\
 *     node --conditions development --import tsx \\
 *     packages/firebase/src/demographics/state-load-cli.ts
 */
import { readFileSync } from 'node:fs';
import {
  assertPublishedStatisticProvenance,
  getExternalDataSource,
  hashUtf8,
  sha256Json,
  HISTORICAL_NATIONAL_DECADES,
  FREE_ENSLAVED_SPLIT_DECADES,
} from '@repo/domain';
import { createServerFirebaseApp } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import {
  censusStateDecadeId,
  censusStateDecadeSchema,
  parseCensusStateDecadeDoc,
  type CensusStateDecadeDoc,
} from './schema.js';

export const TWPS0056_SOURCE_ID = 'us-census-historical-race-1790-1990';

const EXPECTED_HEADER =
  'stateFips,stateName,decade,totalPopulation,blackPopulation,blackFree,blackSlave';

export type CensusStateDecadeWriteOutcome = 'created' | 'updated' | 'unchanged';

export type CensusStateDecadeWriter = {
  upsert(doc: CensusStateDecadeDoc): Promise<CensusStateDecadeWriteOutcome>;
};

export type Twps0056StateRow = {
  readonly stateFips: string;
  readonly stateName: string;
  readonly decade: string;
  readonly totalPopulation: number;
  readonly blackPopulation: number;
  readonly freeBlackPopulation?: number;
  readonly enslavedBlackPopulation?: number;
};

function parseIntStrict(value: string, field: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`twps0056 state parse: ${field} for ${label} is not an integer: "${value}"`);
  }
  return Number(value);
}

export function parseTwps0056StateCsv(csvText: string): Twps0056StateRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const header = lines.shift();
  if (header !== EXPECTED_HEADER) {
    throw new Error(
      `twps0056 state parse: unexpected header. expected "${EXPECTED_HEADER}", got "${header ?? '<none>'}"`,
    );
  }

  const historical = new Set<string>(HISTORICAL_NATIONAL_DECADES as readonly string[]);
  const split = new Set<string>(FREE_ENSLAVED_SPLIT_DECADES as readonly string[]);
  const rows: Twps0056StateRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const cells = line.split(',');
    if (cells.length !== 7) {
      throw new Error(`twps0056 state parse: expected 7 columns, got ${cells.length} in "${line}"`);
    }
    const [stateFips, stateName, decade, totalRaw, blackRaw, freeRaw, slaveRaw] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (!/^\d{2}$/.test(stateFips)) {
      throw new Error(`twps0056 state parse: bad stateFips "${stateFips}"`);
    }
    if (!historical.has(decade)) {
      throw new Error(`twps0056 state parse: unexpected decade "${decade}"`);
    }
    const key = `${stateFips}_${decade}`;
    if (seen.has(key)) {
      throw new Error(`twps0056 state parse: duplicate ${key}`);
    }
    seen.add(key);

    const totalPopulation = parseIntStrict(totalRaw, 'totalPopulation', key);
    const blackPopulation = parseIntStrict(blackRaw, 'blackPopulation', key);
    const hasFree = freeRaw !== '';
    const hasSlave = slaveRaw !== '';
    if (hasFree !== hasSlave) {
      throw new Error(`twps0056 state parse: ${key} must carry free AND slave or neither`);
    }

    if (hasFree) {
      if (!split.has(decade)) {
        throw new Error(
          `twps0056 state parse: ${key} must NOT carry free/slave (post-emancipation)`,
        );
      }
      const freeBlackPopulation = parseIntStrict(freeRaw, 'blackFree', key);
      const enslavedBlackPopulation = parseIntStrict(slaveRaw, 'blackSlave', key);
      if (Math.abs(freeBlackPopulation + enslavedBlackPopulation - blackPopulation) > 5) {
        throw new Error(
          `twps0056 state parse: ${key} free+slave does not reconstitute Black total`,
        );
      }
      rows.push({
        stateFips,
        stateName,
        decade,
        totalPopulation,
        blackPopulation,
        freeBlackPopulation,
        enslavedBlackPopulation,
      });
    } else {
      rows.push({ stateFips, stateName, decade, totalPopulation, blackPopulation });
    }
  }

  return rows;
}

export function censusStateDecadeContentFields(
  row: Twps0056StateRow,
  source: string,
  sourceUrl: string,
): Record<string, string | number> {
  return {
    stateFips: row.stateFips,
    stateName: row.stateName,
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

export function buildCensusStateDecadeDoc(input: {
  readonly row: Twps0056StateRow;
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly datasetChecksum: string;
  readonly nowIso: string;
}): CensusStateDecadeDoc {
  const { row, source, sourceUrl, license, datasetChecksum, nowIso } = input;
  const decade = row.decade as CensusStateDecadeDoc['decade'];
  const doc: CensusStateDecadeDoc = {
    id: censusStateDecadeId(row.stateFips, decade),
    stateFips: row.stateFips,
    stateName: row.stateName,
    decade,
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
    contentHash: sha256Json(censusStateDecadeContentFields(row, source, sourceUrl)).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return censusStateDecadeSchema.parse(doc);
}

export type RunStateDemographicsLoadOptions = {
  readonly writer: CensusStateDecadeWriter;
  readonly csvText?: string;
  readonly now?: () => string;
};

export type RunStateDemographicsLoadSummary = {
  readonly parsed: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly datasetChecksum: string;
};

export function loadDefaultTwps0056StateCsv(): string {
  return readFileSync(new URL('./data/twps0056-state-1790-1990.csv', import.meta.url), 'utf8');
}

export async function runStateDemographicsLoad(
  options: RunStateDemographicsLoadOptions,
): Promise<RunStateDemographicsLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const csvText = options.csvText ?? loadDefaultTwps0056StateCsv();

  const source = getExternalDataSource(TWPS0056_SOURCE_ID);
  if (!source) {
    throw new Error(`External source ${TWPS0056_SOURCE_ID} is not registered`);
  }
  if (source.license.verdict !== 'public-domain') {
    throw new Error(
      `Refusing to load ${TWPS0056_SOURCE_ID}: license verdict is ${source.license.verdict}`,
    );
  }

  const rows = parseTwps0056StateCsv(csvText);
  const datasetChecksum = hashUtf8(csvText).digest;
  const nowIso = now();

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  for (const row of rows) {
    const doc = buildCensusStateDecadeDoc({
      row,
      source: source.id,
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const { getFirestore } = await import('firebase-admin/firestore');

  const { app } = createServerFirebaseApp(process.env);
  const firestore = getFirestore(app);
  const collection = firestore.collection(FIRESTORE_ROOT.censusStateDecades);

  const firestoreWriter: CensusStateDecadeWriter = {
    async upsert(doc) {
      const snapshot = await collection.doc(doc.id).get();
      if (snapshot.exists) {
        const existing = parseCensusStateDecadeDoc(snapshot.data());
        if (existing.contentHash === doc.contentHash) return 'unchanged';
        await collection.doc(doc.id).set({ ...doc, createdAt: existing.createdAt });
        return 'updated';
      }
      await collection.doc(doc.id).set(doc);
      return 'created';
    },
  };

  const summary = await runStateDemographicsLoad({ writer: firestoreWriter });
  console.log(JSON.stringify(summary, null, 2));
}
