/**
 * Loads editorial catalog entries with embedding vectors from Postgres (bb_canonical + bb_public).
 * Read-only assembly for operator staging — does not publish or promote.
 */
import { getOpsPostgresPool } from '@repo/data-access';
import type { EditorialCatalogEntity } from './editorial-run.js';
import {
  EMBEDDING_DIMS,
  extractEmbeddingVector,
  mergeEditorialCatalogFromDocs,
  type EmbeddingVector,
} from './editorial-catalog.js';

export type LoadEditorialCatalogFromPostgresOptions = {
  readonly expectedDims?: number;
  readonly limit?: number;
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

/**
 * Joins entity_embeddings with search_index display names/aliases for editorial soft-match.
 */
export async function loadEditorialCatalogFromPostgres(
  options: LoadEditorialCatalogFromPostgresOptions = {},
): Promise<EditorialCatalogEntity[]> {
  const expectedDims = options.expectedDims ?? EMBEDDING_DIMS;
  const limit = Math.min(5_000, Math.max(1, options.limit ?? 2_000));
  const pool = getOpsPostgresPool(options.environment ?? process.env);

  const embeddingResult = await pool.query<{
    entity_id: string;
    embedding: unknown;
    dims: number | null;
  }>(
    `SELECT entity_id, embedding, dims
     FROM bb_canonical.entity_embeddings
     WHERE dims = $1 OR dims IS NULL
     ORDER BY updated_at DESC NULLS LAST
     LIMIT $2`,
    [expectedDims, limit],
  );

  const ids = embeddingResult.rows.map((row) => row.entity_id);
  const searchIndexById = new Map<string, { displayName?: string; aliases?: readonly string[] }>();
  if (ids.length > 0) {
    const searchResult = await pool.query<{
      entity_id: string | null;
      name: string | null;
      aliases: string[] | null;
    }>(
      `SELECT entity_id, name, aliases
       FROM bb_public.search_index
       WHERE entity_id = ANY($1::text[])`,
      [ids],
    );
    for (const row of searchResult.rows) {
      if (!row.entity_id) continue;
      searchIndexById.set(row.entity_id, {
        ...(row.name ? { displayName: row.name } : {}),
        ...(row.aliases && row.aliases.length > 0 ? { aliases: row.aliases } : {}),
      });
    }
  }

  const embeddings = embeddingResult.rows.map((row) => ({
    id: row.entity_id,
    embedding: extractEmbeddingVector(row.embedding) ?? row.embedding,
    ...(typeof row.dims === 'number' ? { dims: row.dims } : {}),
    ...(searchIndexById.get(row.entity_id)?.displayName
      ? { displayName: searchIndexById.get(row.entity_id)!.displayName }
      : {}),
    ...(searchIndexById.get(row.entity_id)?.aliases
      ? { aliases: searchIndexById.get(row.entity_id)!.aliases }
      : {}),
  }));

  return mergeEditorialCatalogFromDocs({
    embeddings,
    searchIndexById,
    expectedDims,
  });
}

export type { EmbeddingVector };
