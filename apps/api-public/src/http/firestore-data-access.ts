/**
 * Live `@repo/firebase` Firestore bindings for `PublicDataAccess` (MOB-004 live wiring).
 *
 * `createFirestoreDataAccessReaders` implements `./data-access.ts`'s `FirestoreDataAccessReaders`
 * seam against real `publicMeta/activeRelease` + `publicReleases/{releaseId}/entities` documents,
 * using the exact same `@repo/firebase` reads `apps/web/src/lib/public-data/firestore-readers.ts`
 * already uses (same collection paths, same schemas) so both surfaces read one live-data contract.
 *
 * The Firestore client itself is injectable (`FirestoreClientLike`, a narrow duck-typed subset of
 * `firebase-admin`'s `Firestore`) rather than hard-imported, so this module — and every reader it
 * produces — stays unit-testable with a hand-rolled fake, with no live emulator required for the
 * mapping/gating tests in `./firestore-data-access.test.ts`. The default (`getServerFirestore`) is
 * only invoked when no fake is injected, which is what `./compose.ts` does in production.
 *
 * Mapping a `PublicEntityProjectionDoc` onto the public-contracts `EntityV1` DTO is lossy by
 * design, honestly:
 * - `kind` is narrower on `EntityV1` (`place|school|event|institution`, ADR-021 §3 — no
 *   precise living-person geography in this v1 surface) than the canonical entity kind space.
 *   A projection whose `kind` falls outside that set maps to `undefined`, which — same as an
 *   unpublished or nonexistent id — the handler cannot distinguish from a 404 (T3).
 * - Inline `claims` on the projection map through when present; bootstrap-window stubs that carry
 *   only `claimIds` still emit `claims: []`. No per-claim Firestore reads are added here.
 * - `timeline` is not carried on the projection — always `[]` until a release-builder field
 *   exists (same as `apps/web`'s `map-projection.ts`).
 * - `related` neighbor entries map straight from the projection's own `related` array (ids/types/
 *   direction/timespan only). `relatedNeighbors`/`continueLearning` (denormalized neighbor display
 *   fields) are deliberately NOT hydrated here: doing so would require reading every related
 *   entity's own projection per request — an N+1 read amplification the bead's adversarial review
 *   explicitly flags as a case to defend against, not introduce.
 * - Fields absent on bootstrap-window stubs (`jurisdictionLabel`, `locationLabel`,
 *   `researchCoverage`, revision timestamps) fall back to the same honest placeholders
 *   `apps/web`'s `map-projection.ts` uses — never fabricated curated content.
 */
import {
  firestorePaths,
  FIRESTORE_ROOT,
  getServerFirestore,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  type EnvironmentLike,
  type PublicClaimProjectionDoc,
  type PublicEntityProjectionDoc,
} from '@repo/firebase';
import { findUsStateForPoint } from '@repo/domain';
import { ENTITY_KINDS, entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
import type { ClaimV1 } from '@repo/public-contracts/v1/claim';
import type { CanonicalSearchQuery } from '@repo/security';
import type { FirestoreDataAccessReaders, ReleasePointer, SearchPage } from './data-access.js';
import { searchOverEntities } from './data-access.js';

// ---------------------------------------------------------------------------
// Injectable Firestore client seam (structurally compatible with firebase-admin's Firestore)
// ---------------------------------------------------------------------------

export type FirestoreDocSnapshotLike = {
  readonly exists: boolean;
  data(): unknown;
};

export type FirestoreCollectionRefLike = {
  limit(count: number): { get(): Promise<{ readonly docs: readonly FirestoreDocSnapshotLike[] }> };
};

export type FirestoreClientLike = {
  doc(path: string): { get(): Promise<FirestoreDocSnapshotLike> };
  collection(path: string): FirestoreCollectionRefLike;
};

export type CreateFirestoreDataAccessReadersOptions = {
  readonly environment?: EnvironmentLike;
  /** Injected for tests; defaults to the real `@repo/firebase` server Firestore client. */
  readonly firestore?: FirestoreClientLike;
};

/** Bounds every live search list read (MOB-004: "bound every query"). This is a scan over the
 * release's entities collection, not an index-backed search — a documented, tracked scale gap
 * (repo-rw1p load/cost report), not a silent one. */
export const MAX_LIVE_SEARCH_SCAN = 500;

const SUPPORTED_KINDS = new Set<string>(ENTITY_KINDS);

/** View claims render a nominal score alongside the level chip; the projection carries only the
 * level (non-numeric public-payload policy), so the score here is the level's register midpoint —
 * a display value, never a stored ranking. Matches `apps/web`'s `NOMINAL_CONFIDENCE_SCORE`. */
const NOMINAL_CONFIDENCE_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 0.85,
  medium: 0.6,
  low: 0.4,
};

function mapLocationPrecision(
  precision: string | undefined,
): EntityV1['locationPrecision'] {
  if (precision === 'neighborhood' || precision === 'campus' || precision === 'institution') {
    return precision;
  }
  return 'city';
}

function isDisplayableJurisdictionLabel(label: string | undefined): boolean {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length === 0) return false;
  return !/^unknown$/iu.test(trimmed);
}

function resolveJurisdictionLabel(projection: PublicEntityProjectionDoc): string {
  const explicit = projection.jurisdictionLabel?.trim();
  if (explicit && isDisplayableJurisdictionLabel(explicit)) {
    return explicit;
  }
  const lat = projection.location?.lat;
  const lng = projection.location?.lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    const state = findUsStateForPoint(lat, lng);
    if (state) return state.name;
  }
  return 'Unknown';
}

function mapClaims(claims: readonly PublicClaimProjectionDoc[] | undefined): ClaimV1[] {
  return (claims ?? []).map((claim) => ({
    id: claim.id,
    predicate: claim.predicate,
    object: claim.object,
    confidenceScore: NOMINAL_CONFIDENCE_SCORE[claim.confidenceLevel],
    confidenceLevel: claim.confidenceLevel,
    citation: {
      source: claim.citationSource,
      label: claim.citationLabel,
      ...(claim.citationHref !== undefined ? { href: claim.citationHref } : {}),
    },
    ...(claim.independentLineageCount !== undefined
      ? { independentLineageCount: claim.independentLineageCount }
      : {}),
  }));
}

/** Maps one Firestore public entity projection onto the `EntityV1` wire DTO, or `undefined` when
 * the projection's kind is out of the v1 API's scope or the mapped result fails contract
 * validation (never thrown — both collapse to the same "not available" signal callers already
 * treat identically to unpublished/nonexistent per T3). Exported for direct unit testing. */
export function mapProjectionToEntityV1(projection: PublicEntityProjectionDoc): EntityV1 | undefined {
  if (!SUPPORTED_KINDS.has(projection.kind)) {
    return undefined;
  }

  const location = projection.location;
  const claims = mapClaims(projection.claims);
  const geoAnchor =
    location && location.matchMethod
      ? {
          lat: location.lat,
          lng: location.lng,
          geohash: location.geohash,
          matchMethod: location.matchMethod,
        }
      : undefined;

  const candidate: EntityV1 = {
    id: projection.id,
    kind: projection.kind as EntityV1['kind'],
    displayName: projection.displayName,
    summary: projection.summary,
    topicTags: projection.topicTags ?? [],
    jurisdictionLabel: resolveJurisdictionLabel(projection),
    locationPrecision: mapLocationPrecision(location?.precision),
    locationLabel: projection.locationLabel ?? projection.displayName,
    relevanceExplanation:
      claims.length > 0
        ? 'Included as a documented site in the active public release; each accepted claim below cites its source.'
        : 'This record is served from the live public release projection. Supporting claims and ' +
          'evidence panels may still be sparse until the full publication pipeline lands.',
    historicalContext:
      projection.historicalContext ??
      'Live projection scaffolding — historical framing expands as curated release content is published.',
    recordMaturity: claims.length > 0 ? 'partial_enrichment' : 'projection_stub',
    researchCoverage:
      projection.researchCoverage ?? (claims.length >= 2 ? 'partial' : 'minimal'),
    claims,
    timeline: [],
    revision: {
      releaseId: projection.releaseId,
      generatedAt: projection.generatedAt ?? '',
      recordUpdatedAt: projection.recordUpdatedAt ?? '',
    },
    ...(projection.status !== undefined ? { status: projection.status } : {}),
    ...(projection.eraBuckets !== undefined ? { eraBuckets: [...projection.eraBuckets] } : {}),
    ...(projection.notabilityLabels !== undefined
      ? { notabilityLabels: [...projection.notabilityLabels] }
      : {}),
    ...(projection.sensitivityClass !== undefined
      ? { sensitivityClass: projection.sensitivityClass }
      : {}),
    ...(projection.extendedNarrative !== undefined
      ? { extendedNarrative: projection.extendedNarrative }
      : {}),
    ...(projection.primaryImage !== undefined ? { primaryImage: projection.primaryImage } : {}),
    ...(geoAnchor !== undefined ? { geoAnchor } : {}),
    ...(projection.related !== undefined
      ? {
          related: projection.related.map((entry) => ({
            id: entry.id,
            type: entry.type,
            direction: entry.direction,
            ...(entry.timespan !== undefined ? { timespan: entry.timespan } : {}),
          })),
        }
      : {}),
  };

  const parsed = entityV1Schema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function mapActiveReleaseToPointer(data: unknown): ReleasePointer | undefined {
  const parsed = publicActiveReleaseSchema.safeParse(data);
  if (!parsed.success) return undefined;
  return {
    activeRelease: {
      releaseId: parsed.data.releaseId,
      generatedAt: parsed.data.activatedAt,
      recordUpdatedAt: parsed.data.activatedAt,
    },
    searchIndexVersion: parsed.data.searchIndexVersion,
  };
}

/**
 * Builds the live `FirestoreDataAccessReaders` (bound into a `PublicDataAccess` port via
 * `./data-access.ts`'s `createFirestorePublicDataAccess`). Never throws on a malformed/missing
 * document — every reader collapses an absent or invalid doc to `undefined` (or an empty search
 * page), matching the port's existing contract.
 */
export function createFirestoreDataAccessReaders(
  options: CreateFirestoreDataAccessReadersOptions = {},
): FirestoreDataAccessReaders {
  const firestore: FirestoreClientLike =
    options.firestore ?? getServerFirestore(options.environment ?? process.env);

  return {
    async readReleasePointer(): Promise<ReleasePointer | undefined> {
      const snap = await firestore.doc(firestorePaths.publicActiveRelease()).get();
      if (!snap.exists) return undefined;
      return mapActiveReleaseToPointer(snap.data());
    },

    async readEntity(releaseId, entityId): Promise<EntityV1 | undefined> {
      const snap = await firestore.doc(firestorePaths.publicEntity(releaseId, entityId)).get();
      if (!snap.exists) return undefined;
      const parsed = publicEntityProjectionSchema.safeParse(snap.data());
      if (!parsed.success) return undefined;
      return mapProjectionToEntityV1(parsed.data);
    },

    async readSearchPage(
      canonical: CanonicalSearchQuery,
      searchOptions: { readonly releaseId: string },
    ): Promise<SearchPage> {
      const snapshot = await firestore
        .collection(`${FIRESTORE_ROOT.publicReleases}/${searchOptions.releaseId}/entities`)
        .limit(MAX_LIVE_SEARCH_SCAN)
        .get();

      const entities: EntityV1[] = [];
      for (const doc of snapshot.docs) {
        const parsed = publicEntityProjectionSchema.safeParse(doc.data());
        if (!parsed.success) continue;
        const mapped = mapProjectionToEntityV1(parsed.data);
        if (mapped) entities.push(mapped);
      }

      return searchOverEntities(entities, canonical);
    },
  };
}
