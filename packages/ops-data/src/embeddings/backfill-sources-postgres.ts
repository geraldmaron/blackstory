/** Postgres sources and existing-content-hash lookup for bounded embedding backfills. */
import type { EntityKindDoc } from '../records/types.js';
import type { CanonicalEntitySource, ExistingEmbeddingHashLookup } from './backfill-cli.js';
import { parseStateCodeFromJurisdiction } from './backfill-sources.js';
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
  'invention',
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
  readonly jurisdiction_label: string | null;
};

/** Pages `published.release_entities` (active release) ordered by entity_id. Skips missing display_name. */
export function createPostgresCanonicalEntitySource(
  query: PostgresQueryExecutor,
  pageSize = PAGE_SIZE,
): CanonicalEntitySource {
  return {
    async listPage(cursor) {
      const rows = await query<ReleaseEntityRow>(
        `SELECT re.entity_id, re.display_name, re.kind, re.summary,
                re.projection->>'jurisdictionLabel' AS jurisdiction_label
         FROM published.release_entities re
         JOIN published.active_release ar ON ar.release_id = re.release_id
         WHERE re.entity_id > COALESCE($1, '')
         ORDER BY re.entity_id ASC
         LIMIT $2`,
        [cursor ?? null, pageSize],
      );

      const items: EntityEmbeddingInput[] = [];
      for (const row of rows) {
        const displayName = row.display_name?.trim();
        if (!displayName) continue;
        const placeLabel = row.jurisdiction_label?.trim() || undefined;
        const state = parseStateCodeFromJurisdiction(placeLabel);
        items.push({
          entityId: row.entity_id,
          entity: {
            kind: asEntityKind(row.kind),
            displayName,
            ...(row.summary?.trim() ? { summary: row.summary.trim() } : {}),
          },
          ...(state !== undefined || placeLabel !== undefined
            ? {
                location: {
                  ...(state !== undefined ? { state } : {}),
                  ...(placeLabel !== undefined ? { placeLabel } : {}),
                },
              }
            : {}),
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

/** Looks up the stored `source_text_hash` per entity from `canonical.entity_embeddings`. */
export function createPostgresExistingHashLookup(
  query: PostgresQueryExecutor,
): ExistingEmbeddingHashLookup {
  let cache: Map<string, string> | undefined;

  async function loadAll(): Promise<Map<string, string>> {
    if (!cache) {
      const rows = await query<{ readonly entity_id: string; readonly source_text_hash: string }>(
        'SELECT entity_id, source_text_hash FROM canonical.entity_embeddings',
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
