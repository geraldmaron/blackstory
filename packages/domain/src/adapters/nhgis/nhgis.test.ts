import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  assertNhgisApiKeyConfigured,
  buildNhgisExtractDefinition,
  getNhgisExtractStatus,
  nhgisCountyRaceFromCsv,
  parseNhgisCountyRaceCsv,
  submitNhgisExtract,
  type NhgisFetchLike,
} from './index.js';

const SAMPLE = readFileSync(
  new URL('./__fixtures__/nhgis-1860-county-race-sample.csv', import.meta.url),
  'utf8',
);

test('parses real 1860 county race/slave rows, skipping the description header row', () => {
  const rows = parseNhgisCountyRaceCsv(SAMPLE, '1860');
  assert.equal(rows.length, 5, 'two header lines skipped; five data rows');

  const autauga = rows[0]!;
  assert.equal(autauga.gisJoin, 'G0100010');
  assert.equal(autauga.stateName, 'Alabama');
  assert.equal(autauga.countyName, 'Autauga');
  assert.equal(autauga.boundaryVersion, 'nhgis-1860');
  assert.equal(autauga.white, 7105);
  assert.equal(autauga.blackFree, 14);
  assert.equal(autauga.blackEnslaved, 9607);
  assert.equal(autauga.black, 9621, 'Black = free colored + slave');

  const baldwin = rows[1]!;
  assert.equal(baldwin.black, 140 + 3714);
});

test('nhgisCountyRaceFromCsv wraps the parse in a result envelope', () => {
  const result = nhgisCountyRaceFromCsv(SAMPLE, '1860');
  assert.equal(result.request.decade, '1860');
  assert.equal(result.rows.length, 5);
  assert.deepEqual(result.rejected, []);
});

test('fails closed on an unregistered decade', () => {
  assert.throws(() => parseNhgisCountyRaceCsv(SAMPLE, '1855'), /no registered race table/);
});

test('fails closed when a required variable column is missing', () => {
  const broken = SAMPLE.replace('AH3003', 'ZZZ999'); // drop the Slave column code
  assert.throws(() => parseNhgisCountyRaceCsv(broken, '1860'), /missing required columns/);
});

test('fails closed when a row YEAR does not match the requested decade', () => {
  const wrongYear = SAMPLE.replace(
    '"1860","Alabama","010","Autauga"',
    '"1870","Alabama","010","Autauga"',
  );
  assert.throws(
    () => parseNhgisCountyRaceCsv(wrongYear, '1860'),
    /does not match requested decade/,
  );
});

test('buildNhgisExtractDefinition targets the 1860 dataset/table at county geography', () => {
  const def = buildNhgisExtractDefinition('1860') as {
    datasets: Record<string, { dataTables: string[]; geogLevels: string[] }>;
    dataFormat: string;
  };
  assert.deepEqual(def.datasets['1860_cPAX'], { dataTables: ['NT6'], geogLevels: ['county'] });
  assert.equal(def.dataFormat, 'csv_header');
});

test('extract client requires an API key and threads the injected fetch', async () => {
  assert.throws(() => assertNhgisApiKeyConfigured(undefined), /NHGIS_API_KEY required/);

  const calls: string[] = [];
  const fakeFetch: NhgisFetchLike = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (init?.method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ number: 42, status: 'queued' }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 'completed',
        downloadLinks: { tableData: { url: 'https://dl/x.zip' } },
      }),
    };
  };

  const handle = await submitNhgisExtract(buildNhgisExtractDefinition('1860'), {
    apiKey: 'k',
    fetchImpl: fakeFetch,
  });
  assert.equal(handle.number, 42);

  const status = await getNhgisExtractStatus(42, { apiKey: 'k', fetchImpl: fakeFetch });
  assert.equal(status.status, 'completed');
  assert.equal(status.tableDataUrl, 'https://dl/x.zip');
  assert.ok(calls.some((c) => c.startsWith('POST')) && calls.some((c) => c.startsWith('GET')));
});
