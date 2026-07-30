/**
 * Traversal + staging tests for the entity network expansion engine. The Wikidata fetcher is
 * mocked (`node:test` + a hand-rolled URL->response map) — no live network calls here; see
 * `entity-network-expansion.pilot.ts` for the live Audre Lorde pilot run.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  expandEntityNetwork,
  extractWikidataBirthDeathYears,
  fetchSeedBirthDeathYears,
  stageNetworkCandidates,
  type ExpansionSeed,
  type WikidataFetcher,
} from './entity-network-expansion.ts';

const SEED: ExpansionSeed = { qid: 'Q1', kind: 'person', displayName: 'Test Person' };

function makeFetcher(routes: Record<string, unknown>): WikidataFetcher {
  return async (url: string) => {
    for (const [pattern, response] of Object.entries(routes)) {
      if (url.includes(pattern)) return response;
    }
    throw new Error(`No mock route for ${url}`);
  };
}

function entityDataDoc(qid: string, label: string, claims: Record<string, unknown[]>) {
  return { entities: { [qid]: { labels: { en: { value: label } }, claims } } };
}

function entityClaim(qid: string) {
  return { mainsnak: { datavalue: { value: { id: qid } } } };
}

function timeClaim(isoTime: string) {
  return { mainsnak: { datavalue: { value: { time: isoTime, precision: 9 } } } };
}

test('extractWikidataBirthDeathYears reads P569 and P570 time claims', () => {
  const years = extractWikidataBirthDeathYears({
    P569: [timeClaim('+1885-01-01T00:00:00Z')],
    P570: [timeClaim('+1952-12-31T00:00:00Z')],
  });
  assert.equal(years.birthYear, 1885);
  assert.equal(years.deathYear, 1952);
});

test('fetchSeedBirthDeathYears loads birth/death from entity data doc', async () => {
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', {
      P569: [timeClaim('+1900-01-01T00:00:00Z')],
      P570: [timeClaim('+1988-06-15T00:00:00Z')],
    }),
  });
  const years = await fetchSeedBirthDeathYears('Q1', fetcher);
  assert.equal(years.birthYear, 1900);
  assert.equal(years.deathYear, 1988);
});

test('expandEntityNetwork captures seed birth/death years for person seeds via meta out-param', async () => {
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', {
      P569: [timeClaim('+1920-01-01T00:00:00Z')],
      P570: [timeClaim('+2001-01-01T00:00:00Z')],
      P108: [entityClaim('Q10')],
    }),
    'Special:EntityData/Q10.json': entityDataDoc('Q10', 'Employer Org', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });

  const meta: { seedBirthDeathYears?: { birthYear?: number; deathYear?: number } } = {};
  await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 50 }, fetcher, meta);
  assert.equal(meta.seedBirthDeathYears?.birthYear, 1920);
  assert.equal(meta.seedBirthDeathYears?.deathYear, 2001);
});

test('forward claims (employer, educated at, member of) surface as typed hypotheses with provenance', async () => {
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', {
      P108: [entityClaim('Q10')],
      P69: [entityClaim('Q20')],
      P463: [entityClaim('Q30')],
    }),
    'Special:EntityData/Q10.json': entityDataDoc('Q10', 'Employer Org', {}),
    'Special:EntityData/Q20.json': entityDataDoc('Q20', 'Alma Mater', {}),
    'Special:EntityData/Q30.json': entityDataDoc('Q30', 'Some Collective', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });

  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 50 }, fetcher);

  const byQid = new Map(candidates.map((c) => [c.qid, c]));
  assert.equal(byQid.get('Q10')?.hypothesis.relationshipType, 'employed_by');
  assert.equal(byQid.get('Q10')?.hypothesis.direction, 'outgoing');
  assert.equal(byQid.get('Q10')?.provenance[0]?.propertyId, 'P108');
  assert.equal(byQid.get('Q10')?.provenance[0]?.referenceUrl, 'https://www.wikidata.org/wiki/Q1');

  // Educated at has no dedicated taxonomy type: mapped to member_of with an explanatory note.
  assert.equal(byQid.get('Q20')?.hypothesis.relationshipType, 'member_of');
  assert.ok(byQid.get('Q20')?.hypothesis.note?.includes('P69'));

  assert.equal(byQid.get('Q30')?.hypothesis.relationshipType, 'member_of');
});

test('reverse claims (founded orgs, authored works) are pulled via SPARQL, not forward claims', async () => {
  // Two distinct SPARQL calls happen (P112 founded, P50 authored); give each its own response by
  // inspecting the query string.
  const sparqlAware: WikidataFetcher = async (url: string) => {
    if (url.includes('Special:EntityData/Q1.json')) return entityDataDoc('Q1', 'Test Person', {});
    if (url.includes('P112')) {
      return { results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q99' }, itemLabel: { value: 'Founded Org' } }] } };
    }
    if (url.includes('P50')) {
      return { results: { bindings: [{ item: { value: 'http://www.wikidata.org/entity/Q88' }, itemLabel: { value: 'Authored Work' } }] } };
    }
    throw new Error(`unexpected url ${url}`);
  };

  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 50 }, sparqlAware);
  const byQid = new Map(candidates.map((c) => [c.qid, c]));

  assert.equal(byQid.get('Q99')?.hypothesis.relationshipType, 'founded');
  assert.equal(byQid.get('Q99')?.hypothesis.direction, 'outgoing');
  assert.equal(byQid.get('Q99')?.label, 'Founded Org');

  assert.equal(byQid.get('Q88')?.hypothesis.relationshipType, 'authored');
});

test('candidate cap is enforced across hops', async () => {
  const claims: Record<string, unknown[]> = { P108: [entityClaim('Qa'), entityClaim('Qb'), entityClaim('Qc')] };
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', claims),
    'Special:EntityData/Qa.json': entityDataDoc('Qa', 'A', {}),
    'Special:EntityData/Qb.json': entityDataDoc('Qb', 'B', {}),
    'Special:EntityData/Qc.json': entityDataDoc('Qc', 'C', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });

  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 2 }, fetcher);
  assert.equal(candidates.length, 2);
});

test('duplicate neighbor reached via two properties is deduped with merged provenance', async () => {
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', {
      P108: [entityClaim('Q50')],
      P463: [entityClaim('Q50')],
    }),
    'Special:EntityData/Q50.json': entityDataDoc('Q50', 'Dual Org', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });

  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 50 }, fetcher);
  const dual = candidates.filter((c) => c.qid === 'Q50');
  assert.equal(dual.length, 1);
  assert.equal(dual[0]?.provenance.length, 2);
});

test('stageNetworkCandidates never targets bb_canonical: rows go to the injected insert only, status pending', async () => {
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', {
      P108: [entityClaim('Q10')],
      P569: [timeClaim('+1934-02-01T00:00:00Z')],
      P570: [timeClaim('+1992-11-11T00:00:00Z')],
    }),
    'Special:EntityData/Q10.json': entityDataDoc('Q10', 'Employer Org', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });
  const meta: { seedBirthDeathYears?: { birthYear?: number; deathYear?: number } } = {};
  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 50 }, fetcher, meta);

  const staged: unknown[] = [];
  const rows = await stageNetworkCandidates(
    SEED,
    candidates,
    'run_test_1',
    async (r) => {
      staged.push(...r);
    },
    undefined,
    meta.seedBirthDeathYears,
  );

  assert.equal(staged.length, rows.length);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.lane, 'wikidata');
  assert.equal(rows[0]?.status, 'pending');
  assert.equal(rows[0]?.run_id, 'run_test_1');
  assert.equal(rows[0]?.payload.relationship_type, 'employed_by');
  assert.equal(rows[0]?.provenance.hops[0]?.propertyId, 'P108');
  assert.equal(rows[0]?.payload.birthYear, 1934);
  assert.equal(rows[0]?.payload.deathYear, 1992);
  assert.equal(rows[0]?.payload.seedBirthYear, 1934);
  assert.equal(rows[0]?.payload.seedDeathYear, 1992);
  assert.equal(rows[0]?.provenance.seed_birth_year, 1934);
  assert.equal(rows[0]?.provenance.seed_death_year, 1992);
});
