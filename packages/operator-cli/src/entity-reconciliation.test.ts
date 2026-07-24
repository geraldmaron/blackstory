/**
 * Verifies the Wikidata reconciliation matching rule: unique exact + type-compatible match
 * auto-accepts; anything else (no candidates, multiple exact matches, alias-only hits) is never
 * guessed and is instead classified as no_match/ambiguous. Same rule as
 * packages/domain/src/graph/mention-resolver.ts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyCandidates,
  fetchWikidataIdentifiers,
  reconcileEntity,
  searchWikidata,
  WIKIDATA_PROPERTY_MAP,
  type ReconciliationInput,
  type WikidataCandidate,
} from './entity-reconciliation.ts';

const PERSON: ReconciliationInput = {
  entityId: 'ent_test_person_001',
  displayName: 'Rosa Parks',
  kind: 'person',
};

test('unique exact-name, type-compatible candidate is auto-accepted', () => {
  const candidates: WikidataCandidate[] = [
    { qid: 'Q41421', label: 'Rosa Parks', description: 'American civil rights activist' },
  ];
  const result = classifyCandidates(PERSON, candidates);
  assert.equal(result.decision, 'accept');
  if (result.decision === 'accept') {
    assert.equal(result.candidate.qid, 'Q41421');
  }
});

test('zero candidates is a no_match, never an accept', () => {
  const result = classifyCandidates(PERSON, []);
  assert.equal(result.decision, 'no_match');
});

test('multiple exact-name type-compatible candidates stay ambiguous rather than guessing', () => {
  const candidates: WikidataCandidate[] = [
    { qid: 'Q1', label: 'Rosa Parks', description: 'American civil rights activist' },
    { qid: 'Q2', label: 'Rosa Parks', description: 'Tram stop' }, // conflict is filtered, so...
    { qid: 'Q3', label: 'Rosa Parks', description: 'American historian' }, // ...this stays a genuine tie
  ];
  const result = classifyCandidates(PERSON, candidates);
  assert.equal(result.decision, 'ambiguous');
});

test('a candidate whose description conflicts with the entity kind is excluded, not guessed onto', () => {
  const candidates: WikidataCandidate[] = [{ qid: 'Q28732995', label: 'Rosa Parks', description: 'Tram stop' }];
  const result = classifyCandidates(PERSON, candidates);
  assert.equal(result.decision, 'ambiguous');
});

test('alias-only (non-exact label) hits never auto-accept', () => {
  const candidates: WikidataCandidate[] = [
    { qid: 'Q1', label: 'Rosa Louise McCauley Parks', description: 'American civil rights activist' },
  ];
  const result = classifyCandidates(PERSON, candidates);
  assert.equal(result.decision, 'ambiguous');
});

test('a disambiguator can break an otherwise-tied exact match', () => {
  const withEra: ReconciliationInput = {
    ...PERSON,
    displayName: 'John Smith',
    disambiguator: 'civil rights organizer active in the 1960s',
  };
  const candidates: WikidataCandidate[] = [
    { qid: 'Q1', label: 'John Smith', description: 'civil rights organizer active in the 1960s' },
    { qid: 'Q2', label: 'John Smith', description: 'English colonial leader' },
  ];
  const result = classifyCandidates(withEra, candidates);
  assert.equal(result.decision, 'accept');
  if (result.decision === 'accept') {
    assert.equal(result.candidate.qid, 'Q1');
  }
});

test('WIKIDATA_PROPERTY_MAP uses the property ids verified against Audre Lorde (Q463319)', () => {
  // P244 = Library of Congress authority id (LCNAF), P3430 = SNAC ARK id, P2163 = FAST id.
  assert.equal(WIKIDATA_PROPERTY_MAP.lcnaf, 'P244');
  assert.equal(WIKIDATA_PROPERTY_MAP.snac_ark, 'P3430');
  assert.equal(WIKIDATA_PROPERTY_MAP.fast, 'P2163');
});

test('searchWikidata maps the wbsearchentities response shape into candidates', async () => {
  const fetcher = async () => ({
    search: [{ id: 'Q41421', display: { label: { value: 'Rosa Parks' } }, description: 'American civil rights activist' }],
  });
  const candidates = await searchWikidata('Rosa Parks', fetcher);
  assert.deepEqual(candidates, [
    { qid: 'Q41421', label: 'Rosa Parks', description: 'American civil rights activist' },
  ]);
});

test('fetchWikidataIdentifiers pulls LCNAF/SNAC/FAST from claims by property id', async () => {
  const fetcher = async () => ({
    entities: {
      Q463319: {
        claims: {
          P244: [{ mainsnak: { datavalue: { value: 'n50042298' } } }],
          P3430: [{ mainsnak: { datavalue: { value: 'w6fc5vmz' } } }],
        },
      },
    },
  });
  const hits = await fetchWikidataIdentifiers('Q463319', fetcher);
  assert.deepEqual(hits, [
    { namespace: 'lcnaf', value: 'n50042298' },
    { namespace: 'snac_ark', value: 'w6fc5vmz' },
  ]);
});

test('reconcileEntity end-to-end: accept path fetches identifiers, ambiguous path does not', async () => {
  let calls = 0;
  const fetcher = async (url: string) => {
    calls += 1;
    if (url.includes('wbsearchentities')) {
      return { search: [{ id: 'Q41421', display: { label: { value: 'Rosa Parks' } }, description: 'American civil rights activist' }] };
    }
    return { entities: { Q41421: { claims: { P244: [{ mainsnak: { datavalue: { value: 'n50042298' } } }] } } } };
  };
  const result = await reconcileEntity(PERSON, fetcher);
  assert.equal(result.status, 'matched');
  if (result.status === 'matched') {
    assert.equal(result.qid, 'Q41421');
    assert.deepEqual(result.identifiers, [{ namespace: 'lcnaf', value: 'n50042298' }]);
  }
  assert.equal(calls, 2);
});
