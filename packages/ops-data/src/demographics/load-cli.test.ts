/**
 * Tests for the idempotent census county-decade load (`runDemographicsLoad`). Uses an injected
 * in-memory writer plus a fake `fetchImpl` replaying the Census data API's array-of-arrays
 * shape (the same seam `census-demographics/fetch-county-populations.ts` documents) — no
 * network, no Firestore, matching ../jurisdictions/load-cli.test.ts's approach.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CENSUS_DECENNIAL_VINTAGES } from '@repo/domain';
import {
  buildCensusCountyDecadeDoc,
  runDemographicsLoad,
  type CensusCountyDecadeWriteOutcome,
  type CensusCountyDecadeWriter,
} from './load-cli.js';
import { censusCountyDecadeSchema, type CensusCountyDecadeDoc } from './schema.js';

const VINTAGE_2020 = CENSUS_DECENNIAL_VINTAGES.find((v) => v.decade === '2020')!;

/** Minimal variables.json satisfying `assertVariableLabels` for a vintage. */
function fakeVariablesJson(vintage: typeof VINTAGE_2020) {
  return {
    variables: {
      [vintage.totalVariable]: { label: 'Total' },
      [vintage.blackAloneVariable]: {
        label: ' !!Total:!!Population of one race:!!Black or African American alone',
      },
    },
  };
}

function fakeDataPayload(vintage: typeof VINTAGE_2020, rows: readonly (readonly string[])[]) {
  return [['NAME', vintage.totalVariable, vintage.blackAloneVariable, 'state', 'county'], ...rows];
}

function createFakeFetch(vintage: typeof VINTAGE_2020, dataRows: readonly (readonly string[])[]) {
  return async (url: string) => {
    const payload = url.endsWith('/variables.json')
      ? fakeVariablesJson(vintage)
      : fakeDataPayload(vintage, dataRows);
    return { ok: true, status: 200, json: async () => payload };
  };
}

/** In-memory stand-in for Firestore: same contentHash-compare upsert the real CLI uses. */
function createInMemoryWriter(): CensusCountyDecadeWriter & {
  readonly store: Map<string, CensusCountyDecadeDoc>;
  readonly outcomes: CensusCountyDecadeWriteOutcome[];
} {
  const store = new Map<string, CensusCountyDecadeDoc>();
  const outcomes: CensusCountyDecadeWriteOutcome[] = [];
  return {
    store,
    outcomes,
    async upsert(doc) {
      const existing = store.get(doc.id);
      let outcome: CensusCountyDecadeWriteOutcome;
      if (!existing) {
        store.set(doc.id, doc);
        outcome = 'created';
      } else if (existing.contentHash === doc.contentHash) {
        outcome = 'unchanged';
      } else {
        store.set(doc.id, { ...doc, createdAt: existing.createdAt });
        outcome = 'updated';
      }
      outcomes.push(outcome);
      return outcome;
    },
  };
}

const SAMPLE_ROWS = [
  ['Autauga County, Alabama', '58805', '11496', '01', '001'],
  ['Baldwin County, Alabama', '231767', '20200', '01', '003'],
] as const;

test('loads one vintage into county-decade docs with full provenance', async () => {
  const writer = createInMemoryWriter();
  const summary = await runDemographicsLoad({
    writer,
    vintages: [VINTAGE_2020],
    fetchImpl: createFakeFetch(VINTAGE_2020, SAMPLE_ROWS),
    now: () => '2026-07-18T00:00:00.000Z',
  });

  assert.equal(summary.vintages.length, 1);
  assert.deepEqual(
    { fetched: 2, created: 2, updated: 0, unchanged: 0 },
    {
      fetched: summary.vintages[0]!.fetched,
      created: summary.vintages[0]!.created,
      updated: summary.vintages[0]!.updated,
      unchanged: summary.vintages[0]!.unchanged,
    },
  );

  const doc = writer.store.get('01001_2020');
  assert.ok(doc);
  censusCountyDecadeSchema.parse(doc);
  assert.equal(doc.totalPopulation, 58805);
  assert.equal(doc.blackPopulation, 11496);
  assert.equal(doc.source, VINTAGE_2020.sourceId);
  assert.equal(
    doc.sourceUrl,
    'https://www.census.gov/data/datasets/2020/dec/pl-94171.html',
    'sourceUrl must be the Census dataset landing page, not an API query',
  );
  assert.ok(!doc.sourceUrl.includes('api.census.gov'));
  assert.ok(!doc.sourceUrl.includes('key='), 'sourceUrl must never embed an API key');
});

test('re-running unchanged data reports all-unchanged and writes nothing', async () => {
  const writer = createInMemoryWriter();
  const options = {
    writer,
    vintages: [VINTAGE_2020],
    fetchImpl: createFakeFetch(VINTAGE_2020, SAMPLE_ROWS),
  };
  await runDemographicsLoad({ ...options, now: () => '2026-07-18T00:00:00.000Z' });
  // Second run at a later retrievedAt: contentHash excludes timestamps, so nothing changes.
  const second = await runDemographicsLoad({ ...options, now: () => '2026-07-19T00:00:00.000Z' });

  assert.equal(second.totalWritten, 0);
  assert.equal(second.vintages[0]!.unchanged, 2);
  assert.equal(writer.store.get('01001_2020')!.retrievedAt, '2026-07-18T00:00:00.000Z');
});

test('a changed count updates the doc and preserves createdAt', async () => {
  const writer = createInMemoryWriter();
  await runDemographicsLoad({
    writer,
    vintages: [VINTAGE_2020],
    fetchImpl: createFakeFetch(VINTAGE_2020, SAMPLE_ROWS),
    now: () => '2026-07-18T00:00:00.000Z',
  });
  const revised = [['Autauga County, Alabama', '58806', '11496', '01', '001']] as const;
  const summary = await runDemographicsLoad({
    writer,
    vintages: [VINTAGE_2020],
    fetchImpl: createFakeFetch(VINTAGE_2020, revised),
    now: () => '2026-07-19T00:00:00.000Z',
  });

  assert.equal(summary.vintages[0]!.updated, 1);
  const doc = writer.store.get('01001_2020')!;
  assert.equal(doc.totalPopulation, 58806);
  assert.equal(doc.createdAt, '2026-07-18T00:00:00.000Z');
  assert.equal(doc.updatedAt, '2026-07-19T00:00:00.000Z');
});

test('bad rows surface as rejections, never silently dropped', async () => {
  const writer = createInMemoryWriter();
  const badRows = [
    ['Autauga County, Alabama', '58805', '11496', '01', '001'],
    ['Nowhere County', 'not-a-number', '5', '01', '005'],
  ] as const;
  const summary = await runDemographicsLoad({
    writer,
    vintages: [VINTAGE_2020],
    fetchImpl: createFakeFetch(VINTAGE_2020, badRows),
  });

  assert.equal(summary.vintages[0]!.fetched, 1);
  assert.equal(summary.vintages[0]!.rejected.length, 1);
  assert.match(summary.vintages[0]!.rejected[0]!, /bad counts/);
});

test('buildCensusCountyDecadeDoc output always satisfies the schema and provenance assert', () => {
  const doc = buildCensusCountyDecadeDoc(
    {
      fips5: '01001',
      stateFips: '01',
      countyFips: '001',
      countyName: 'Autauga County, Alabama',
      decade: '2020',
      totalPopulation: 58805,
      blackPopulation: 11496,
    },
    VINTAGE_2020,
    '2026-07-18T00:00:00.000Z',
  );
  censusCountyDecadeSchema.parse(doc);
  assert.equal(doc.id, '01001_2020');
  assert.match(doc.contentHash, /^[a-f0-9]{64}$/);
});
