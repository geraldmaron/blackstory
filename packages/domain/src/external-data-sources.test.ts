/** Shape and invariant tests for the external dataset acquisition registry. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXTERNAL_DATA_SOURCES,
  getExternalDataSource,
  rightsPolicyForVerdict,
} from './external-data-sources.js';

test('every entry is disabled at registration with a direct data URL and vetted verdict', () => {
  assert.ok(EXTERNAL_DATA_SOURCES.length >= 15);
  for (const source of EXTERNAL_DATA_SOURCES) {
    assert.match(source.id, /^[a-z0-9-]+$/, `${source.id}: kebab-case id`);
    assert.equal(source.registryState, 'disabled', `${source.id}: never pre-approved`);
    assert.ok(source.dataUrl.startsWith('https://'), `${source.id}: https data URL`);
    assert.ok(source.geographies.length > 0, `${source.id}: at least one geography`);
    assert.ok(source.notes.length > 0, `${source.id}: notes required`);
  }
});

test('ids are unique', () => {
  const ids = EXTERNAL_DATA_SOURCES.map((source) => source.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('noncommercial and unverified verdicts always prohibit commercial reuse', () => {
  for (const verdict of ['noncommercial', 'unverified'] as const) {
    assert.ok(rightsPolicyForVerdict(verdict).prohibitedUses.includes('commercial_reuse'));
  }
  assert.equal(rightsPolicyForVerdict('unverified').publicationPermissions.length, 0);
});

test('HOLC entry carries the corrected noncommercial verdict, matching launch-corpora', () => {
  const holc = getExternalDataSource('mapping-inequality-holc');
  assert.ok(holc);
  assert.equal(holc.license.verdict, 'noncommercial');
});

test('tier-1 ingested sources carry their artifact checksums', () => {
  for (const id of ['opportunity-atlas-tract-outcomes', 'mapping-inequality-holc']) {
    const source = getExternalDataSource(id);
    assert.match(source?.checksumSha256 ?? '', /^[a-f0-9]{64}$/, `${id}: checksum recorded`);
  }
});

test('NHGIS county race entry is registered disabled pending API key', () => {
  const nhgis = getExternalDataSource('nhgis-county-race');
  assert.ok(nhgis);
  assert.equal(nhgis.registryState, 'disabled');
  assert.equal(nhgis.license.verdict, 'attribution-required');
  assert.deepEqual([...nhgis.geographies].sort(), ['county', 'state']);
  assert.match(nhgis.dataUrl, /^https:\/\/api\.ipums\.org\//);
  assert.match(nhgis.notes, /NHGIS_API_KEY/);
});

test('justice and wealth Phase-0 registry additions stay disabled with https data URLs', () => {
  const ids = [
    'bjs-national-prisoner-statistics',
    'vera-incarceration-trends',
    'bjs-annual-survey-of-jails',
    'bjs-ncrp-public-use',
    'fed-survey-consumer-finances',
    'census-sipp-wealth',
    'bls-laus-unemployment',
    'mit-election-lab',
    'voting-rights-lab-indicators',
    'stanford-open-policing',
  ] as const;
  for (const id of ids) {
    const source = getExternalDataSource(id);
    assert.ok(source, `${id} registered`);
    assert.equal(source.registryState, 'disabled');
    assert.ok(source.dataUrl.startsWith('https://'));
  }
  assert.equal(getExternalDataSource('fed-survey-consumer-finances')?.geographies[0], 'nation');
  assert.ok(
    getExternalDataSource('vera-incarceration-trends')?.geographies.includes('county'),
  );
});

test('PEN America school book bans entry stays disabled pending license gate', () => {
  const pen = getExternalDataSource('pen-america-school-book-bans');
  assert.ok(pen);
  assert.equal(pen.registryState, 'disabled');
  assert.equal(pen.license.verdict, 'attribution-required');
  assert.deepEqual([...pen.geographies], ['state']);
  assert.match(pen.dataUrl, /^https:\/\/pen\.org\//);
  assert.match(pen.notes, /license gate/i);
});
