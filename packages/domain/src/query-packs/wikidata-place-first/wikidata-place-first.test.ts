/**
 * Tests for Wikidata place-first / authority-first portfolio query packs (WS7).
 * Fixture-driven — no live SPARQL against query.wikidata.org.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { assertQueryPackValid } from '../pack.js';
import {
  assertPlaceFirstSparqlValid,
  buildWikidataPlaceFirstDryRun,
  compileAllWikidataPlaceFirstQueries,
  compilePersonPlaceOccupationSparql,
  compilePlaceNrhpLinkedSparql,
  ETHNIC_GROUP_ONLY_HARVEST_REJECTION,
  getWikidataPlaceFirstPackSpec,
  isPlaceFirstSparqlValid,
  listWikidataPlaceFirstPackSpecs,
  parseWikidataSparqlFixture,
  REJECTED_ETHNIC_GROUP_ONLY_SPARQL_EXAMPLE,
  WIKIDATA_PERSON_PLACE_OCCUPATION_PACK,
  WIKIDATA_PLACE_FIRST_PORTFOLIO_WAVE_BEAD,
  WIKIDATA_PLACE_FIRST_PACK_SPECS,
  WIKIDATA_PLACE_NRHP_LINKED_PACK,
} from './index.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FIXED_NOW = '2026-07-21T17:34:38.000Z';

function loadFixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as unknown;
}

test('Wikidata place-first packs are versioned and content-hashed', () => {
  assertQueryPackValid(WIKIDATA_PERSON_PLACE_OCCUPATION_PACK);
  assertQueryPackValid(WIKIDATA_PLACE_NRHP_LINKED_PACK);
  assert.match(WIKIDATA_PERSON_PLACE_OCCUPATION_PACK.versionId, /^1\.0\.0\+[0-9a-f]{8}$/u);
  assert.match(WIKIDATA_PLACE_NRHP_LINKED_PACK.versionId, /^1\.0\.0\+[0-9a-f]{8}$/u);
});

test('person_place_occupation SPARQL anchors on P19/P937 + P131 state, not P172', () => {
  const sparql = compilePersonPlaceOccupationSparql({
    placeSeed: { label: 'Alabama', wikidataId: 'Q173' },
    occupationSeed: { label: 'civil rights activist', wikidataId: 'Q82955' },
  });
  assert.match(sparql, /wdt:P19/u);
  assert.match(sparql, /wdt:P937/u);
  assert.match(sparql, /wdt:P106 wd:Q82955/u);
  assert.match(sparql, /wdt:P131\* wd:Q173/u);
  assert.doesNotMatch(sparql, /P172/u);
  assertPlaceFirstSparqlValid(sparql);
});

test('place_nrhp_linked SPARQL anchors on P649 NRHP authority, not P172', () => {
  const sparql = compilePlaceNrhpLinkedSparql({
    placeSeed: { label: 'Alabama', wikidataId: 'Q173' },
  });
  assert.match(sparql, /wdt:P649/u);
  assert.match(sparql, /wdt:P131\* wd:Q173/u);
  assert.doesNotMatch(sparql, /P172/u);
  assertPlaceFirstSparqlValid(sparql);
});

test('ethnic-group-only SPARQL is explicitly rejected', () => {
  assert.equal(isPlaceFirstSparqlValid(REJECTED_ETHNIC_GROUP_ONLY_SPARQL_EXAMPLE), false);
  assert.throws(
    () => assertPlaceFirstSparqlValid(REJECTED_ETHNIC_GROUP_ONLY_SPARQL_EXAMPLE),
    (error: unknown) =>
      error instanceof Error && error.message.includes(ETHNIC_GROUP_ONLY_HARVEST_REJECTION),
  );
});

test('dry-run compiler emits fixture-mode queries for all pack specs', () => {
  const dryRun = buildWikidataPlaceFirstDryRun({ compiledAt: FIXED_NOW });
  assert.equal(dryRun.portfolioWaveBead, WIKIDATA_PLACE_FIRST_PORTFOLIO_WAVE_BEAD);
  assert.ok(dryRun.rejectionNote.includes('P172'));
  assert.equal(dryRun.queries.length, 12);
  for (const query of dryRun.queries) {
    assert.equal(query.fixtureMode, true);
    assertPlaceFirstSparqlValid(query.sparql);
  }
});

test('compileAllWikidataPlaceFirstQueries matches registered pack specs', () => {
  const compiled = compileAllWikidataPlaceFirstQueries(WIKIDATA_PLACE_FIRST_PACK_SPECS);
  assert.equal(compiled.length, 12);
  const personPack = getWikidataPlaceFirstPackSpec('qp-wikidata-person-place-occupation');
  assert.ok(personPack);
  assert.equal(personPack.strategy, 'person_place_occupation');
  assert.equal(listWikidataPlaceFirstPackSpecs().length, 2);
});

test('fixture SPARQL responses parse for person and NRHP strategies', () => {
  const personFixture = parseWikidataSparqlFixture(
    loadFixtureJson('person-place-occupation-sparql-response.v1.json'),
  );
  assert.deepEqual(personFixture.head.vars, [
    'person',
    'personLabel',
    'placeLabel',
    'occupationLabel',
  ]);
  assert.equal(personFixture.results.bindings.length, 2);
  assert.equal(
    personFixture.results.bindings[0]?.personLabel?.value,
    'Rosa Parks',
  );

  const nrhpFixture = parseWikidataSparqlFixture(
    loadFixtureJson('place-nrhp-linked-sparql-response.v1.json'),
  );
  assert.equal(nrhpFixture.results.bindings.length, 2);
  assert.equal(nrhpFixture.results.bindings[0]?.nrhpId?.value, '80000696');
});

test('dry-run fixture summary matches compiled query counts', () => {
  const summary = loadFixtureJson('dry-run-compiled-queries.v1.json') as {
    queryCount: number;
    packs: Array<{ queryCount: number }>;
  };
  const dryRun = buildWikidataPlaceFirstDryRun({ compiledAt: FIXED_NOW });
  assert.equal(dryRun.queries.length, summary.queryCount);
  assert.equal(
    summary.packs.reduce((total, pack) => total + pack.queryCount, 0),
    summary.queryCount,
  );
});
