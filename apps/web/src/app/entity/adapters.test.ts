/**
 * Unit tests for entity page adapters that map public claim views into evidence inputs.
 * Covers `toEvidenceClaimInputs` source-lineage mapping from explicit scored counts only
 * (citation-based record rollup lives in EntityEvidencePanel / resolveRecordSourceLineage),
 * and `buildWhyThisAppearsForEntity`, which the record room's "Why this is here" block mounts.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicClaimView, PublicEntityView } from '../../data/public-seed';
import {
  buildWhyThisAppearsForEntity,
  toEvidenceClaimInputs,
  whyAppearsEvidenceById,
  withoutSummaryEchoClaims,
} from './[id]/adapters';

const BASE_CLAIM: PublicClaimView = {
  id: 'claim_test_01',
  predicate: 'founded_year',
  object: '1900',
  confidenceScore: 0.85,
  confidenceLevel: 'high',
  citationSource: 'Example Source',
  citationLabel: 'Example Citation',
};

test('toEvidenceClaimInputs maps explicit independentLineageCount when greater than zero', () => {
  const [mapped] = toEvidenceClaimInputs([{ ...BASE_CLAIM, independentLineageCount: 3 }]);
  assert.deepEqual(mapped!.sourceLineage, { independentLineageCount: 3 });
});

test('toEvidenceClaimInputs omits sourceLineage when count is absent (panel uses citation proxy)', () => {
  const [mapped] = toEvidenceClaimInputs([BASE_CLAIM]);
  assert.equal(mapped!.sourceLineage, undefined);
});

test('toEvidenceClaimInputs omits sourceLineage when count is zero', () => {
  const [mapped] = toEvidenceClaimInputs([{ ...BASE_CLAIM, independentLineageCount: 0 }]);
  assert.equal(mapped!.sourceLineage, undefined);
});

const SUMMARY =
  'Bethel Literary and Historical Society met at Metropolitan AME Church, where Black ' +
  'Washingtonians debated the questions of the day for more than forty years.';

test('withoutSummaryEchoClaims drops a claim whose object restates the summary', () => {
  const echo: PublicClaimView = { ...BASE_CLAIM, predicate: 'documented_site', object: SUMMARY };
  assert.deepEqual(withoutSummaryEchoClaims([echo], SUMMARY), []);
});

test('withoutSummaryEchoClaims ignores case, spacing, and a trailing period when matching', () => {
  const echo: PublicClaimView = {
    ...BASE_CLAIM,
    object: `  ${SUMMARY.toUpperCase().replace(' met ', '   met   ')}  `,
  };
  assert.deepEqual(withoutSummaryEchoClaims([echo], SUMMARY), []);
});

test('withoutSummaryEchoClaims keeps claims that say something the summary does not', () => {
  const listing: PublicClaimView = {
    ...BASE_CLAIM,
    predicate: 'listing',
    object: 'Listed on the National Register of Historic Places, ref #71000836.',
  };
  const echo: PublicClaimView = { ...BASE_CLAIM, id: 'claim_test_02', object: SUMMARY };
  assert.deepEqual(withoutSummaryEchoClaims([listing, echo], SUMMARY), [listing]);
});

test('withoutSummaryEchoClaims leaves every claim in place when the summary is empty', () => {
  // An empty summary would otherwise normalize to '' and match any claim that is also blank.
  assert.deepEqual(withoutSummaryEchoClaims([BASE_CLAIM], '   '), [BASE_CLAIM]);
});

/*
 * `buildWhyThisAppearsForEntity` is what the record room's "Why this is here" block mounts
 * (repo-tgfw5). The domain composer it wraps fails CLOSED — it throws rather than returning a
 * partial payload — and on a server-rendered record page an uncaught throw is not a collapsed
 * block, it is a page that does not render. So the contract these tests pin is that a refusal
 * comes back as `undefined`, letting the caller fall back to the rubric labels.
 */

type EntityOverrides = Partial<PublicEntityView> & { readonly id: string };

/** Minimal projection: only the fields the why-this-appears adapter actually reads. */
function whyEntity(overrides: EntityOverrides): PublicEntityView {
  return {
    kind: 'place',
    displayName: `Record ${overrides.id}`,
    summary: SUMMARY,
    era: '1880s',
    topicTags: [],
    jurisdictionLabel: 'District of Columbia',
    locationPrecision: 'city',
    locationLabel: 'Washington',
    relevanceExplanation:
      'Bethel Literary and Historical Society gave Black Washingtonians a standing forum for ' +
      'public debate for more than forty years.',
    historicalContext: '',
    recordMaturity: 'stub',
    researchCoverage: 'minimal',
    mapPin: { x: 0, y: 0 },
    claims: [{ ...BASE_CLAIM, predicate: 'met_at', object: 'Metropolitan AME Church' }],
    timeline: [],
    revision: {} as PublicEntityView['revision'],
    relatedIds: [],
    notabilityBasis: [
      {
        criterion: 'documented_site',
        note: 'Met at Metropolitan AME Church from 1881.',
        evidenceIds: [BASE_CLAIM.id],
      },
    ],
    ...overrides,
  } as PublicEntityView;
}

test('buildWhyThisAppearsForEntity composes a payload from the record own basis', () => {
  const result = buildWhyThisAppearsForEntity(whyEntity({ id: 'ent_bethel_literary_001' }));
  assert.notEqual(result, undefined);
});

test('buildWhyThisAppearsForEntity returns undefined when the composer refuses, never throws', () => {
  // A record with no stored basis AND no cited claim has nothing to synthesize a basis from
  // (`notabilityBasisFor` returns []) and no non-gate relevance evidence, so the composer
  // refuses on both counts. This is the thin-record shape the fallback exists for: the room
  // must still render, on notabilityLabels.
  const refused = whyEntity({ id: 'ent_no_basis_001', notabilityBasis: [], claims: [] });
  assert.doesNotThrow(() => buildWhyThisAppearsForEntity(refused));
  assert.equal(buildWhyThisAppearsForEntity(refused), undefined);
});

test('buildWhyThisAppearsForEntity still composes when only cited claims back the record', () => {
  // `notabilityBasisFor` synthesizes one basis row per cited claim when the projection carries
  // none, so an empty notabilityBasis is NOT by itself a refusal.
  const synthesized = whyEntity({ id: 'ent_synthesized_001', notabilityBasis: [] });
  assert.notEqual(buildWhyThisAppearsForEntity(synthesized), undefined);
});

test('buildWhyThisAppearsForEntity refuses a record whose explanation is too short to be a reason', () => {
  const terse = whyEntity({ id: 'ent_terse_001', relevanceExplanation: 'Black site.' });
  assert.equal(buildWhyThisAppearsForEntity(terse), undefined);
});

test('whyAppearsEvidenceById keys each cited claim so WhyThisAppears can link it', () => {
  const map = whyAppearsEvidenceById(whyEntity({ id: 'ent_bethel_literary_001' }));
  assert.deepEqual(Object.keys(map), [BASE_CLAIM.id]);
  assert.equal(map[BASE_CLAIM.id]!.source, BASE_CLAIM.citationSource);
});
