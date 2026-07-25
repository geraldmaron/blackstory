/**
 * Tests for the idempotent national historical load (twps0056 lane). Uses the committed CSV
 * artifact for the happy path and an injected in-memory writer — no network, no Firestore.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCensusNationalDecadeDoc,
  loadDefaultTwps0056Csv,
  parseTwps0056NationalCsv,
  runNationalDemographicsLoad,
  TWPS0056_SOURCE_ID,
  type CensusNationalDecadeWriteOutcome,
  type CensusNationalDecadeWriter,
} from './national-load-cli.js';
import { censusNationalDecadeSchema, type CensusNationalDecadeDoc } from './schema.js';

function createInMemoryWriter(): CensusNationalDecadeWriter & {
  readonly store: Map<string, CensusNationalDecadeDoc>;
  readonly outcomes: CensusNationalDecadeWriteOutcome[];
} {
  const store = new Map<string, CensusNationalDecadeDoc>();
  const outcomes: CensusNationalDecadeWriteOutcome[] = [];
  return {
    store,
    outcomes,
    async upsert(doc) {
      const existing = store.get(doc.id);
      let outcome: CensusNationalDecadeWriteOutcome;
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

test('parses the committed twps0056 CSV: 21 decades, split only 1790–1860, real anchor values', () => {
  const rows = parseTwps0056NationalCsv(loadDefaultTwps0056Csv());
  assert.equal(rows.length, 21);
  assert.equal(rows[0]!.decade, '1790');
  assert.equal(rows.at(-1)!.decade, '1990');

  const y1790 = rows.find((r) => r.decade === '1790')!;
  assert.equal(y1790.totalPopulation, 3_929_214);
  assert.equal(y1790.blackPopulation, 757_208);
  assert.equal(y1790.freeBlackPopulation, 59_527);
  assert.equal(y1790.enslavedBlackPopulation, 697_681);
  assert.equal(y1790.freeBlackPopulation! + y1790.enslavedBlackPopulation!, y1790.blackPopulation);

  const y1860 = rows.find((r) => r.decade === '1860')!;
  assert.equal(y1860.enslavedBlackPopulation, 3_953_760);

  const y1870 = rows.find((r) => r.decade === '1870')!;
  assert.equal(y1870.freeBlackPopulation, undefined, 'no free/enslaved split after emancipation');
  assert.equal(y1870.blackPopulation, 4_880_009);

  const y1990 = rows.find((r) => r.decade === '1990')!;
  assert.equal(y1990.blackPopulation, 29_986_060);
});

const HEADER = 'decade,totalPopulation,blackPopulation,blackFree,blackSlave';

test('fails closed on header drift', () => {
  assert.throws(
    () => parseTwps0056NationalCsv('decade,total,black\n1790,1,1'),
    /unexpected header/,
  );
});

test('fails closed on an unexpected decade', () => {
  assert.throws(() => parseTwps0056NationalCsv(`${HEADER}\n1785,100,10,5,5`), /unexpected decade/);
});

test('fails closed on a free/slave split that does not reconstitute the Black total', () => {
  assert.throws(
    () => parseTwps0056NationalCsv(`${HEADER}\n1790,3929214,757208,59527,600000`),
    /does not reconstitute/,
  );
});

test('fails closed when a post-1860 decade carries free/slave columns', () => {
  // A single malformed row still trips the guard even though other decades are absent.
  assert.throws(
    () => parseTwps0056NationalCsv(`${HEADER}\n1870,38558371,4880009,100,200`),
    /must NOT carry free\/slave/,
  );
});

test('fails closed on a missing decade', () => {
  assert.throws(
    () => parseTwps0056NationalCsv(`${HEADER}\n1790,3929214,757208,59527,697681`),
    /missing decades/,
  );
});

test('build produces a schema-valid, provenance-complete doc', () => {
  const doc = buildCensusNationalDecadeDoc({
    row: {
      decade: '1790',
      totalPopulation: 3_929_214,
      blackPopulation: 757_208,
      freeBlackPopulation: 59_527,
      enslavedBlackPopulation: 697_681,
    },
    source: TWPS0056_SOURCE_ID,
    sourceUrl: 'https://www.census.gov/library/working-papers/2002/demo/POP-twps0056.html',
    license: 'U.S. government work — public domain (17 U.S.C. §105)',
    datasetChecksum: 'a'.repeat(64),
    nowIso: '2026-07-19T00:00:00.000Z',
  });
  assert.doesNotThrow(() => censusNationalDecadeSchema.parse(doc));
  assert.equal(doc.id, '1790');
  assert.match(doc.contentHash, /^[a-f0-9]{64}$/);
});

test('load is idempotent: create then a second run is entirely unchanged', async () => {
  const writer = createInMemoryWriter();
  const now = () => '2026-07-19T00:00:00.000Z';

  const first = await runNationalDemographicsLoad({ writer, now });
  assert.equal(first.parsed, 21);
  assert.equal(first.created, 21);
  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 0);

  const second = await runNationalDemographicsLoad({
    writer,
    now: () => '2027-01-01T00:00:00.000Z',
  });
  assert.equal(second.created, 0);
  assert.equal(second.updated, 0);
  assert.equal(
    second.unchanged,
    21,
    'retrievedAt is excluded from contentHash — re-run is a no-op',
  );
});

test('a changed source value updates exactly that decade and preserves createdAt', async () => {
  const writer = createInMemoryWriter();
  const csv = loadDefaultTwps0056Csv();
  await runNationalDemographicsLoad({
    writer,
    csvText: csv,
    now: () => '2026-07-19T00:00:00.000Z',
  });
  const createdAt = writer.store.get('1990')!.createdAt;

  const bumped = csv.replace('248709873,29986060', '248709873,29986061');
  const summary = await runNationalDemographicsLoad({
    writer,
    csvText: bumped,
    now: () => '2027-01-01T00:00:00.000Z',
  });
  assert.equal(summary.updated, 1);
  assert.equal(summary.unchanged, 20);
  assert.equal(writer.store.get('1990')!.blackPopulation, 29_986_061);
  assert.equal(writer.store.get('1990')!.createdAt, createdAt, 'createdAt preserved across update');
});
