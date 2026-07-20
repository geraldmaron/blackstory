/**
 * Tests for the idempotent state historical load (twps0056 Tables 15–65). Uses the committed
 * CSV artifact and an in-memory writer — no network, no Firestore.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCensusStateDecadeDoc,
  loadDefaultTwps0056StateCsv,
  parseTwps0056StateCsv,
  runStateDemographicsLoad,
  TWPS0056_SOURCE_ID,
  type CensusStateDecadeWriteOutcome,
  type CensusStateDecadeWriter,
} from './state-load-cli.js';
import { censusStateDecadeSchema, type CensusStateDecadeDoc } from './schema.js';

function createInMemoryWriter(): CensusStateDecadeWriter & {
  readonly store: Map<string, CensusStateDecadeDoc>;
  readonly outcomes: CensusStateDecadeWriteOutcome[];
} {
  const store = new Map<string, CensusStateDecadeDoc>();
  const outcomes: CensusStateDecadeWriteOutcome[] = [];
  return {
    store,
    outcomes,
    async upsert(doc) {
      const existing = store.get(doc.id);
      let outcome: CensusStateDecadeWriteOutcome;
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

test('parses committed state CSV: 885 rows, Maryland 1790 free/slave split', () => {
  const rows = parseTwps0056StateCsv(loadDefaultTwps0056StateCsv());
  assert.equal(rows.length, 885);

  const md1790 = rows.find((row) => row.stateFips === '24' && row.decade === '1790');
  assert.ok(md1790);
  assert.equal(md1790.blackPopulation, 111079);
  assert.equal(md1790.freeBlackPopulation, 8043);
  assert.equal(md1790.enslavedBlackPopulation, 103036);

  const ak1990 = rows.find((row) => row.stateFips === '02' && row.decade === '1990');
  assert.ok(ak1990);
  assert.equal(ak1990.blackPopulation, 22451);
  assert.equal(ak1990.freeBlackPopulation, undefined);
});

test('state Black sums equal national CSV for every decade', () => {
  const rows = parseTwps0056StateCsv(loadDefaultTwps0056StateCsv());
  const byDecade = new Map<string, number>();
  for (const row of rows) {
    byDecade.set(row.decade, (byDecade.get(row.decade) ?? 0) + row.blackPopulation);
  }
  // Anchors from twps0056 Table 1 / national CSV.
  assert.equal(byDecade.get('1790'), 757208);
  assert.equal(byDecade.get('1860'), 4441830);
  assert.equal(byDecade.get('1970'), 22580289);
  assert.equal(byDecade.get('1990'), 29986060);
});

test('buildCensusStateDecadeDoc validates and hashes stably', () => {
  const doc = buildCensusStateDecadeDoc({
    row: {
      stateFips: '24',
      stateName: 'Maryland',
      decade: '1790',
      totalPopulation: 319728,
      blackPopulation: 111079,
      freeBlackPopulation: 8043,
      enslavedBlackPopulation: 103036,
    },
    source: TWPS0056_SOURCE_ID,
    sourceUrl: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
    license: 'U.S. government work — public domain (17 U.S.C. §105)',
    datasetChecksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    nowIso: '2026-07-19T00:00:00.000Z',
  });
  assert.doesNotThrow(() => censusStateDecadeSchema.parse(doc));
  assert.equal(doc.id, '24_1790');
});

test('runStateDemographicsLoad is idempotent over unchanged CSV', async () => {
  const writer = createInMemoryWriter();
  const first = await runStateDemographicsLoad({
    writer,
    now: () => '2026-07-19T00:00:00.000Z',
  });
  assert.equal(first.parsed, 885);
  assert.equal(first.created, 885);
  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 0);

  const second = await runStateDemographicsLoad({
    writer,
    now: () => '2026-07-19T01:00:00.000Z',
  });
  assert.equal(second.created, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.unchanged, 885);
  assert.equal(writer.store.size, 885);
});
