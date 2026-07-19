/**
 * Test fixtures for the `/v1` API tests. Constructs already-redacted, contract-valid public
 * projections (the only kind that ever leave `apps/api-public`). Kept as a normal `.ts` module (not
 * a `.test.ts`) so it is typechecked by `tsc --noEmit`; it is inert at runtime outside tests.
 */
import type { EntityV1 } from '@repo/public-contracts/v1/entity';
import type { ReleasePointer } from './data-access.js';

export const SAMPLE_POINTER: ReleasePointer = {
  activeRelease: {
    releaseId: 'rel_2026_07_19_001',
    generatedAt: '2026-07-19T00:00:00.000Z',
    recordUpdatedAt: '2026-07-19T00:00:00.000Z',
  },
  searchIndexVersion: 'idx_2026_07_19_001',
  contentVersion: 'content_2026_07_19_001',
};

export function makeEntity(overrides: Partial<EntityV1> = {}): EntityV1 {
  return {
    id: 'ent_dunbar_school_001',
    kind: 'school',
    displayName: 'Dunbar High School',
    summary: 'The first public high school for Black students in the United States.',
    topicTags: ['education', 'reconstruction'],
    jurisdictionLabel: 'Washington, D.C.',
    locationPrecision: 'city',
    locationLabel: 'Washington, D.C.',
    relevanceExplanation: 'Nationally significant in the history of Black public education.',
    historicalContext: 'Founded 1870 during Reconstruction; a center of Black academic achievement.',
    recordMaturity: 'published',
    researchCoverage: 'substantial',
    eraBuckets: ['1870s', '1880s'],
    notabilityLabels: ['First of its kind'],
    sensitivityClass: 'none',
    claims: [],
    timeline: [],
    revision: {
      releaseId: 'rel_2026_07_19_001',
      generatedAt: '2026-07-19T00:00:00.000Z',
      recordUpdatedAt: '2026-07-19T00:00:00.000Z',
    },
    ...overrides,
  };
}
