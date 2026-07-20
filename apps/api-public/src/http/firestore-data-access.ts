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
 * - The projection carries `claimIds` only, not full claim documents, so `claims`/`timeline` map to
 *   `[]` here; hydrating them would mean extra per-claim reads this pass does not add (a real,
 *   tracked gap — see `http/README.md`).
 * - `related` neighbor entries map straight from the projection's own `related` array (ids/types/
 *   direction/timespan only). `relatedNeighbors`/`continueLearning` (denormalized neighbor display
 *   fields) are deliberately NOT hydrated here: doing so would require reading every related
 *   entity's own projection per request — an N+1 read amplification the bead's adversarial review
 *   explicitly flags as a case to defend against, not introduce.
 * - Fields the projection does not carry at all (`jurisdictionLabel`, `locationLabel`,
 *   `relevanceExplanation`, `historicalContext` fallback, `recordMaturity`, `researchCoverage`) get
 *   the same honest "projection stub" placeholders `apps/web`'s
 *   `map-projection.ts` uses for entities with no bundled seed match — never a fabricated value
 *   dressed up as curated content.
 */
import {
  firestorePaths,
  FIRESTORE_ROOT,
  getServerFirestore,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  type EnvironmentLike,
  type PublicEntityProjectionDoc,
} from '@repo/firebase';
import { ENTITY_KINDS, entityV1Schema, type EntityV1 } from '@repo/public-contracts/v1/entity';
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

function mapLocationPrecision(
  precision: string | undefined,
): EntityV1['locationPrecision'] {
  if (precision === 'neighborhood' || precision === 'campus' || precision === 'institution') {
    return precision;
  }
  return 'city';
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
    jurisdictionLabel: 'Unknown',
    locationPrecision: mapLocationPrecision(location?.precision),
    locationLabel: projection.displayName,
    relevanceExplanation:
      'This record is served from the live public release projection. Supporting claims and ' +
      'evidence panels may still be sparse until the full publication pipeline lands.',
    historicalContext:
      projection.historicalContext ??
      'Live projection scaffolding — historical framing expands as curated release content is published.',
    recordMaturity: 'projection_stub',
    researchCoverage: 'minimal',
    claims: [],
    timeline: [],
    revision: {
      releaseId: projection.releaseId,
      generatedAt: '',
      recordUpdatedAt: '',
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
