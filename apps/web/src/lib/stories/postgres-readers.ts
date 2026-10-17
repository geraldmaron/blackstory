/**
 * Server-side Postgres readers for the active-release Story projection
 * (`published.release_stories`). The `payload` column carries the full story
 * document frozen at projection time by the ops `stories.ts project` step; the
 * envelope is validated here via the Zod schema and the rest is trusted as the
 * projection pipeline's output.
 */
import { publicStoryProjectionSchema, type PublicStoryProjectionDoc } from '@repo/schemas';
import { queryPostgres } from '../public-data/postgres-client';

const ACTIVE_RELEASE_JOIN = `
  JOIN published.active_release active
    ON active.id = 'active' AND active.release_id = stories.release_id`;

type ReleaseStoryRow = { readonly payload: unknown };

function mapRow(row: ReleaseStoryRow): PublicStoryProjectionDoc {
  return publicStoryProjectionSchema.parse(row.payload);
}

export async function listReleaseStories(): Promise<readonly PublicStoryProjectionDoc[]> {
  const rows = await queryPostgres<ReleaseStoryRow>(
    `SELECT stories.payload
     FROM published.release_stories stories
     ${ACTIVE_RELEASE_JOIN}
     ORDER BY stories.published_at DESC, stories.slug`,
  );
  return rows.map(mapRow);
}

export async function fetchReleaseStory(
  slug: string,
): Promise<PublicStoryProjectionDoc | undefined> {
  const rows = await queryPostgres<ReleaseStoryRow>(
    `SELECT stories.payload
     FROM published.release_stories stories
     ${ACTIVE_RELEASE_JOIN}
     WHERE stories.slug = $1
     LIMIT 1`,
    [slug],
  );
  const row = rows[0];
  return row ? mapRow(row) : undefined;
}
