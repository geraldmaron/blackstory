/**
 * Focused Firestore emulator seed scenarios for `@repo/api-public` live-read integration tests.
 * Demo-repo / emulator only — never import from production runtime code.
 */
import type { PublicActiveReleaseDoc, PublicEntityProjectionDoc } from '../src/firestore/types.js';
import {
  seedPublicEntity,
  seedPublicSchoolEntity,
  type SeedDocument,
} from './firestore-seed.js';

export type ApiPublicEmulatorScenario = {
  readonly releaseId: string;
  readonly documents: readonly SeedDocument[];
};

const MANIFEST_HASH = 'c'.repeat(64);
const ACTIVATED_AT = '2026-07-20T12:00:00.000Z';

export const API_PUBLIC_EMULATOR_RELEASE = {
  indexSearch: 'rel_api_public_index_001',
  fallbackSearch: 'rel_api_public_fallback_001',
  enumeration: 'rel_api_public_t3_001',
  fallbackBound: 'rel_api_public_bound_001',
} as const;

function activeRelease(releaseId: string): PublicActiveReleaseDoc {
  return {
    releaseId,
    activatedAt: ACTIVATED_AT,
    searchIndexVersion: `search_${releaseId}`,
    manifestHash: MANIFEST_HASH,
  };
}

function withRelease(
  projection: PublicEntityProjectionDoc,
  releaseId: string,
): PublicEntityProjectionDoc {
  return { ...projection, releaseId };
}

function searchIndexFromProjection(projection: PublicEntityProjectionDoc): Record<string, unknown> {
  return {
    id: projection.id,
    releaseId: projection.releaseId,
    kind: projection.kind,
    displayName: projection.displayName,
    nameLower: projection.nameLower,
    aliases: [],
    ...(projection.summary !== undefined ? { summary: projection.summary } : {}),
    topicTags: projection.topicTags ?? [],
    eraBuckets: projection.eraBuckets ?? [],
    notabilityBasis: [
      { criterion: 'community_landmark', note: 'Emulator api-public fixture.', evidenceIds: [] },
    ],
    notabilityLabels: ['Emulator fixture for api-public integration tests.'],
    recordMaturity: 'projection_stub',
    researchCoverage: 'minimal',
    relatedCount: 0,
    claimCount: projection.claimIds?.length ?? 0,
  };
}

/** Index-backed search: active release pointer + `publicSearchIndex` rows + entity projections. */
export function buildIndexBackedSearchScenario(): ApiPublicEmulatorScenario {
  const releaseId = API_PUBLIC_EMULATOR_RELEASE.indexSearch;
  const church = withRelease(seedPublicEntity, releaseId);
  const school = withRelease(seedPublicSchoolEntity, releaseId);

  return {
    releaseId,
    documents: [
      { path: 'publicMeta/activeRelease', data: activeRelease(releaseId) },
      {
        path: `publicReleases/${releaseId}/entities/${church.id}`,
        data: church as unknown as Record<string, unknown>,
      },
      {
        path: `publicReleases/${releaseId}/entities/${school.id}`,
        data: school as unknown as Record<string, unknown>,
      },
      {
        path: `publicSearchIndex/${church.id}`,
        data: searchIndexFromProjection(church),
      },
      {
        path: `publicSearchIndex/${school.id}`,
        data: searchIndexFromProjection(school),
      },
    ],
  };
}

/** Missing-index fallback: active release + entity projections only (no `publicSearchIndex`). */
export function buildFallbackSearchScenario(): ApiPublicEmulatorScenario {
  const releaseId = API_PUBLIC_EMULATOR_RELEASE.fallbackSearch;
  const church = withRelease(seedPublicEntity, releaseId);

  return {
    releaseId,
    documents: [
      { path: 'publicMeta/activeRelease', data: activeRelease(releaseId) },
      {
        path: `publicReleases/${releaseId}/entities/${church.id}`,
        data: church as unknown as Record<string, unknown>,
      },
    ],
  };
}

/** T3: published school, unsupported-kind person projection (unpublished at wire layer), no nonexistent doc. */
export function buildEnumerationScenario(): ApiPublicEmulatorScenario {
  const releaseId = API_PUBLIC_EMULATOR_RELEASE.enumeration;
  const school = withRelease(seedPublicSchoolEntity, releaseId);
  const unpublishedPerson: PublicEntityProjectionDoc = {
    id: 'ent_unpublished_person_001',
    releaseId,
    kind: 'person',
    displayName: 'Fixture Test Person',
    nameLower: 'fixture test person',
    summary:
      'Synthetic fixture person for T3 enumeration tests — kind is out of v1 API scope so the ' +
      'handler cannot distinguish this from a nonexistent id.',
    claimIds: [],
    topicTags: ['fixture'],
  };

  return {
    releaseId,
    documents: [
      { path: 'publicMeta/activeRelease', data: activeRelease(releaseId) },
      {
        path: `publicReleases/${releaseId}/entities/${school.id}`,
        data: school as unknown as Record<string, unknown>,
      },
      {
        path: `publicReleases/${releaseId}/entities/${unpublishedPerson.id}`,
        data: unpublishedPerson as unknown as Record<string, unknown>,
      },
    ],
  };
}

/** Minimum valid public projection summary length (see `publicEntityProjectionSchema`). */
const BOUND_FIXTURE_SUMMARY =
  'Emulator fallback bound-scan fixture place with a historically documented summary long enough to ' +
  'pass public projection validation for live Firestore integration tests in api-public.';

/** Fallback bound: release with more than MAX_LIVE_SEARCH_SCAN entity projections, no index. */
export function buildFallbackBoundScenario(entityCount: number): ApiPublicEmulatorScenario {
  const releaseId = API_PUBLIC_EMULATOR_RELEASE.fallbackBound;
  const documents: SeedDocument[] = [
    { path: 'publicMeta/activeRelease', data: activeRelease(releaseId) },
  ];

  for (let i = 0; i < entityCount; i += 1) {
    const id = `ent_bound_${String(i).padStart(4, '0')}`;
    const projection: PublicEntityProjectionDoc = {
      id,
      releaseId,
      kind: 'place',
      displayName: `Bound scan fixture ${i}`,
      nameLower: `bound scan fixture ${i}`,
      summary: BOUND_FIXTURE_SUMMARY,
      location: seedPublicEntity.location,
      claimIds: [],
      topicTags: ['fixture'],
    };
    documents.push({
      path: `publicReleases/${releaseId}/entities/${id}`,
      data: projection as unknown as Record<string, unknown>,
    });
  }

  return { releaseId, documents };
}
