/**
 * Unit tests for the single deterministic per-entity release/projection builder
 * (the related workstream). See ./release-builder.ts's module doc comment for the contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildReleaseEntityArtifacts,
  buildReleaseNotabilityBasis,
  computeReleaseResearchCoverage,
  inferNotabilityCriterionFromClaim,
  resolveReleaseClaimId,
  resolveReleaseEntityReferences,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from './release-builder.js';

const CONTEXT = { releaseId: 'release-2026-07-18', generatedAt: '2026-07-18T00:00:00.000Z' };

function baseEntry(overrides: Partial<ReleaseSourceEntity> = {}): ReleaseSourceEntity {
  return {
    id: 'ent_example_001',
    kind: 'place',
    displayName: 'Example Site',
    summary: 'A'.repeat(130),
    jurisdictionLabel: 'Atlanta, Georgia',
    locationPrecision: 'institution',
    locationLabel: '123 Example Street area',
    lat: 33.749,
    lng: -84.388,
    topicIds: ['church'],
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Example Source',
        citationLabel: 'Example Citation',
      },
    ],
    ...overrides,
  };
}

test('resolveReleaseClaimId is stable and deterministic for a given entry+index', () => {
  const entry = baseEntry();
  const claim = entry.claims![0]!;
  const id1 = resolveReleaseClaimId(entry, claim, 0);
  const id2 = resolveReleaseClaimId(entry, claim, 0);
  assert.equal(id1, id2);
  assert.equal(id1, 'claim_example_001_01');
});

test('resolveReleaseClaimId respects an explicit id when present', () => {
  const entry = baseEntry();
  const claim = { ...entry.claims![0]!, id: 'claim_custom' };
  assert.equal(resolveReleaseClaimId(entry, claim, 0), 'claim_custom');
});

test('inferNotabilityCriterionFromClaim recognizes a documented "first" claim', () => {
  assert.equal(
    inferNotabilityCriterionFromClaim('recognized_as', 'the first Black woman to do X'),
    'first_to_do_x',
  );
});

test('inferNotabilityCriterionFromClaim recognizes a landmark/register claim', () => {
  assert.equal(
    inferNotabilityCriterionFromClaim('listed_on', 'the National Register of Historic Places in 1984'),
    'landmark_or_national_register',
  );
});

test('inferNotabilityCriterionFromClaim falls back to documented_site when no marker matches', () => {
  assert.equal(inferNotabilityCriterionFromClaim('founded_year', '1900'), 'documented_site');
});

test('buildReleaseNotabilityBasis groups claims by predicate with real evidenceIds', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: 'Source A',
        citationLabel: 'Citation A',
      },
      {
        predicate: 'founded_year',
        object: '1900 (corroborating)',
        confidenceLevel: 'medium',
        citationSource: 'Source B',
        citationLabel: 'Citation B',
      },
      {
        predicate: 'listed_on',
        object: 'the National Register of Historic Places',
        confidenceLevel: 'high',
        citationSource: 'Source C',
        citationLabel: 'Citation C',
      },
    ],
  });
  const basis = buildReleaseNotabilityBasis(entry);
  assert.equal(basis.length, 2);
  const foundedBasis = basis.find((b) => b.evidenceIds.length === 2);
  assert.ok(foundedBasis, 'expected a basis record covering both founded_year claims');
  assert.equal(foundedBasis!.criterion, 'documented_site');
  assert.match(foundedBasis!.note, /founded year: 1900/i);
  assert.match(foundedBasis!.note, /Cited from Source A; Source B/);
  assert.doesNotMatch(foundedBasis!.note, /documented site of a historically significant/i);
  const landmarkBasis = basis.find((b) => b.criterion === 'landmark_or_national_register');
  assert.ok(landmarkBasis, 'expected a landmark_or_national_register basis record');
  assert.equal(landmarkBasis!.evidenceIds.length, 1);
  assert.match(landmarkBasis!.note, /Cited from Source C/);
});

test('buildReleaseNotabilityBasis never fabricates evidence for an uncited claim', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: '   ',
        citationLabel: 'Citation A',
      },
    ],
  });
  const basis = buildReleaseNotabilityBasis(entry);
  assert.equal(basis.length, 1);
  assert.deepEqual(basis[0]!.evidenceIds, []);
});

test('computeReleaseResearchCoverage: zero/one cited claim is minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    { id: 'c1', predicate: 'p', object: 'o', confidenceLevel: 'high', citationSource: 'S', citationLabel: 'L' },
  ];
  assert.equal(computeReleaseResearchCoverage(claims), 'minimal');
});

test('computeReleaseResearchCoverage: two-to-four cited claims is partial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 3 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims), 'partial');
});

test('computeReleaseResearchCoverage: five+ fully-cited claims is substantial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims), 'substantial');
});

test('computeReleaseResearchCoverage: five claims with one uncited stays partial, not substantial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: i === 4 ? '' : 'S',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims), 'partial');
});

test('resolveReleaseEntityReferences fails closed on an unresolved topicId', () => {
  const entry = baseEntry({ topicIds: ['not-a-real-topic'] });
  const claims: readonly ReleaseClaimProjection[] = [];
  const result = resolveReleaseEntityReferences(entry, claims, []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /topicIds/);
});

test('resolveReleaseEntityReferences fails closed on a dangling notabilityBasis evidenceId', () => {
  const entry = baseEntry();
  const claims: readonly ReleaseClaimProjection[] = [
    { id: 'claim_real', predicate: 'p', object: 'o', confidenceLevel: 'high', citationSource: 'S', citationLabel: 'L' },
  ];
  const result = resolveReleaseEntityReferences(entry, claims, [
    { criterion: 'documented_site', note: 'note', evidenceIds: ['claim_does_not_exist'] },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /evidenceIds/);
});

test('resolveReleaseEntityReferences fails closed on an empty jurisdictionLabel', () => {
  const entry = baseEntry({ jurisdictionLabel: '   ' });
  const result = resolveReleaseEntityReferences(entry, [], []);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /jurisdiction/);
});

test('buildReleaseEntityArtifacts produces a full projection + search doc for a valid entry', () => {
  const entry = baseEntry();
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.id, entry.id);
  assert.equal(result.projection.releaseId, CONTEXT.releaseId);
  assert.equal(result.projection.generatedAt, CONTEXT.generatedAt);
  assert.equal(result.projection.recordUpdatedAt, CONTEXT.generatedAt);
  assert.equal(result.projection.notabilityBasis.length, 1);
  assert.ok(result.projection.notabilityBasis[0]!.evidenceIds.length > 0);
  assert.equal(result.projection.researchCoverage, 'minimal');
  assert.equal(result.searchIndex.claimCount, 1);
  assert.deepEqual(result.searchIndex.notabilityBasis, result.projection.notabilityBasis);
  assert.equal(result.searchIndex.researchCoverage, result.projection.researchCoverage);
});

test('buildReleaseEntityArtifacts fails closed with no_citations when an entry has zero claims', () => {
  const entry = baseEntry({ claims: [] });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'no_citations');
});

test('buildReleaseEntityArtifacts fails closed when every claim lacks a citationSource', () => {
  const entry = baseEntry({
    claims: [
      {
        predicate: 'founded_year',
        object: '1900',
        confidenceLevel: 'high',
        citationSource: '   ',
        citationLabel: 'Citation A',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'notability_basis_gate');
});

test('buildReleaseEntityArtifacts fails closed on an unresolvable topicId', () => {
  const entry = baseEntry({ topicIds: ['definitely-not-real'] });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'reference_resolution');
});

test('buildReleaseEntityArtifacts throws on an out-of-range coordinate', () => {
  const entry = baseEntry({ lat: 200 });
  assert.throws(() => buildReleaseEntityArtifacts(entry, CONTEXT), /lat out of range/);
});

test('buildReleaseEntityArtifacts is deterministic across repeated calls', () => {
  const entry = baseEntry();
  const first = buildReleaseEntityArtifacts(entry, CONTEXT);
  const second = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.deepEqual(first, second);
});

test('buildReleaseEntityArtifacts prefers locationOverride over catalog lat/lng', () => {
  const entry = baseEntry({ lat: 33.749, lng: -84.388 });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    locationOverride: {
      lat: 33.7554,
      lng: -84.376,
      precision: 'neighborhood',
      matchMethod: 'geocode_census',
      locationLabel: 'Sweet Auburn, Atlanta',
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.location.lat, 33.7554);
  assert.equal(result.projection.location.lng, -84.376);
  assert.equal(result.projection.location.precision, 'neighborhood');
  assert.equal(result.projection.location.matchMethod, 'geocode_census');
  assert.equal(result.projection.locationLabel, 'Sweet Auburn, Atlanta');
});

test('buildReleaseEntityArtifacts prefers context.relatedEntries over entry.related bootstrap', () => {
  const entry = baseEntry({
    related: [{ id: 'ent_bootstrap_001', type: 'related_to', direction: 'outgoing' }],
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    relatedEntries: [
      { id: 'ent_graph_001', type: 'located_at', direction: 'outgoing' },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.projection.related, [
    { id: 'ent_graph_001', type: 'located_at', direction: 'outgoing' },
  ]);
  assert.equal(result.searchIndex.relatedCount, 1);
});

test('buildReleaseEntityArtifacts falls back to entry.related when context has no relatedEntries', () => {
  const entry = baseEntry({
    related: [{ id: 'ent_arrest_site_001', type: 'located_at', direction: 'outgoing' }],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.projection.related, [
    { id: 'ent_arrest_site_001', type: 'located_at', direction: 'outgoing' },
  ]);
  assert.equal(result.searchIndex.relatedCount, 1);
});

test('buildReleaseEntityArtifacts omits related and keeps relatedCount 0 when none provided', () => {
  const entry = baseEntry();
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.related, undefined);
  assert.equal(result.searchIndex.relatedCount, 0);
});
