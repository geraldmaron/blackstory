
/**
 * Tests for the entity-ontology Zod mirrors: entityKindSchema's 12th `movement` kind,
 * canonicalEntitySchema's statusHistory/notabilityBasis/sensitivity/movement additions, and the
 * standing-policy hard rule that publicEntityProjectionSchema's non-numeric additions
 * (status/eraBuckets/notabilityLabels/sensitivityClass) never carry a numeric score.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalEntitySchema,
  entityKindSchema,
  publicEntityProjectionSchema,
  publicSearchIndexSchema,
  schoolFieldsSchema,
} from './types.js';

const NOW = '2026-07-17T00:00:00.000Z';

test('entityKindSchema accepts the 12th movement kind', () => {
  assert.equal(entityKindSchema.parse('movement'), 'movement');
});

test('schoolFieldsSchema exposes `milestones`, not the old `statusHistory` name', () => {
  const parsed = schoolFieldsSchema.parse({
    names: [],
    campuses: [],
    milestones: [{ status: 'opened', at: '1868' }],
  });
  assert.equal(parsed.milestones[0]?.status, 'opened');
  assert.ok(!('statusHistory' in parsed));
});

test('canonicalEntitySchema parses a law entity with statusHistory and notabilityBasis', () => {
  const parsed = canonicalEntitySchema.parse({
    id: 'ent-law-1',
    kind: 'law',
    displayName: 'Example Statute',
    statusHistory: [
      { status: 'in_force', validFrom: '1964', datePrecision: 'year', basisClaimIds: ['claim-1'] },
    ],
    notabilityBasis: [
      { criterion: 'court_precedent', note: 'Landmark ruling.', evidenceIds: ['ev-1'] },
    ],
    sensitivity: [
      { class: 'contested_legacy', note: 'Contested provisions.', basisClaimIds: ['claim-2'] },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(parsed.statusHistory?.[0]?.status, 'in_force');
  assert.equal(parsed.notabilityBasis?.[0]?.criterion, 'court_precedent');
  assert.equal(parsed.sensitivity?.[0]?.class, 'contested_legacy');
});

test('canonicalEntitySchema parses a movement entity with its own field bag', () => {
  const parsed = canonicalEntitySchema.parse({
    id: 'ent-movement-1',
    kind: 'movement',
    displayName: 'Civil Rights Movement',
    movement: {
      startYear: 1954,
      endYear: 1968,
      keyOrganizationIds: ['ent-org-sclc'],
      keyPersonIds: ['ent-person-mlk'],
      regionJurisdictionIds: ['jurisdiction-us-south'],
      summary: 'A decades-long struggle for Black civil rights in the United States.',
    },
    statusHistory: [
      { status: 'historic', validFrom: '1968', datePrecision: 'year', basisClaimIds: [] },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(parsed.movement?.endYear, 1968);
  assert.equal(parsed.statusHistory?.[0]?.status, 'historic');
});

function assertNoNumericLeaf(value: unknown, path = '$'): void {
  if (typeof value === 'number') {
    throw new Error(`Numeric value found in public payload at ${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNumericLeaf(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoNumericLeaf(entry, `${path}.${key}`);
    }
  }
}

test('publicEntityProjectionSchema BB-090 additions never carry a numeric score', () => {
  const parsed = publicEntityProjectionSchema.parse({
    id: 'ent-law-1',
    releaseId: 'rel-1',
    kind: 'law',
    displayName: 'Example Statute',
    nameLower: 'example statute',
    summary:
      'A documented statute in the public learning index with published provenance and ' +
      'accepted claims suitable for civic education and research.',
    claimIds: ['claim-1'],
    status: 'in_force',
    eraBuckets: ['1960s', '1970s'],
    notabilityLabels: ['Set binding precedent affecting civil rights.'],
    sensitivityClass: 'contested_legacy',
  });

  assertNoNumericLeaf({
    status: parsed.status,
    eraBuckets: parsed.eraBuckets,
    notabilityLabels: parsed.notabilityLabels,
    sensitivityClass: parsed.sensitivityClass,
  });
});

test('publicEntityProjectionSchema rejects numeric values for every BB-090 addition by construction', () => {
  const base = {
    id: 'ent-law-1',
    releaseId: 'rel-1',
    kind: 'law' as const,
    displayName: 'Example Statute',
    nameLower: 'example statute',
    summary:
      'A documented statute in the public learning index with published provenance and ' +
      'accepted claims suitable for civic education and research.',
    claimIds: ['claim-1'],
  };

  assert.equal(publicEntityProjectionSchema.safeParse({ ...base, status: 42 }).success, false);
  assert.equal(
    publicEntityProjectionSchema.safeParse({ ...base, eraBuckets: [1960] }).success,
    false,
  );
  assert.equal(
    publicEntityProjectionSchema.safeParse({ ...base, notabilityLabels: [7] }).success,
    false,
  );
  assert.equal(
    publicEntityProjectionSchema.safeParse({ ...base, sensitivityClass: 1 }).success,
    false,
  );
});

const VALID_SEARCH_DOC = {
  id: 'ent-law-1',
  releaseId: 'rel-1',
  kind: 'law' as const,
  displayName: 'Example Statute',
  nameLower: 'example statute',
  aliases: ['the statute'],
  summary: 'A landmark civil-rights statute.',
  topicTags: ['civil_rights'],
  jurisdictionState: 'Alabama',
  status: 'in_force',
  eraBuckets: ['1960s'],
  notabilityBasis: [{ criterion: 'court_precedent', note: 'Landmark ruling.', evidenceIds: ['ev-1'] }],
  notabilityLabels: ['Set binding precedent affecting civil rights.'],
  sensitivityClass: 'contested_legacy' as const,
  recordMaturity: 'partial_enrichment',
  researchCoverage: 'substantial' as const,
  relatedCount: 4,
  claimCount: 2,
};

test('publicSearchIndexSchema (BB-049) round-trips a valid search index doc', () => {
  const parsed = publicSearchIndexSchema.parse(VALID_SEARCH_DOC);
  assert.equal(parsed.id, 'ent-law-1');
  assert.equal(parsed.releaseId, 'rel-1');
  assert.equal(parsed.nameLower, 'example statute');
  assert.equal(parsed.notabilityBasis[0]?.criterion, 'court_precedent');
  assert.equal(parsed.relatedCount, 4);
});

test('publicSearchIndexSchema exposes NO numeric field beyond the two internal-ranking counts', () => {
  const parsed = publicSearchIndexSchema.parse(VALID_SEARCH_DOC);
  const { relatedCount, claimCount, ...publicFacing } = parsed;
  // relatedCount/claimCount are the only permitted numerics (server-internal ranking inputs); the
  // rest of the doc must be free of numeric leaves by standing policy.
  assertNoNumericLeaf(publicFacing);
  assert.equal(typeof relatedCount, 'number');
  assert.equal(typeof claimCount, 'number');
});

test('publicSearchIndexSchema rejects a numeric score smuggled into a non-count field', () => {
  // Defense-in-depth: a stray relevanceScore-style number in any string field must fail parsing.
  assert.equal(publicSearchIndexSchema.safeParse({ ...VALID_SEARCH_DOC, status: 0.9 }).success, false);
  assert.equal(publicSearchIndexSchema.safeParse({ ...VALID_SEARCH_DOC, nameLower: 42 }).success, false);
  assert.equal(
    publicSearchIndexSchema.safeParse({ ...VALID_SEARCH_DOC, notabilityLabels: [7] }).success,
    false,
  );
  assert.equal(
    publicSearchIndexSchema.safeParse({ ...VALID_SEARCH_DOC, sensitivityClass: 3 }).success,
    false,
  );
});
