/**
 * The audit's job is to be re-runnable and honest. These pin the two things that would make it
 * dishonest: a source class inferred too generously, and a claim whose assertion is read off
 * the predicate when the object says something stronger.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type ReleasedEntity,
  assertionClassForClaim,
  auditReleasedEntities,
  snapshotForReleasedEntity,
  sourceClassForCitation,
} from './research-quality-audit.ts';

function entity(overrides: Partial<ReleasedEntity> = {}): ReleasedEntity {
  return {
    entityId: 'ent_1',
    kind: 'person',
    displayName: 'Test Person',
    summary: 'A summary.',
    claims: [],
    ...overrides,
  };
}

test('a Wikipedia citation is a bridge however it is spelled', () => {
  assert.equal(
    sourceClassForCitation('https://en.wikipedia.org/wiki/X', undefined),
    'wikipedia_bridge',
  );
  assert.equal(sourceClassForCitation(undefined, 'wikipedia_api'), 'wikipedia_bridge');
  assert.equal(sourceClassForCitation(undefined, 'en.wikipedia.org'), 'wikipedia_bridge');
  assert.equal(
    sourceClassForCitation('https://www.wikidata.org/wiki/Q1', undefined),
    'wikidata_bridge',
  );
});

test('an NRHP nomination form is a technical report, not a biography', () => {
  // npgallery serves the nomination PDFs. Reading them as institutional prose would overstate
  // what they say about a person and understate what they say about a building.
  assert.equal(
    sourceClassForCitation('https://npgallery.nps.gov/NRHP/GetAsset/NRHP/12345_text', undefined),
    'government_technical_report',
  );
  assert.equal(
    sourceClassForCitation('https://www.nps.gov/articles/some-place.htm', undefined),
    'institutional_biography',
  );
});

test('a patent host is a patent specification', () => {
  assert.equal(
    sourceClassForCitation('https://patents.google.com/patent/US252386A/en', undefined),
    'patent_specification',
  );
});

test('an unrecognized host lands in the middle, not at the bottom', () => {
  // Calling a state historical society a lead would understate real evidence more often than
  // calling an unknown blog a secondary source overstates it.
  assert.equal(
    sourceClassForCitation('https://www.okhistory.org/publications/enc/entry', undefined),
    'modern_reputable_secondary',
  );
  // But nothing at all is a lead, because it is.
  assert.equal(sourceClassForCitation(undefined, undefined), 'search_result_lead');
});

test('the object text decides the assertion, not the predicate', () => {
  // This is the real Frederick McKinley Jones claim from the active release. Its predicate is
  // "patented", which reads as an ordinary record fact; its object claims firstness.
  const claim = {
    predicate: 'patented',
    object:
      'the first practical automatic refrigeration system for long-haul trucks in 1940, an invention that led Minneapolis entrepreneur Joseph Numero to found the Thermo Control Company',
  };
  assert.equal(assertionClassForClaim(claim), 'superlative');

  // Without the superlative, the same predicate is a record fact.
  assert.equal(
    assertionClassForClaim({
      predicate: 'patented',
      object: 'a device for cooling truck trailers',
    }),
    'record_fact',
  );
});

test('a record_index claim is not treated as carrying public summary prose', () => {
  // A record restating its own listing cannot corroborate itself; the reader-facing rule
  // already refuses that and the audit must not reintroduce it.
  const snapshot = snapshotForReleasedEntity(
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'record_index',
          predicate: 'listing',
          object: 'x',
          citationSource: 'nps.gov',
        },
        {
          id: 'c2',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'y',
          citationSource: 'nps.gov',
        },
      ],
    }),
  );
  assert.equal(snapshot.claims[0]?.inPublicSummary, false);
  assert.equal(snapshot.claims[1]?.inPublicSummary, true);
});

test('the audit reports what it could not see rather than passing it silently', () => {
  // The released projection has no selectors, no captures and no document dates. Each of those
  // must surface as a deficit; "we did not record this" and "this is fine" must not look alike.
  const report = auditReleasedEntities('rel_test', [
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'in Chelsea',
          citationHref: 'https://www.nps.gov/x',
          citationSource: 'nps.gov',
        },
      ],
    }),
  ]);
  assert.equal(report.entityCount, 1);
  assert.ok(report.deficitDistribution.claim_without_evidence_selector === 1);
  assert.ok(report.deficitDistribution.missing_creation_or_publication_date === 1);
  assert.ok(report.deficitDistribution.generic_confidence_dimension === 1);
});

test('a bridge-only entity is counted as zero corroborating lineages, not one', () => {
  const report = auditReleasedEntities('rel_test', [
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'born',
          object: 'somewhere',
          citationHref: 'https://en.wikipedia.org/wiki/X',
          citationSource: 'en.wikipedia.org',
        },
      ],
    }),
  ]);
  assert.equal(report.lineage.bridgeOnlyEntities, 1);
  assert.equal(report.lineage.zeroCorroboratingLineageEntities, 1);
  assert.ok(report.deficitDistribution.wikipedia_only_summary_claim === 1);
});

test('two hosts of one authority do not read as two lineages', () => {
  const report = auditReleasedEntities('rel_test', [
    entity({
      claims: [
        {
          id: 'c1',
          claimRole: 'evidence',
          predicate: 'listed',
          object: 'x',
          citationHref: 'https://www.nps.gov/a',
          citationSource: 'nps.gov',
        },
        {
          id: 'c2',
          claimRole: 'evidence',
          predicate: 'documented_site',
          object: 'y',
          citationHref: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/1_text',
          citationSource: 'npgallery.nps.gov',
        },
      ],
      claimCountHint: undefined,
    } as Partial<ReleasedEntity>),
  ]);
  assert.equal(report.lineage.singleCorroboratingLineageEntities, 1);
});

test('per-entity rows appear only when the caller narrowed the query', () => {
  // A full-catalog run reports distributions; 4,000 rows of JSON is not a report.
  const one = [entity({ claims: [] })];
  assert.equal(auditReleasedEntities('rel_test', one).entities, undefined);
  assert.equal(
    auditReleasedEntities('rel_test', one, { includeEntities: true })?.entities?.length,
    1,
  );
});

test('the audit never returns a commit or write affordance', () => {
  const report = auditReleasedEntities('rel_test', [entity()]);
  assert.equal(report.verb, 'research-quality-audit');
  assert.equal('committed' in report, false);
});
