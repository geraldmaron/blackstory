/**
 * Unit tests for incremental publish gating and row mapping.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReleaseSourceFromLandscape,
  buildArtifactsForEntry,
  canonicalUpsertParamsFromLandscape,
  gateLandscapePublishCandidate,
  incrementalPublishProvenancePatch,
  jurisdictionFromProvenance,
  parseCanonicalStatusSnapshot,
  toReleaseEntityRow,
  type LandscapePublishRow,
} from './incremental-publish.ts';
import { buildReleaseEntityArtifacts } from '@repo/domain';

const baseRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow => ({
  id: 'dc-black-history-sites-b10',
  lane: 'dc-sites',
  kind: 'place',
  display_name: 'Gardner Bishop Barber Shop',
  summary:
    'Business site at 1900 15th Street NW in Washington, DC (1940), documented in the DC Historic Preservation Office inventory.',
  lat: 38.915775,
  lng: -77.034763,
  canonical_url: 'https://historicsites.dcpreservation.org/items/show/1055',
  source_item_id: 'b10',
  provenance: {
    sourceCategory: 'Business',
    historicAddress: '1900 15th Street NW',
    sourceCity: 'Washington',
    sourceState: 'DC',
  },
  payload: {},
  exact_in_release: false,
  name_overlap: false,
  ...overrides,
});

test('jurisdictionFromProvenance maps DC to full label', () => {
  assert.equal(
    jurisdictionFromProvenance({ sourceCity: 'Washington', sourceState: 'DC' }),
    'Washington, District of Columbia',
  );
});

test('buildReleaseSourceFromLandscape produces claims from canonical_url', () => {
  const entry = buildReleaseSourceFromLandscape(baseRow());
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 1);
  assert.equal(
    entry?.claims?.[0]?.citationHref,
    'https://historicsites.dcpreservation.org/items/show/1055',
  );
});

test('gateLandscapePublishCandidate rejects person privacy holds', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ kind: 'person' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate lets an operator-reviewed person past the privacy hold', () => {
  const reviewed = baseRow({
    kind: 'person',
    payload: {
      personReview: {
        approved: true,
        approvedBy: 'operator',
        approvedAt: '2026-07-28T00:00:00.000Z',
        basis: 'deceased historical figure',
      },
    },
  });
  const result = gateLandscapePublishCandidate({
    row: reviewed,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  // Passes the person hold; may still fail later gates, but not person_kind.
  if (!result.eligible) assert.notEqual(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects incomplete personReview markers', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ kind: 'person', payload: { personReview: { approved: true } } }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'person_kind');
});

test('gateLandscapePublishCandidate rejects greenbook lane', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ lane: 'greenbook' }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'greenbook_lane');
});

test('gateLandscapePublishCandidate rejects already-in-public rows', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, 'already_in_public');
});

test('gateLandscapePublishCandidate allowRepublish lets an already-published row past already_in_public', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow({ exact_in_release: true }),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    allowRepublish: true,
  });
  if (!result.eligible) assert.notEqual(result.reason, 'already_in_public');
});

const nrhpRow = (overrides: Partial<LandscapePublishRow> = {}): LandscapePublishRow =>
  baseRow({
    id: 'nrhp-black-heritage-71000836',
    lane: 'nrhp-black-heritage',
    display_name: 'Tri-State Bank',
    summary:
      'Tri-State Bank is a building in Memphis, Shelby County, Tennessee listed on the National ' +
      'Register of Historic Places on July 30, 1971 for its significance in Black heritage and ' +
      "performing arts. The National Park Service's National Register program recognizes it as " +
      'a documented site of African American historical importance.',
    canonical_url: 'https://npgallery.nps.gov/AssetDetail/NRIS/71000836',
    payload: {
      refnum: '71000836',
      listedDateSerial: '26146',
      areaOfSignificance: 'BLACK; PERFORMING ARTS',
    },
    ...overrides,
  });

test('buildReleaseSourceFromLandscape gives the NRHP lane a distinct listing-fact claim and a distinct significance claim', () => {
  const entry = buildReleaseSourceFromLandscape(nrhpRow());
  assert.ok(entry);
  assert.equal(entry?.claims?.length, 2);

  const [listing, significance] = entry!.claims!;
  // claims[0].object is the listing FACT — never a copy of `summary`.
  assert.notEqual(listing!.object, entry!.summary);
  // Fragment, not a full sentence — see buildNrhpListingFactObject's doc comment: a full
  // "Listed on..." sentence collides with formatClaimInclusionNote's own "Listing" lead when
  // the claim renders as prose ("Listing Listed on...").
  assert.match(listing!.object, /^on the National Register of Historic Places/);
  assert.match(listing!.object, /reference #71000836/);

  // The significance claim is distinct prose from both the summary and the listing-fact object,
  // and the raw NPS code never leaks through as "(Black)" or similar.
  assert.notEqual(significance!.object, entry!.summary);
  assert.notEqual(significance!.object, listing!.object);
  assert.doesNotMatch(significance!.object, /\(black/i);
  assert.match(significance!.object, /Black heritage/);
});

test('buildReleaseSourceFromLandscape keeps the single-claim shape for non-NRHP lanes', () => {
  const entry = buildReleaseSourceFromLandscape(baseRow());
  assert.equal(entry?.claims?.length, 1);
  assert.equal(entry?.claims?.[0]?.object, entry?.summary);
});

test('gateLandscapePublishCandidate accepts tier-1 DC site stub', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  if (result.eligible) {
    assert.ok(result.confidence >= 0.75);
    const build = buildReleaseEntityArtifacts(result.entry, {
      releaseId: 'rel_seed_001',
      generatedAt: '2026-07-22T00:00:00.000Z',
    });
    assert.equal(build.ok, true);
    if (build.ok) {
      const row = toReleaseEntityRow(build.projection);
      assert.equal(row.entity_id, 'dc-black-history-sites-b10');
      assert.equal(row.release_id, 'rel_seed_001');
    }
  }
});

test('incrementalPublishProvenancePatch records publish metadata', () => {
  const patch = incrementalPublishProvenancePatch('dc-black-history-sites-b10');
  assert.equal(patch.publishedReleaseEntityId, 'dc-black-history-sites-b10');
  assert.ok(typeof patch.incremental_publish === 'string');
});

test('parseCanonicalStatusSnapshot maps bb_canonical row fields', () => {
  const snapshot = parseCanonicalStatusSnapshot({
    entity_id: 'ent-1',
    living_status: 'deceased',
    status_history: [],
    kind_detail: {},
  });
  assert.equal(snapshot?.livingStatus, 'deceased');
});

test('buildArtifactsForEntry publishes canonical deceased even when personReview says living', () => {
  const reviewed = baseRow({
    kind: 'person',
    summary:
      'A'.repeat(120) +
      ' A community leader who was assassinated in 1968 during the struggle for civil rights in Washington, DC.',
    payload: {
      personReview: {
        approved: true,
        approvedBy: 'operator',
        approvedAt: '2026-07-28T00:00:00.000Z',
        basis: 'deceased historical figure',
        livingStatus: 'living',
      },
    },
  });
  const gate = gateLandscapePublishCandidate({
    row: reviewed,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    canonicalStatus: { livingStatus: 'deceased' },
  });
  assert.equal(gate.eligible, true);
  if (!gate.eligible) return;
  const built = buildArtifactsForEntry({
    entry: gate.entry,
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
    canonicalStatus: { livingStatus: 'deceased' },
  });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal((built.entityRow.projection as { status?: string }).status, 'deceased');
});

test('toReleaseEntityRow normalizes empty related to array', () => {
  const result = gateLandscapePublishCandidate({
    row: baseRow(),
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  const build = buildReleaseEntityArtifacts(result.entry, {
    releaseId: 'rel_seed_001',
    generatedAt: '2026-07-22T00:00:00.000Z',
  });
  assert.equal(build.ok, true);
  if (!build.ok) return;
  const row = toReleaseEntityRow(build.projection);
  assert.ok(Array.isArray(row.related));
  assert.deepEqual(row.related, []);
});

test('canonicalUpsertParamsFromLandscape maps personReview livingStatus', () => {
  const params = canonicalUpsertParamsFromLandscape(
    baseRow({
      kind: 'person',
      payload: {
        personReview: {
          approved: true,
          approvedBy: 'operator',
          approvedAt: '2026-07-28T00:00:00.000Z',
          basis: 'deceased historical figure',
          livingStatus: 'deceased',
        },
      },
    }),
    'dc-black-history-sites-b10',
  );
  assert.equal(params.livingStatus, 'deceased');
  assert.equal(params.kind, 'person');
});
