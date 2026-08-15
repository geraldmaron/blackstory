/**
 * Postgres/pgvector-backed storage for entity embeddings replaces the Firestore-backed
 * `createAdminVectorIndexStore` (`vector-store.ts`) after the Postgres cutover (ADR-020).
 *
 * Targets `bb_canonical.entity_embeddings` (entity_id text pk, kind/state/era_bucket text,
 * embedding vector, dims int, model text, source_text_hash text, updated_at timestamptz), which
 * already exists in the `blackstory-app` Supabase project with an HNSW `vector_cosine_ops` index.
 * `1 - (embedding <=> query)` converts pgvector's cosine DISTANCE (0 = identical) into the same
 * "higher = closer" DOT_PRODUCT-on-unit-vectors convention `vector-store.ts` and
 * `vector-search-guardrails.ts`'s `distanceThreshold` already assume (constants.ts: "DOT_PRODUCT
 * is equivalent to cosine similarity for unit-normalized vectors") so nothing downstream of this
 * module needs to change semantics.
 *
 * The connection itself is injected as a plain query function (matching the DI style already
 * used for `EmbeddingProvider`/`VectorIndexStore`) so this module has no direct `pg` dependency
 * and callers can pass either a read-only pool (the live API) or a write-capable ops pool (the
 * backfill CLI).
 */
import { PLATFORM_MAX_NEIGHBORS } from './constants.js';
import type { EmbeddingVector } from './vector-math.js';
import type { EntityVectorFilters } from './text.js';
import type { EntityEmbeddingDoc, VectorIndexStore, VectorQueryMatch } from './vector-store.js';

export type PostgresQueryExecutor = <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: readonly unknown[],
) => Promise<readonly T[]>;

const ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/;

function assertSafeEntityId(entityId: string): void {
  if (!ENTITY_ID_PATTERN.test(entityId)) {
    throw new Error(`Entity id is not a safe identifier: ${entityId}`);
  }
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('findNearest limit must be a positive integer');
  }
  return Math.min(limit, PLATFORM_MAX_NEIGHBORS);
}

/** `pgvector` literal input format: `[v1,v2,...]`, cast to `::vector` at the call site. */
function toVectorLiteral(vector: EmbeddingVector): string {
  return `[${Array.from(vector, (value) => (Number.isFinite(value) ? value : 0)).join(',')}]`;
}

export function createPostgresVectorIndexStore(query: PostgresQueryExecutor): VectorIndexStore {
  return {
    async writeEmbedding(doc: EntityEmbeddingDoc): Promise<void> {
      assertSafeEntityId(doc.entityId);
      await query(
        `INSERT INTO bb_canonical.entity_embeddings
           (entity_id, kind, state, era_bucket, embedding, dims, model, source_text_hash, updated_at)
         VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9)
         ON CONFLICT (entity_id) DO UPDATE SET
           kind = EXCLUDED.kind,
           state = EXCLUDED.state,
           era_bucket = EXCLUDED.era_bucket,
           embedding = EXCLUDED.embedding,
           dims = EXCLUDED.dims,
           model = EXCLUDED.model,
           source_text_hash = EXCLUDED.source_text_hash,
           updated_at = EXCLUDED.updated_at`,
        [
          doc.entityId,
          doc.kind,
          doc.state ?? null,
          doc.eraBucket ?? null,
          toVectorLiteral(doc.vector),
          doc.dims,
          doc.model,
          doc.sourceTextHash,
          doc.updatedAt,
        ],
      );
    },

    async deleteEmbedding(entityId: string): Promise<void> {
      assertSafeEntityId(entityId);
      await query('DELETE FROM bb_canonical.entity_embeddings WHERE entity_id = $1', [entityId]);
    },

    async findNearest(input): Promise<readonly VectorQueryMatch[]> {
      const limit = clampLimit(input.limit);
      const conditions: string[] = [];
      const params: unknown[] = [toVectorLiteral(input.queryVector)];

      if (input.kind) {
        params.push(input.kind);
        conditions.push(`kind = $${params.length}`);
      }
      if (input.state) {
        params.push(input.state);
        conditions.push(`state = $${params.length}`);
      }
      if (input.eraBucket) {
        params.push(input.eraBucket);
        conditions.push(`era_bucket = $${params.length}`);
      }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit);
      const limitIndex = params.length;

      let thresholdClause = '';
      if (input.distanceThreshold !== undefined) {
        params.push(input.distanceThreshold);
        thresholdClause = `WHERE distance >= $${params.length}`;
      }

      const rows = await query<{
        readonly entity_id: string;
        readonly kind: string;
        readonly state: string | null;
        readonly era_bucket: string | null;
        readonly distance: number | string;
      }>(
        `SELECT entity_id, kind, state, era_bucket, distance FROM (
           SELECT entity_id, kind, state, era_bucket,
                  1 - (embedding <=> $1::vector) AS distance
           FROM bb_canonical.entity_embeddings
           ${whereClause}
           ORDER BY embedding <=> $1::vector ASC
           LIMIT $${limitIndex}
         ) ranked
         ${thresholdClause}
         ORDER BY distance DESC`,
        params,
      );

      return rows.map((row): VectorQueryMatch => ({
        entityId: row.entity_id,
        kind: row.kind as EntityVectorFilters['kind'],
        ...(row.state ? { state: row.state } : {}),
        ...(row.era_bucket ? { eraBucket: row.era_bucket } : {}),
        distance: typeof row.distance === 'number' ? row.distance : Number(row.distance),
      }));
    },
  };
}
