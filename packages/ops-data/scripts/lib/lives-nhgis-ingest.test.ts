import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { LivesPublishedObservation } from '../../src/lives/published-observation.ts';
import {
  downloadNhgisExtract,
  livesSeriesForObservations,
  summarizeLivesObservations,
} from './lives-nhgis-ingest.ts';

const TABLE_URL = 'https://api.ipums.org/downloads/nhgis/api/v1/extracts/123/nhgis0001_csv.zip';

function archiveFixture(
  entries: { name: string; mode?: number; declaredSize?: number }[],
): Uint8Array {
  return new Uint8Array(
    execFileSync(
      'python3',
      [
        '-I',
        '-c',
        `
import io, json, struct, sys, zipfile
entries = json.loads(sys.stdin.read())
data = io.BytesIO()
with zipfile.ZipFile(data, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for entry in entries:
        info = zipfile.ZipInfo(entry['name'])
        info.external_attr = entry.get('mode', 0o100600) << 16
        archive.writestr(info, b'GISJOIN,NAME\\nG0100010,Caf\\xe9\\n')
payload = bytearray(data.getvalue())
for entry in entries:
    if 'declaredSize' in entry:
        offset = payload.index(b'PK\\x01\\x02')
        struct.pack_into('<I', payload, offset + 24, entry['declaredSize'])
sys.stdout.buffer.write(payload)
`,
      ],
      { input: JSON.stringify(entries), stdio: ['pipe', 'pipe', 'pipe'] },
    ),
  );
}

test('NHGIS downloads authenticate only to IPUMS and preserve table/codebook bytes privately', async (t) => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'nhgis-download-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  const archive = archiveFixture([{ name: 'tables/county.csv' }, { name: 'codebook.txt' }]);
  const directory = await downloadNhgisExtract({
    url: TABLE_URL,
    apiKey: 'test-credential',
    cacheDir,
    fetchImpl: async (url, options) => {
      assert.equal(url, TABLE_URL);
      assert.deepEqual(options?.headers, { Authorization: 'test-credential' });
      assert.equal(options?.redirect, 'error');
      assert.ok(options?.signal instanceof AbortSignal);
      return new Response(archive);
    },
  });
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(path.join(directory, 'tables/county.csv'))).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(directory), ['codebook.txt', 'tables']);
  assert.deepEqual(
    await readFile(path.join(directory, 'tables/county.csv')),
    Buffer.from('GISJOIN,NAME\nG0100010,Caf\xe9\n', 'latin1'),
  );
});

test('NHGIS rejects foreign, ambiguous or redirecting downloads before using credentials elsewhere', async (t) => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'nhgis-origin-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  for (const url of [
    'https://api.ipums.org.example.net/downloads/nhgis/a.zip',
    'https://example.net/downloads/nhgis/a.zip',
    'http://api.ipums.org/downloads/nhgis/a.zip',
    'https://user:password@api.ipums.org/downloads/nhgis/a.zip',
    'https://api.ipums.org:8443/downloads/nhgis/a.zip',
    'https://api.ipums.org/downloads/nhgis/../../other.zip',
    `${TABLE_URL}?redirect=https://example.net`,
    `${TABLE_URL}#fragment`,
  ]) {
    await assert.rejects(
      downloadNhgisExtract({
        url,
        apiKey: 'test-credential',
        cacheDir,
        fetchImpl: async () => {
          assert.fail('invalid URL must never be fetched');
        },
      }),
      /official IPUMS table endpoint/,
    );
  }
  await assert.rejects(
    downloadNhgisExtract({
      url: TABLE_URL,
      apiKey: 'test-credential',
      cacheDir,
      fetchImpl: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.net/archive.zip' },
        }),
    }),
    /HTTP 302/,
  );
  assert.deepEqual(await readdir(cacheDir), []);
});

test('NHGIS bounds declared and streamed downloads before extraction', async (t) => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'nhgis-size-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  const options = { url: TABLE_URL, apiKey: 'test-credential', cacheDir };
  await assert.rejects(
    downloadNhgisExtract({
      ...options,
      fetchImpl: async () =>
        new Response('small', { headers: { 'content-length': String(129 * 1024 * 1024) } }),
    }),
    /compressed byte limit/,
  );
  let canceled = false;
  const chunk = new Uint8Array(1024 * 1024);
  await assert.rejects(
    downloadNhgisExtract({
      ...options,
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(chunk);
            },
            cancel() {
              canceled = true;
            },
          }),
          { headers: { 'content-length': '1' } },
        ),
    }),
    /compressed byte limit/,
  );
  assert.equal(canceled, true);
  assert.deepEqual(await readdir(cacheDir), []);
});

test('NHGIS rejects traversal, links, duplicate paths, executable entries and expansion bombs', async (t) => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'nhgis-archive-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  for (const entries of [
    [{ name: '../escape.csv' }],
    [{ name: '/absolute.csv' }],
    [{ name: 'nested/../../escape.csv' }],
    [{ name: 'nested\\escape.csv' }],
    [{ name: 'link.csv', mode: 0o120777 }],
    [{ name: 'device.csv', mode: 0o020600 }],
    [{ name: 'duplicate.csv' }, { name: 'duplicate.csv' }],
    [{ name: 'table.csv' }, { name: 'table.csv/child.csv' }],
    [{ name: 'table.csv' }, { name: 'run.sh' }],
    [{ name: 'bomb.csv', declaredSize: 512 * 1024 * 1024 + 1 }],
  ]) {
    await assert.rejects(
      downloadNhgisExtract({
        url: TABLE_URL,
        apiKey: 'test-credential',
        cacheDir,
        fetchImpl: async () => new Response(archiveFixture(entries)),
      }),
      /archive rejected/,
    );
    assert.deepEqual(
      await readdir(cacheDir),
      [],
      'failed extraction must remove every partial file',
    );
  }
});

function observation(
  overrides: Partial<LivesPublishedObservation> = {},
): LivesPublishedObservation {
  return {
    id: 'obs:lives-homeownership:state:48:1990:black',
    metricId: 'lives-homeownership',
    jurisdictionId: 'state:48',
    boundaryVersion: 'state-1990',
    referencePeriod: '1990',
    datasetVintage: '1990 Census Summary Tape File 2B (100-percent data)',
    estimate: 45,
    marginOfError: null,
    numerator: 45,
    denominator: 100,
    raceEthnicitySlice: 'black',
    source: 'Census Bureau, 1990 Census Summary Tape File 2B, table "Tenure", via IPUMS NHGIS',
    sourceUrl: 'https://www.census.gov/data/datasets/1990/dec/summary-file-2.html',
    contentHash: 'hash',
    metadata: { table: 'Tenure' },
    ...overrides,
  };
}

test('series rows come once per metric', () => {
  const series = livesSeriesForObservations([
    observation(),
    observation({ id: 'obs:lives-homeownership:state:01:1990:black', jurisdictionId: 'state:01' }),
  ]);
  assert.deepEqual(
    series.map((row) => row.metric_id),
    ['lives-homeownership'],
  );
});

test('a duplicate id, a source without a web link, or an unknown metric stops the load', () => {
  assert.throws(() => livesSeriesForObservations([observation(), observation()]), /duplicate/);
  assert.throws(
    () => livesSeriesForObservations([observation({ sourceUrl: 'PENDING' })]),
    /sources without a web link/,
  );
  assert.throws(
    () => livesSeriesForObservations([observation({ metricId: 'lives-unknown' })]),
    /no series definition/,
  );
});

test('the run report counts brackets together and lists national figures', () => {
  const report = summarizeLivesObservations([
    observation(),
    observation({
      id: 'obs:lives-income-bracket-0-5000:nation:US:1990:black',
      metricId: 'lives-income-bracket-0-5000',
      jurisdictionId: 'nation:US',
    }),
    observation({
      id: 'obs:lives-homeownership:nation:US:1990:black',
      jurisdictionId: 'nation:US',
    }),
  ]);
  assert.deepEqual(report.byMetric, {
    '1990 lives-homeownership': 2,
    '1990 lives-income-bracket-*': 1,
  });
  assert.deepEqual(report.national, ['1990 lives-homeownership black: 45']);
});
