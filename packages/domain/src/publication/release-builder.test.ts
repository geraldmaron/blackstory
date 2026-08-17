/**
 * Unit tests for the single deterministic per-entity release/projection builder
 * (the related workstream). See ./release-builder.ts's module doc comment for the contract.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildNotabilityBasisNote,
  buildReleaseEntityArtifacts,
  buildReleaseNotabilityBasis,
  computeReleaseResearchCoverage,
  formatClaimInclusionNote,
  inferNotabilityCriterionFromClaim,
  resolveReleaseClaimId,
  resolveReleaseEntityReferences,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from './release-builder.js';
import { NRHP_SUMMARY_FILLER, NRHP_SUMMARY_TRAILER } from './template-summary-signatures.js';
import { sanitizePublicProseText } from './public-render.js';

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
    inferNotabilityCriterionFromClaim(
      'listed_on',
      'the National Register of Historic Places in 1984',
    ),
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
  assert.match(foundedBasis!.note, /^Founded year 1900\./);
  assert.doesNotMatch(foundedBasis!.note, /Cited from/i);
  assert.doesNotMatch(foundedBasis!.note, /documented site of a historically significant/i);
  const landmarkBasis = basis.find((b) => b.criterion === 'landmark_or_national_register');
  assert.ok(landmarkBasis, 'expected a landmark_or_national_register basis record');
  assert.equal(landmarkBasis!.evidenceIds.length, 1);
  assert.match(landmarkBasis!.note, /^Listed on the National Register of Historic Places\./);
  assert.doesNotMatch(landmarkBasis!.note, /Cited from/i);
});

test('formatClaimInclusionNote / buildNotabilityBasisNote read as prose, not predicate dumps', () => {
  assert.equal(
    formatClaimInclusionNote(
      'served_as',
      "the Birmingham campaign's headquarters from April through May 1963",
    ),
    "Served as the Birmingham campaign's headquarters from April through May 1963.",
  );
  assert.equal(
    formatClaimInclusionNote('bombed_on', 'May 11, 1963, the day after the truce was announced'),
    'Bombed on May 11, 1963, the day after the truce was announced.',
  );
  assert.equal(
    buildNotabilityBasisNote('served_as', [
      {
        id: 'c1',
        predicate: 'served_as',
        object: "the campaign's headquarters",
        confidenceLevel: 'high',
        citationSource: 'nps.gov',
        citationLabel: 'NPS',
      },
    ]),
    "Served as the campaign's headquarters.",
  );
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

/**
 * Prose with no registered template fingerprint — the normal case, where coverage is decided by
 * the claim set alone. The tests below that exercise the fingerprint cap pass a templated summary
 * instead, so the two axes stay independently testable (repo-vymq).
 */
const RESEARCHED_SUMMARY =
  'Founded in 1881 by formerly enslaved families, the school served the county until 1968 and its ' +
  'graduates led the local voter-registration drives of the following decade.';

/** One claim citing one document — the floor case. */
test('computeReleaseResearchCoverage: a single cited claim is minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'c1',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'S',
      citationLabel: 'L',
    },
  ];
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

/** repo-z1pw, the exact live shape: the nrhp-black-heritage lane carves a listing fact and a
 *  significance fact out of ONE registry index row, both citing that row's own URL. Counting
 *  claims graded this 'partial' and suppressed the thin-record notice on 2,436 live records. */
test('computeReleaseResearchCoverage: many claims citing ONE document is minimal, not partial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 3 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'catalog.archives.gov',
    citationHref: 'https://catalog.archives.gov/id/77843341',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

/** Query strings, anchors and trailing slashes must not split one document into several — that
 *  would recreate the inflation this function exists to prevent. */
test('computeReleaseResearchCoverage: url noise does not make one document look like several', () => {
  const hrefs = [
    'https://catalog.archives.gov/id/77843341',
    'https://www.catalog.archives.gov/id/77843341/',
    'https://catalog.archives.gov/id/77843341?utm_source=x',
    'https://catalog.archives.gov/id/77843341#section-8',
  ];
  const claims: readonly ReleaseClaimProjection[] = hrefs.map((href, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'catalog.archives.gov',
    citationHref: href,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

/** Same publisher, different documents — the NRHP nomination form alongside the index entry.
 *  That is real research and counts, which is why this grades documents, not publishers. */
test('computeReleaseResearchCoverage: two documents from one publisher is partial', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'c1',
      predicate: 'listing',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'npgallery.nps.gov',
      citationHref: 'https://npgallery.nps.gov/NRHP/GetAsset/NRHP/12000300_text',
      citationLabel: 'L',
    },
    {
      id: 'c2',
      predicate: 'built',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'npgallery.nps.gov',
      citationHref: 'https://npgallery.nps.gov/NRHP/AssetDetail?assetID=12000300',
      citationLabel: 'L',
    },
  ];
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'partial');
});

test('computeReleaseResearchCoverage: five+ fully-cited claims across two documents is substantial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: `https://example.org/doc-${i % 2}`,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'substantial');
});

/**
 * repo-vymq. The claim set here is the SAME one that scores 'substantial' directly above — five
 * fully-cited claims across two documents. Only the summary differs. A record whose description
 * was assembled from index fields cannot publish above 'minimal' no matter how its claims score,
 * because coverage is a statement about the prose a reader actually sees.
 */
test('computeReleaseResearchCoverage: a templated summary caps coverage at minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: `https://example.org/doc-${i % 2}`,
    citationLabel: 'L',
  }));
  const templated = `The Mount Zion Missionary Baptist Church is a historic site.${NRHP_SUMMARY_TRAILER}`;
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'substantial');
  assert.equal(computeReleaseResearchCoverage(claims, templated), 'minimal');
});

/** The filler sentence is a fingerprint in its own right, not only the trailer. */
test('computeReleaseResearchCoverage: the filler sentence also caps coverage', () => {
  const claims: readonly ReleaseClaimProjection[] = [0, 1].map((i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: `https://example.org/doc-${i}`,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'partial');
  assert.equal(
    computeReleaseResearchCoverage(claims, `A historic site.${NRHP_SUMMARY_FILLER}`),
    'minimal',
  );
});

/** The cap follows the entity through the builder, not just the bare coverage function. */
test('buildReleaseEntityArtifacts publishes a templated summary as minimal coverage', () => {
  const entry = baseEntry({
    summary: `The Lincoln School is a historic site in Alabama.${NRHP_SUMMARY_TRAILER}`,
    claims: [
      {
        predicate: 'listed',
        object: 'Listed on the National Register in 1979.',
        confidenceLevel: 'high',
        citationSource: 'npgallery.nps.gov',
        citationHref: 'https://npgallery.nps.gov/GetAsset/1',
        citationLabel: 'NRHP nomination',
      },
      {
        predicate: 'documented by',
        object: 'A 1979 survey of Black schools in the county.',
        confidenceLevel: 'high',
        citationSource: 'example.org',
        citationHref: 'https://example.org/survey',
        citationLabel: 'County survey',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.projection.researchCoverage, 'minimal');
  assert.equal(result.ok && result.searchIndex.researchCoverage, 'minimal');
});

/** Claim volume alone never reaches 'substantial' — the document floor binds first. */
test('computeReleaseResearchCoverage: five+ claims on one document stays minimal', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 6 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: 'S',
    citationHref: 'https://example.org/only-doc',
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
});

test('computeReleaseResearchCoverage: five claims with one uncited stays partial, not substantial', () => {
  const claims: readonly ReleaseClaimProjection[] = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    predicate: `p${i}`,
    object: 'o',
    confidenceLevel: 'high' as const,
    citationSource: i === 4 ? '' : 'S',
    citationHref: i === 4 ? undefined : `https://example.org/doc-${i % 2}`,
    citationLabel: 'L',
  }));
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'partial');
});

/** An uncited claim contributes no document — it must not be counted as its own source. */
test('computeReleaseResearchCoverage: uncited claims contribute no coverage', () => {
  const claims: readonly ReleaseClaimProjection[] = [
    {
      id: 'c1',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'https://example.org/doc-a',
      citationHref: 'https://example.org/doc-a',
      citationLabel: 'L',
    },
    {
      id: 'c2',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: '',
      citationLabel: 'L',
    },
    {
      id: 'c3',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: '   ',
      citationLabel: 'L',
    },
  ];
  assert.equal(computeReleaseResearchCoverage(claims, RESEARCHED_SUMMARY), 'minimal');
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
    {
      id: 'claim_real',
      predicate: 'p',
      object: 'o',
      confidenceLevel: 'high',
      citationSource: 'S',
      citationLabel: 'L',
    },
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

test('resolveReleaseEntityReferences rejects a prohibited public precision on any kind', () => {
  for (const precision of ['street_address', 'unit', 'parcel', 'exact_coordinates', 'residence']) {
    const entry = baseEntry({ kind: 'place', locationPrecision: precision });
    const result = resolveReleaseEntityReferences(entry, [], []);
    assert.equal(result.ok, false, `expected "${precision}" to be rejected`);
    if (!result.ok) assert.match(result.reason, /prohibited public precision/);
  }
});

test('resolveReleaseEntityReferences allows institution/campus precision for a person (repo-2t04.3)', () => {
  for (const precision of ['institution', 'campus']) {
    const entry = baseEntry({
      kind: 'person',
      locationPrecision: precision,
      livingStatus: 'unknown',
    });
    const result = resolveReleaseEntityReferences(entry, [], []);
    assert.equal(result.ok, true, `expected "${precision}" to be allowed for a person`);
  }
});

test('resolveReleaseEntityReferences rejects "address" precision for a living or unknown-status person', () => {
  for (const livingStatus of ['living', 'unknown'] as const) {
    const entry = baseEntry({ kind: 'person', locationPrecision: 'address', livingStatus });
    const result = resolveReleaseEntityReferences(entry, [], []);
    assert.equal(result.ok, false, `expected "address" to be rejected for livingStatus=${livingStatus}`);
    if (!result.ok) assert.match(result.reason, /precision ceiling/);
  }
});

test('resolveReleaseEntityReferences allows "address" precision for a confirmed-deceased person', () => {
  const entry = baseEntry({ kind: 'person', locationPrecision: 'address', livingStatus: 'deceased' });
  const result = resolveReleaseEntityReferences(entry, [], []);
  assert.equal(result.ok, true);
});

test('resolveReleaseEntityReferences allows "address" precision for a non-person entity', () => {
  const entry = baseEntry({ kind: 'place', locationPrecision: 'address' });
  const result = resolveReleaseEntityReferences(entry, [], []);
  assert.equal(result.ok, true);
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

test('buildReleaseEntityArtifacts fails closed when an admin flagged the entity for retraction', () => {
  const entry = baseEntry();
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    catalogDecision: { action: 'flag_for_retraction', reason: 'Owner-confirmed factual error' },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, 'catalog_decision_retracted');
  assert.match(result.message, /Owner-confirmed factual error/);
});

test('buildReleaseEntityArtifacts ignores a needs_review or clear_flag catalog decision', () => {
  const entry = baseEntry();
  for (const action of ['needs_review', 'clear_flag'] as const) {
    const result = buildReleaseEntityArtifacts(entry, {
      ...CONTEXT,
      catalogDecision: { action, reason: 'just a note' },
    });
    assert.equal(result.ok, true, `expected ${action} to still build`);
  }
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
    relatedEntries: [{ id: 'ent_graph_001', type: 'located_at', direction: 'outgoing' }],
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

test('buildReleaseEntityArtifacts sanitizes prose links in search index and claim objects', () => {
  const entry = baseEntry({
    summary: 'The U.S. [[gap_supreme_court|Supreme Court]], established in 1789.',
    claims: [
      {
        predicate: 'established',
        object: 'The [[gap_supreme_court|Supreme Court]] began operations in 1789.',
        confidenceLevel: 'high',
        citationSource: 'Example Source',
        citationLabel: 'Example Citation',
      },
    ],
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.searchIndex.summary, 'The U.S. Supreme Court, established in 1789.');
  assert.equal(
    result.projection.summary,
    'The U.S. [[gap_supreme_court|Supreme Court]], established in 1789.',
  );
  assert.equal(result.projection.claims[0]?.object, 'The Supreme Court began operations in 1789.');
  assert.equal(sanitizePublicProseText('[[gap_supreme_court|Supreme Court]]'), 'Supreme Court');
});

test('buildReleaseEntityArtifacts derives status when entry has no status field', () => {
  const entry = baseEntry({
    summary:
      'Howard University remains a working research university in Washington, D.C., with an active campus.',
    eraBuckets: ['1860s'],
  });
  assert.equal(entry.status, undefined);
  assert.equal(entry.statusHistory, undefined);

  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.status, 'active');
  assert.equal(result.searchIndex.status, 'active');
  assert.ok(result.projection.statusHistory);
  assert.equal(result.projection.statusHistory?.[0]?.status, 'active');
  assert.equal(result.projection.statusHistory?.[0]?.validFrom, '1860');
  assert.equal(result.projection.statusProvenance, 'derived_heuristic');
});

test('canonical living_status deceased wins over source hints that would imply living', () => {
  const entry = baseEntry({
    kind: 'person',
    summary: 'A'.repeat(130),
    livingStatus: 'living',
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    canonicalStatus: { livingStatus: 'deceased' },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.livingStatus, 'deceased');
  assert.equal(result.projection.status, 'deceased');
  assert.equal(result.projection.statusProvenance, 'canonical');
  assert.equal(result.searchIndex.status, 'deceased');
});

test('canonical status_history uses currentStatus for multi-entry histories', () => {
  const entry = baseEntry({
    kind: 'law',
    summary:
      'The Civil Rights Act of 1964 outlawed discrimination based on race, color, religion, sex, and national origin in public accommodations and employment nationwide.',
  });
  const result = buildReleaseEntityArtifacts(entry, {
    ...CONTEXT,
    canonicalStatus: {
      statusHistory: [
        {
          status: 'in_force',
          validFrom: '1964',
          validTo: '2020',
          datePrecision: 'year',
          basisClaimIds: [],
        },
        {
          status: 'repealed',
          validFrom: '2020',
          datePrecision: 'year',
          basisClaimIds: [],
        },
      ],
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.status, 'repealed');
  assert.equal(result.projection.statusProvenance, 'canonical');
});

test('person projection carries livingStatus and statusProvenance from heuristic backstop', () => {
  const entry = baseEntry({
    kind: 'person',
    summary:
      'A'.repeat(120) +
      ' She died in 1972 after decades of community leadership in Atlanta, Georgia.',
    livingStatus: 'deceased',
  });
  const result = buildReleaseEntityArtifacts(entry, CONTEXT);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.projection.livingStatus, 'deceased');
  assert.equal(result.projection.status, 'deceased');
  assert.equal(result.projection.statusProvenance, 'derived_heuristic');
});
