/**
 * Server-side Postgres readers for the active-release Article projection
 * (`bb_public.release_articles`). The `payload` column carries the full article
 * document frozen at projection time by the ops `articles.ts project` step; the
 * envelope is validated here via the Zod schema and the rest is trusted as the
 * projection pipeline's output.
 */
import { publicArticleProjectionSchema, type PublicArticleProjectionDoc } from '@repo/schemas';
import { queryPostgres } from '../public-data/postgres-client';

const ACTIVE_RELEASE_JOIN = `
  JOIN bb_public.active_release active
    ON active.id = 'active' AND active.release_id = articles.release_id`;

type ReleaseArticleRow = { readonly payload: unknown };

function mapRow(row: ReleaseArticleRow): PublicArticleProjectionDoc {
  return publicArticleProjectionSchema.parse(row.payload);
}

export async function listReleaseArticles(): Promise<readonly PublicArticleProjectionDoc[]> {
  const rows = await queryPostgres<ReleaseArticleRow>(
    `SELECT articles.payload
     FROM bb_public.release_articles articles
     ${ACTIVE_RELEASE_JOIN}
     ORDER BY articles.published_at DESC, articles.slug`,
  );
  return rows.map(mapRow);
}

export async function fetchReleaseArticle(
  slug: string,
): Promise<PublicArticleProjectionDoc | undefined> {
  const rows = await queryPostgres<ReleaseArticleRow>(
    `SELECT articles.payload
     FROM bb_public.release_articles articles
     ${ACTIVE_RELEASE_JOIN}
     WHERE articles.slug = $1
     LIMIT 1`,
    [slug],
  );
  const row = rows[0];
  return row ? mapRow(row) : undefined;
}
