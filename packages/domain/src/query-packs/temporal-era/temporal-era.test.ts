/**
 * Tests for temporal-era query packs (Temporal Gap Discovery).
 * Fixture-driven — gold decade→term-class mapping + sample pack builds. No network.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertQueryPackValid } from '../pack.js';
import {
  TEMPORAL_ERAS,
  TEMPORAL_ERA_BASE_MODERN_TERMS,
  buildEraQueryPack,
  erasForDecade,
  eraTermsForDecade,
  listSupportedEraDecades,
  parseTemporalEraTermsFixture,
} from './index.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as unknown;
}

test('gold fixture temporal-era-terms.v1.json matches the in-code era table', () => {
  const eras = parseTemporalEraTermsFixture(loadFixtureJson('temporal-era-terms.v1.json'));
  assert.deepEqual(eras, TEMPORAL_ERAS);
});

test('fixture parser rejects wrong schema and malformed eras', () => {
  assert.throws(() => parseTemporalEraTermsFixture(null), /must be an object/u);
  assert.throws(
    () => parseTemporalEraTermsFixture({ schemaVersion: 'temporal-era-terms.v2', eras: [] }),
    /Unsupported temporal era fixture schema/u,
  );
  assert.throws(
    () =>
      parseTemporalEraTermsFixture({
        schemaVersion: 'temporal-era-terms.v1',
        eras: [{ id: 'x', decadeStart: '1900', decadeEnd: '1860', terms: [{ text: 'a', termClass: 'historical' }] }],
      }),
    /decadeStart after decadeEnd/u,
  );
});

test('era resolution: 1860s–1870s freedmen, 1890s Colored, 1930s–1940s overlap both Colored and Negro', () => {
  assert.deepEqual(
    erasForDecade('1860').map((era) => era.id),
    ['era-reconstruction-freedmen'],
  );
  assert.deepEqual(
    erasForDecade('1890').map((era) => era.id),
    ['era-colored-designation'],
  );
  assert.deepEqual(
    erasForDecade('1940').map((era) => era.id),
    ['era-colored-designation', 'era-negro-designation'],
  );
  assert.deepEqual(
    erasForDecade('1960').map((era) => era.id),
    ['era-negro-designation'],
  );
  // Continuous supported coverage 1860s–1960s.
  assert.deepEqual(listSupportedEraDecades(), [
    '1860',
    '1870',
    '1880',
    '1890',
    '1900',
    '1910',
    '1920',
    '1930',
    '1940',
    '1950',
    '1960',
  ]);
});

test('eraTermsForDecade merges overlapping eras without duplicates', () => {
  const terms = eraTermsForDecade('1940');
  const texts = terms.map((term) => term.text);
  assert.ok(texts.includes('Colored'));
  assert.ok(texts.includes('Negro'));
  assert.equal(new Set(texts.map((text) => text.toLowerCase())).size, texts.length);
  for (const term of terms) {
    assert.equal(term.termClass, 'historical');
  }
});

test('buildEraQueryPack builds a valid versioned pack for a thin 1890s decade', () => {
  const eraPack = buildEraQueryPack('1890', 'historical_place');
  assertQueryPackValid(eraPack.pack);
  assert.equal(eraPack.pack.id, 'qp-temporal-era-1890s-historical-place');
  assert.equal(eraPack.pack.entityKind, 'place');
  assert.equal(eraPack.pack.theme, 'historical_place');
  assert.match(eraPack.pack.versionId, /^1\.0\.0\+[0-9a-f]{8}$/u);
  assert.deepEqual(eraPack.eraIds, ['era-colored-designation']);
});

test('researchOnlyOffensive historical terms are retained for research, stripped from public', () => {
  const eraPack = buildEraQueryPack('1950', 'education_segregation', { entityKind: 'school' });

  // Research surface keeps period record language ("Negro" era terms).
  const researchTexts = eraPack.researchTerms.map((term) => term.text);
  assert.ok(researchTexts.includes('Negro'));
  assert.ok(
    eraPack.researchTerms.every(
      (term) => term.termClass !== 'historical' || term.researchOnlyOffensive === true || term.text.length > 0,
    ),
  );

  // Public-safe surface never contains a flagged term.
  const publicTexts = eraPack.publicSafeTerms.map((term) => term.text);
  assert.equal(publicTexts.includes('Negro'), false);
  assert.equal(publicTexts.includes('Colored'), false);
  assert.ok(publicTexts.includes('Black'));
  assert.ok(publicTexts.includes('African American'));
  assert.equal(eraPack.redactedTermCount > 0, true);
  assert.equal(
    eraPack.publicSafeTerms.length + eraPack.redactedTermCount,
    eraPack.researchTerms.length,
  );
});

test('every era pack carries the modern/alias counterparts for non-empty public projection', () => {
  for (const decade of listSupportedEraDecades()) {
    const eraPack = buildEraQueryPack(decade, 'historical_place');
    assert.ok(eraPack.publicSafeTerms.length >= TEMPORAL_ERA_BASE_MODERN_TERMS.length);
  }
});

test('1860s freedmen-era pack has no research-only redactions', () => {
  const eraPack = buildEraQueryPack('1860', 'archival_person', { entityKind: 'person' });
  assert.deepEqual(eraPack.eraIds, ['era-reconstruction-freedmen']);
  assert.ok(eraPack.researchTerms.some((term) => term.text === 'freedmen'));
  assert.equal(eraPack.redactedTermCount, 0);
});

test('unmapped decades and bad inputs are explicit errors, never silent empty packs', () => {
  assert.throws(() => buildEraQueryPack('1990', 'historical_place'), /No temporal era terms registered/u);
  assert.throws(() => buildEraQueryPack('1865', 'historical_place'), /Invalid decade key/u);
  assert.throws(
    () => buildEraQueryPack('1890', 'not_a_theme' as never),
    /Unknown query pack theme/u,
  );
});

test('pack content hash is deterministic across rebuilds', () => {
  const first = buildEraQueryPack('1920', 'institutional_records');
  const second = buildEraQueryPack('1920', 'institutional_records');
  assert.equal(first.pack.versionId, second.pack.versionId);
  assert.equal(first.pack.version.contentHash, second.pack.version.contentHash);
});
