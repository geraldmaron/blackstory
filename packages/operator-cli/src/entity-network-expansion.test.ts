/** Traversal and staging tests with an injected Wikidata fetcher; no live network requests. */
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

test('lifespan metadata preserves BCE signs and declines imprecise or conflicting years', () => {
  assert.equal(
    extractWikidataBirthDeathYears({ P569: [timeClaim('-0044-01-01T00:00:00Z')] }).birthYear,
    -44,
  );
  assert.equal(
    extractWikidataBirthDeathYears({
      P569: [timeClaim('+1900-01-01T00:00:00Z'), timeClaim('+1901-01-01T00:00:00Z')],
    }).birthYear,
    undefined,
  );
  assert.equal(
    extractWikidataBirthDeathYears({
      P569: [
        { mainsnak: { datavalue: { value: { time: '+1900-00-00T00:00:00Z', precision: 8 } } } },
      ],
    }).birthYear,
    undefined,
  );
});

test('statement references and qualifiers survive while deprecated claims are excluded', async () => {
  const statement = {
    ...entityClaim('Q10'),
    id: 'Q1$employment',
    rank: 'normal',
    qualifiers: { P580: [timeClaim('+1900-01-01T00:00:00Z')] },
    references: [
      { snaks: { P854: [{ datavalue: { value: 'https://example.org/employment-record' } }] } },
    ],
  };
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', {
      P108: [statement, { ...entityClaim('Q20'), rank: 'deprecated' }],
    }),
    'Special:EntityData/Q10.json': entityDataDoc('Q10', 'Employer', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });
  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 10 }, fetcher);
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0]?.provenance[0]?.statement, statement);
  const staged = await stageNetworkCandidates(SEED, candidates, 'run', async () => {});
  assert.deepEqual(staged[0]?.provenance.hops[0]?.statement, statement);
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

  // Education remains a source predicate; it is not rewritten as membership.
  assert.equal(byQid.get('Q20')?.hypothesis.relationshipType, 'other');
  assert.ok(byQid.get('Q20')?.hypothesis.note?.includes('P69'));

  assert.equal(byQid.get('Q30')?.hypothesis.relationshipType, 'member_of');
});

test('reverse claims (founded orgs, authored works) are pulled via SPARQL, not forward claims', async () => {
  // Two distinct SPARQL calls happen (P112 founded, P50 authored); give each its own response by
  // inspecting the query string.
  const sparqlAware: WikidataFetcher = async (url: string) => {
    if (url.includes('Special:EntityData/Q1.json')) return entityDataDoc('Q1', 'Test Person', {});
    if (url.includes('Special:EntityData/Q99.json'))
      return entityDataDoc('Q99', 'Founded Org', { P112: [entityClaim('Q1')] });
    if (url.includes('Special:EntityData/Q88.json'))
      return entityDataDoc('Q88', 'Authored Work', { P50: [entityClaim('Q1')] });
    if (url.includes('P112')) {
      return {
        results: {
          bindings: [
            {
              item: { value: 'http://www.wikidata.org/entity/Q99' },
              itemLabel: { value: 'Founded Org' },
            },
          ],
        },
      };
    }
    if (url.includes('P50')) {
      return {
        results: {
          bindings: [
            {
              item: { value: 'http://www.wikidata.org/entity/Q88' },
              itemLabel: { value: 'Authored Work' },
            },
          ],
        },
      };
    }
    throw new Error(`unexpected url ${url}`);
  };

  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 50 }, sparqlAware);
  const byQid = new Map(candidates.map((c) => [c.qid, c]));

  assert.equal(byQid.get('Q99')?.hypothesis.relationshipType, 'founded');
  assert.equal(byQid.get('Q99')?.hypothesis.direction, 'outgoing');
  assert.equal(byQid.get('Q99')?.label, 'Founded Org');

  assert.equal(byQid.get('Q88')?.hypothesis.relationshipType, 'authored');
  assert.equal(byQid.get('Q88')?.provenance[0]?.statementSubjectQid, 'Q88');
  assert.equal(byQid.get('Q88')?.provenance[0]?.statementObjectQid, 'Q1');
  assert.equal(byQid.get('Q88')?.provenance[0]?.referenceUrl, 'https://www.wikidata.org/wiki/Q88');
});

test('candidate cap is enforced across hops', async () => {
  const claims: Record<string, unknown[]> = {
    P108: [entityClaim('Q11'), entityClaim('Q12'), entityClaim('Q13')],
  };
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Test Person', claims),
    'Special:EntityData/Q11.json': entityDataDoc('Q11', 'A', {}),
    'Special:EntityData/Q12.json': entityDataDoc('Q12', 'B', {}),
    'Special:EntityData/Q13.json': entityDataDoc('Q13', 'C', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });

  const candidates = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 2 }, fetcher);
  assert.equal(candidates.length, 2);
});

test('distinct relationships to the same neighbor retain separate hypotheses', async () => {
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
  assert.equal(dual.length, 2);
  assert.deepEqual(
    dual.map((c) => c.hypothesis.relationshipType),
    ['employed_by', 'member_of'],
  );
});

test('stageNetworkCandidates never targets canonical: rows go to the injected insert only, status pending', async () => {
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
  const candidates = await expandEntityNetwork(
    SEED,
    { depth: 1, maxCandidates: 50 },
    fetcher,
    meta,
  );

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
  assert.equal('birthYear' in rows[0]!.payload, false);
  assert.equal('deathYear' in rows[0]!.payload, false);
  assert.equal(rows[0]?.payload.seedBirthYear, 1934);
  assert.equal(rows[0]?.payload.seedDeathYear, 1992);
  assert.equal(rows[0]?.provenance.seed_birth_year, 1934);
  assert.equal(rows[0]?.provenance.seed_death_year, 1992);
});

test('two-hop paths preserve intermediate endpoints and never claim a direct seed edge', async () => {
  const calls: string[] = [];
  const routes = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Seed', { P108: [entityClaim('Q10')] }),
    'Special:EntityData/Q10.json': entityDataDoc('Q10', 'Intermediate', {
      P463: [entityClaim('Q20'), entityClaim('Q1')],
    }),
    'Special:EntityData/Q20.json': entityDataDoc('Q20', 'Neighbor', {}),
    'query.wikidata.org': { results: { bindings: [] } },
  });
  const candidates = await expandEntityNetwork(
    SEED,
    { depth: 2, maxCandidates: 10 },
    async (url) => {
      calls.push(url);
      return routes(url);
    },
  );
  const edge = candidates.find((c) => c.qid === 'Q20')!;
  assert.deepEqual(
    edge.provenance.map((h) => [h.sourceQid, h.targetQid]),
    [
      ['Q1', 'Q10'],
      ['Q10', 'Q20'],
    ],
  );
  assert.equal(edge.sourceQid, 'Q10');
  assert.equal(
    candidates.some((c) => c.qid === 'Q1'),
    false,
  );
  const rows = await stageNetworkCandidates(SEED, [edge], 'r', async () => {});
  assert.match(rows[0]!.summary, /Intermediate member_of Neighbor/);
  assert.equal(calls.filter((url) => url.includes('Special:EntityData/Q10.json')).length, 1);
});

test('request and candidate budgets bound traversal before fetching the whole neighborhood', async () => {
  let calls = 0;
  const fetcher = makeFetcher({
    'Special:EntityData/Q1.json': entityDataDoc('Q1', 'Seed', {
      P108: [entityClaim('Q10'), entityClaim('Q20')],
    }),
    'Special:EntityData/Q10.json': entityDataDoc('Q10', 'Neighbor', {}),
  });
  const result = await expandEntityNetwork(SEED, { depth: 1, maxCandidates: 1 }, async (url) => {
    calls++;
    return fetcher(url);
  });
  assert.equal(result.length, 1);
  assert.equal(calls, 2);
  await assert.rejects(
    expandEntityNetwork(SEED, { depth: 1, maxCandidates: 10, maxRequests: 1 }, fetcher),
    /budget exhausted/,
  );
});
