/**
 * Read-only check that published invention rows parse as public catalog docs.
 */
import pg from 'pg';
import { publicEntityProjectionSchema } from '../../schemas/src/public-projections.ts';
import { mapPostgresSearchIndexRow } from '../../schemas/src/search-index-row.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ...(ssl ? { ssl } : {}) });
  await client.connect();
  try {
    const entities = await client.query<{
      entity_id: string;
      kind: string;
      projection: unknown;
    }>(
      `SELECT re.entity_id, re.kind, re.projection
       FROM bb_public.release_entities re
       JOIN bb_public.active_release a ON re.release_id = a.release_id
       WHERE re.kind = 'invention'
       ORDER BY re.entity_id`,
    );
    const search = await client.query<{
      entity_id: string;
      kind: string;
      name: string;
      name_lower: string;
      aliases: string[] | null;
      topics: string[] | null;
      status: string | null;
      geohash: string | null;
      related_count: number;
      claim_count: number;
      facets: unknown;
      release_id: string;
      id: string;
    }>(
      `SELECT si.id, si.release_id, si.entity_id, si.name, si.name_lower, si.aliases, si.topics,
              si.kind, si.status, si.geohash, si.related_count, si.claim_count, si.facets
       FROM bb_public.search_index si
       JOIN bb_public.active_release a ON si.release_id = a.release_id
       WHERE si.kind = 'invention'
       ORDER BY si.entity_id`,
    );

    let entityParsed = 0;
    const entityFailed: string[] = [];
    for (const row of entities.rows) {
      if (publicEntityProjectionSchema.safeParse(row.projection).success) entityParsed += 1;
      else entityFailed.push(row.entity_id);
    }
    let searchParsed = 0;
    const searchFailed: string[] = [];
    for (const row of search.rows) {
      if (mapPostgresSearchIndexRow(row)) searchParsed += 1;
      else searchFailed.push(row.entity_id);
    }

    console.log(
      JSON.stringify({
        entityRows: entities.rows.length,
        entityParsed,
        entityFailed,
        searchRows: search.rows.length,
        searchParsed,
        searchFailed,
      }),
    );
    if (entities.rows.length === 0 || entityFailed.length > 0 || searchFailed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
