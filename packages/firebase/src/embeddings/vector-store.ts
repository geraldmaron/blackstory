/**
 * Firestore-backed (and in-memory, for tests/dev) storage for entity embeddings (BB-071).
 *
 * Vectors live in a sibling collection (`entityEmbeddings`, one document per canonical entity),
 * not on the existing `publicEntityProjectionSchema` document — that schema lives in
 * ../firestore/types.ts, which this bead's file ownership does not permit editing beyond
 * additive barrel exports. A sibling collection also avoids re-embedding on every immutable
 * release: an entity's vector reflects its latest canonical text and is recomputed only when
 * that text changes (see pipeline.ts's sourceTextHash), independent of how many releases get
 * cut. `queryNearestEntities` callers are expected to cross-check matches against the currently
 * active release's projection docs before serving them (an entity can have a stale/orphaned
 * embedding if it was retracted after being embedded).
 *
 * Server-only: this module imports `firebase-admin/firestore` types only. Firestore KNN
 * (`findNearest`) is not supported by the client/web SDKs at all, so there is no parallel
 * client-side surface to accidentally expose.
 */
import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';
import {
  DISTANCE_MEASURE,
  ENTITY_EMBEDDINGS_COLLECTION,
  PLATFORM_MAX_NEIGHBORS,
  VECTOR_FIELD_NAME,
} from './constants.js';
import { dotProduct, type EmbeddingVector } from './vector-math.js';
import type { EntityVectorFilters } from './text.js';

export type EntityEmbeddingDoc = {
  readonly entityId: string;
  readonly kind: EntityVectorFilters['kind'];
  readonly state?: string;
  readonly eraBucket?: string;
  readonly vector: EmbeddingVector;
  readonly dims: number;
  readonly model: string;
  readonly sourceTextHash: string;
  readonly updatedAt: string;
};

/**
 * Query-side `kind` is a plain string (not the narrow EntityKindDoc enum): it originates from
 * an HTTP query parameter, and the existing BB-026 text-search `kind` filter (search-guardrails.ts)
 * is equally untyped at that boundary — this stays consistent with that precedent rather than
 * adding enum validation the base search guardrail doesn't itself apply.
 */
export type VectorQueryInput = {
  readonly queryVector: EmbeddingVector;
  readonly kind?: string;
  readonly state?: string;
  readonly eraBucket?: string;
  /** Neighbor count — callers (apps/api-public) must clamp this below the platform ceiling. */
  readonly limit: number;
  /** DOT_PRODUCT threshold: Firestore keeps matches where distance >= threshold (higher = closer). */
  readonly distanceThreshold?: number;
};

export type VectorQueryMatch = {
  readonly entityId: string;
  readonly kind: string;
  readonly state?: string;
  readonly eraBucket?: string;
  readonly distance: number;
};

export type VectorIndexStore = {
  writeEmbedding(doc: EntityEmbeddingDoc): Promise<void>;
  deleteEmbedding(entityId: string): Promise<void>;
  findNearest(input: VectorQueryInput): Promise<readonly VectorQueryMatch[]>;
};

function assertSafeEntityId(entityId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/.test(entityId)) {
    throw new Error(`Entity id is not a safe Firestore document id: ${entityId}`);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('findNearest limit must be a positive integer');
  }
  return Math.min(limit, PLATFORM_MAX_NEIGHBORS);
}

/**
 * Real Admin SDK-backed implementation. Uses `firestore.collection(...).where(...).findNearest(...)`
 * — the exact shape documented for the Node Admin SDK's native KNN support.
 */
export function createAdminVectorIndexStore(firestore: Firestore): VectorIndexStore {
  const collection = firestore.collection(ENTITY_EMBEDDINGS_COLLECTION);

  return {
    async writeEmbedding(doc) {
      assertSafeEntityId(doc.entityId);
      // Lazy import keeps this module loadable without firebase-admin/firestore's FieldValue
      // being resolved until an actual write happens (mirrors the rest of the package's style).
      const { FieldValue } = await import('firebase-admin/firestore');
      await collection.doc(doc.entityId).set({
        entityId: doc.entityId,
        kind: doc.kind,
        ...(doc.state ? { state: doc.state } : {}),
        ...(doc.eraBucket ? { eraBucket: doc.eraBucket } : {}),
        [VECTOR_FIELD_NAME]: FieldValue.vector(doc.vector as number[]),
        dims: doc.dims,
        model: doc.model,
        sourceTextHash: doc.sourceTextHash,
        updatedAt: doc.updatedAt,
      });
    },

    async deleteEmbedding(entityId) {
      assertSafeEntityId(entityId);
      await collection.doc(entityId).delete();
    },

    async findNearest(input) {
      const limit = clampLimit(input.limit);
      let query: Query<DocumentData> = collection;
      if (input.kind) query = query.where('kind', '==', input.kind);
      if (input.state) query = query.where('state', '==', input.state);
      if (input.eraBucket) query = query.where('eraBucket', '==', input.eraBucket);

      const vectorQuery = query.findNearest({
        vectorField: VECTOR_FIELD_NAME,
        queryVector: input.queryVector as number[],
        limit,
        distanceMeasure: DISTANCE_MEASURE,
        distanceResultField: 'distance',
        ...(input.distanceThreshold !== undefined
          ? { distanceThreshold: input.distanceThreshold }
          : {}),
      });

      const snapshot = await vectorQuery.get();
      return snapshot.docs.map((docSnapshot): VectorQueryMatch => {
        const data = docSnapshot.data() as Record<string, unknown>;
        return {
          entityId: docSnapshot.id,
          kind: data.kind as EntityVectorFilters['kind'],
          ...(typeof data.state === 'string' ? { state: data.state } : {}),
          ...(typeof data.eraBucket === 'string' ? { eraBucket: data.eraBucket } : {}),
          distance: typeof data.distance === 'number' ? data.distance : Number(data.distance),
        };
      });
    },
  };
}

/**
 * In-memory implementation replicating Firestore's KNN semantics exactly (equality pre-filters,
 * DOT_PRODUCT `distance >= threshold` — note the direction is inverted vs COSINE/EUCLIDEAN,
 * sort descending by distance, then limit). Useful for tests and for local dev without an
 * emulator; also gives the gold-corpus retrieval eval and near-duplicate tests a fast, dependency-free
 * substrate that behaves like the real thing.
 */
export function createInMemoryVectorIndexStore(): VectorIndexStore {
  const docs = new Map<string, EntityEmbeddingDoc>();

  return {
    async writeEmbedding(doc) {
      assertSafeEntityId(doc.entityId);
      docs.set(doc.entityId, doc);
    },

    async deleteEmbedding(entityId) {
      docs.delete(entityId);
    },

    async findNearest(input) {
      const limit = clampLimit(input.limit);
      const candidates = Array.from(docs.values()).filter((doc) => {
        if (input.kind && doc.kind !== input.kind) return false;
        if (input.state && doc.state !== input.state) return false;
        if (input.eraBucket && doc.eraBucket !== input.eraBucket) return false;
        return true;
      });

      const scored = candidates.map((doc) => ({
        doc,
        distance: dotProduct(input.queryVector, doc.vector),
      }));

      const filtered =
        input.distanceThreshold !== undefined
          ? scored.filter((entry) => entry.distance >= input.distanceThreshold!)
          : scored;

      filtered.sort((a, b) => b.distance - a.distance);

      return filtered.slice(0, limit).map(
        (entry): VectorQueryMatch => ({
          entityId: entry.doc.entityId,
          kind: entry.doc.kind,
          ...(entry.doc.state ? { state: entry.doc.state } : {}),
          ...(entry.doc.eraBucket ? { eraBucket: entry.doc.eraBucket } : {}),
          distance: entry.distance,
        }),
      );
    },
  };
}
