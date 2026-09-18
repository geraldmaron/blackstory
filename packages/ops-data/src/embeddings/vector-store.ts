import { PLATFORM_MAX_NEIGHBORS } from './constants.js';
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
 * an HTTP query parameter, and the existing text-search `kind` filter (search-guardrails.ts)
 * is equally untyped at that boundary this stays consistent with that precedent rather than
 * adding enum validation the base search guardrail doesn't itself apply.
 */
export type VectorQueryInput = {
  readonly queryVector: EmbeddingVector;
  readonly kind?: string;
  readonly state?: string;
  readonly eraBucket?: string;
  /** Neighbor count callers (apps/api-public) must clamp this below the platform ceiling. */
  readonly limit: number;
  /** DOT_PRODUCT threshold: matches require similarity >= threshold (higher = closer). */
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
    throw new Error(`Entity id is not a safe entity identifier: ${entityId}`);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('findNearest limit must be a positive integer');
  }
  return Math.min(limit, PLATFORM_MAX_NEIGHBORS);
}

/**
 * In-memory vector search with bounded top-k results (equality pre-filters,
 * DOT_PRODUCT `distance >= threshold` note the direction is inverted vs COSINE/EUCLIDEAN,
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

      return filtered.slice(0, limit).map((entry): VectorQueryMatch => ({
        entityId: entry.doc.entityId,
        kind: entry.doc.kind,
        ...(entry.doc.state ? { state: entry.doc.state } : {}),
        ...(entry.doc.eraBucket ? { eraBucket: entry.doc.eraBucket } : {}),
        distance: entry.distance,
      }));
    },
  };
}
