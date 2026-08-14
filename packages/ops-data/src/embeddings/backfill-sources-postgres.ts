/**
 * Postgres entity source + hash lookup for the embedding backfill CLI, replacing the
 * Firestore-backed sources in `backfill-sources.ts` after the Postgres cutover (ADR-020) —
 * `canonicalEntities`/`publicSearchIndex` no longer exist (`docs/data/firebase-wind-down.md`).
 *
 * Reads `bb_public.release_entities` for the currently active release: the same public
 * projection (display_name, kind, summary) apps/api-public and apps/web already serve reads
 * from, so what gets embedded matches what a reader actually sees. `location` on this table is
 * lat/lng/geohash only (no state text), so unlike the old search-index source this one omits the
 * `state` pre-filter entirely rather than guess; `eraBucket` is likewise omitted (no kind-specific
 * year fields survive projection into this table). Both remain valid `undefined` inputs to
 * `deriveEntityFilters` (text.ts) — filtering on `kind` alone still works, and the endpoint's
 * `state`/`eraBucket` query params simply match nothing extra until a richer source is wired.
 */
import type { EntityKindDoc } from '../firestore/types.js';
import type { CanonicalEntitySource, ExistingEmbeddingHashLookup } from './backfill-cli.js';
import type { EntityEmbeddingInput } from './pipeline.js';

const PAGE_SIZE = 200;

const ENTITY_KINDS = new Set<string>([
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'other',
]);

function asEntityKind(kind: string | null | undefined): EntityKindDoc {
  return kind && ENTITY_KINDS.has(kind) ? (kind as EntityKindDoc) : 'other';
}

export type PostgresQueryExecutor = <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: readonly unknown[],
) => Promise<readonly T[]>;

type ReleaseEntityRow = {
  readonly entity_id: string;
  readonly display_name: string | null;
  readonly kind: string | null;
  readonly summary: string | null;
};

/** Pages `bb_public.release_entities` (active release) ordered by entity_id. Skips missing display_name. */
export function createPostgresCanonicalEntitySource(
  query: PostgresQueryExecutor,
  pageSize = PAGE_SIZE,
): CanonicalEntitySource {
  return {
    async listPage(cursor) {
      const rows = await query<ReleaseEntityRow>(
        `SELECT re.entity_id, re.display_name, re.kind, re.summary
         FROM bb_public.release_entities re
         JOIN bb_public.active_release ar ON ar.release_id = re.release_id
         WHERE re.entity_id > COALESCE($1, '')
         ORDER BY re.entity_id ASC
         LIMIT $2`,
        [cursor ?? null, pageSize],
      );

      const items: EntityEmbeddingInput[] = [];
      for (const row of rows) {
        const displayName = row.display_name?.trim();
        if (!displayName) continue;
        items.push({
          entityId: row.entity_id,
          entity: {
            kind: asEntityKind(row.kind),
            displayName,
            ...(row.summary?.trim() ? { summary: row.summary.trim() } : {}),
          },
        });
      }

      const lastRow = rows.at(-1);
      return {
        items,
        ...(lastRow && rows.length === pageSize ? { nextCursor: lastRow.entity_id } : {}),
      };
    },
  };
}

/** Looks up the stored `source_text_hash` per entity from `bb_canonical.entity_embeddings`. */
export function createPostgresExistingHashLookup(
  query: PostgresQueryExecutor,
): ExistingEmbeddingHashLookup {
  let cache: Map<string, string> | undefined;

  async function loadAll(): Promise<Map<string, string>> {
    if (!cache) {
      const rows = await query<{ readonly entity_id: string; readonly source_text_hash: string }>(
        'SELECT entity_id, source_text_hash FROM bb_canonical.entity_embeddings',
        [],
      );
      cache = new Map(rows.map((row) => [row.entity_id, row.source_text_hash]));
    }
    return cache;
  }

  return {
    async get(entityId: string): Promise<string | undefined> {
      const map = await loadAll();
      return map.get(entityId);
    },
  };
}
