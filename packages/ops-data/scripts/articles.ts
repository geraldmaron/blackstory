/**
 * Article lifecycle CLI — the long-form /articles publication surface.
 *
 * Articles are canonical in reference.articles (Supabase) — the database is
 * the source of truth, not files in git. To edit, `pull` an article into a
 * local draft (JSON, gitignored), edit it, `validate`, `apply` it back, then
 * `promote` (which re-runs every gate against the DB row) and `project` into
 * published.release_articles for the active release. Mirrors the theme-impact
 * packet CLI (packages/ops-data/scripts/theme-packets.ts).
 *
 * Usage (repo root; DATABASE_URL required for every command except validate):
 *   node --conditions development --import tsx packages/ops-data/scripts/articles.ts \
 *     pull <articleId|slug ...>                # DB -> packages/ops-data/drafts/<slug>.article.json
 *   ... articles.ts validate <draft.json|module.ts ...>  # offline gates on a draft
 *   ... articles.ts apply <draft.json|module.ts ...>     # upsert at declared status
 *   ... articles.ts promote <articleId ...>    # gate the DB row + flip to published
 *   ... articles.ts project                    # published -> active release
 *   ... articles.ts audit                      # drift check: release vs reference
 *
 * All write commands run inside a transaction and honor DRY_RUN=1 (rollback).
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  articleAuthoringSchema,
  type ArticleAuthoring,
  type ArticleRow,
  UPSERT_SQL,
  REFERENCE_COLUMNS,
  upsertParams,
  rowToProjection,
  rowToProjectionAuthoring,
  contentHash,
  validateArticleOffline,
  verifyArticleReferences,
  gateDoiCitations,
  gateReferenceUrls,
  gateSeriesPositions,
  countProseWords,
  resolveActiveReleaseId,
} from './lib/article-lifecycle.js';

const USAGE = 'usage: articles.ts <pull|validate|apply|promote|project|audit> [args...]';

/** Authoring shape: the projection doc minus the release-assigned id, plus status. */
function isArticleLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { slug?: unknown }).slug === 'string' &&
    Array.isArray((value as { body?: unknown }).body)
  );
}

async function loadFixtureArticles(paths: readonly string[]): Promise<readonly ArticleAuthoring[]> {
  if (paths.length === 0) throw new Error('at least one fixture module path is required');
  const articles = new Map<string, ArticleAuthoring>();
  for (const path of paths) {
    const module: Record<string, unknown> = path.endsWith('.json')
      ? { draft: JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown }
      : await import(pathToFileURL(resolve(path)).href);
    let found = 0;
    for (const exported of Object.values(module)) {
      const candidates = Array.isArray(exported) ? exported : [exported];
      for (const candidate of candidates) {
        if (!isArticleLike(candidate)) continue;
        found += 1;
        const article = articleAuthoringSchema.parse(candidate);
        const prior = articles.get(article.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(article)) {
          throw new Error(`article ${article.id} defined twice with different content`);
        }
        articles.set(article.id, article);
      }
    }
    if (found === 0) {
      throw new Error(`${path}: no Article exports found (export an article object or an array)`);
    }
  }
  return [...articles.values()];
}

/**
 * Source-quality gate (consults the shared tier registry, not a parallel list — same
 * rule theme-packets.ts's gateSourceTiers enforces for packet observations): every
 * reference's url is classified into a trust tier. T4 (untrusted, unclassified) is a
 * hard error on published articles and a surfaced warning otherwise.
 */
type DbContext = {
  readonly pool: pg.Pool;
  readonly client: pg.PoolClient;
  readonly dryRun: boolean;
};

async function withDb<T>(run: (ctx: DbContext) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required for this command');
  const dryRun = process.env.DRY_RUN === '1';
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await client.query(`SET LOCAL statement_timeout = '60s'`);
    const value = await run({ pool, client, dryRun });
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function commandValidate(paths: readonly string[]): Promise<void> {
  const articles = await loadFixtureArticles(paths);
  for (const article of articles) validateArticleOffline(article);
  gateSeriesPositions(articles);

  // DB-binding gate: when DATABASE_URL is present, transitively resolve every
  // figure/stat/primaryDocument/timeline refId against its published packet's
  // rows (and mapInset entities against the release), so a validate that passes
  // with DB access proves the article's citations actually exist. Skipped when
  // offline (CI-safe); offline still runs schema + inline-citation integrity.
  let bound: 'db-verified' | 'offline-skipped' = 'offline-skipped';
  if (process.env.DATABASE_URL?.trim()) {
    await withDb(async ({ client }) => {
      for (const article of articles)
        if (article.status === 'published') await verifyArticleReferences(client, article);
    });
    bound = 'db-verified';
  }

  let doiChecked = false;
  if (process.env.CHECK_DOIS === '1') {
    for (const article of articles) await gateDoiCitations(article);
    doiChecked = true;
  }

  let urlsChecked = false;
  if (process.env.CHECK_URLS === '1') {
    for (const article of articles) await gateReferenceUrls(article);
    urlsChecked = true;
  }

  console.log(
    JSON.stringify(
      {
        command: 'validate',
        ok: true,
        bound,
        doiChecked,
        urlsChecked,
        articles: articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          kind: a.kind ?? 'chapter',
          status: a.status,
          blocks: a.body.length,
          references: a.references.length,
          proseWords: countProseWords(a),
        })),
      },
      null,
      2,
    ),
  );
}

async function commandApply(paths: readonly string[]): Promise<void> {
  const articles = await loadFixtureArticles(paths);
  for (const article of articles) validateArticleOffline(article);
  gateSeriesPositions(articles);

  const result = await withDb(async ({ client, dryRun }) => {
    const applied: { id: string; status: string }[] = [];
    for (const article of articles) {
      if (article.status === 'published') await verifyArticleReferences(client, article);
      const row = await client.query<{ id: string; status: string }>(
        UPSERT_SQL,
        upsertParams(article) as unknown[],
      );
      applied.push(row.rows[0]!);
    }
    return { applied, dryRun };
  });

  console.log(JSON.stringify({ command: 'apply', ...result }, null, 2));
}

const DRAFTS_DIR = resolve('packages/ops-data/drafts');

/**
 * DB -> local draft. Exports reference.articles rows (matched by id or slug)
 * as authoring JSON into packages/ops-data/drafts/, which is gitignored: drafts
 * are working copies for an edit session, never a second source of truth.
 */
async function commandPull(idsOrSlugs: readonly string[]): Promise<void> {
  if (idsOrSlugs.length === 0) throw new Error('at least one article id or slug is required');

  const result = await withDb(async ({ client }) => {
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.articles
       WHERE id = ANY($1::text[]) OR slug = ANY($1::text[])`,
      [[...idsOrSlugs]],
    );
    const matched = new Set(rows.rows.flatMap((row) => [row.id, row.slug]));
    const missing = idsOrSlugs.filter((key) => !matched.has(key));
    if (missing.length > 0) throw new Error(`articles not found: ${missing.join(', ')}`);

    mkdirSync(DRAFTS_DIR, { recursive: true });
    const pulled: { id: string; slug: string; status: string; path: string }[] = [];
    for (const row of rows.rows) {
      const authoring = articleAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: row.status,
      });
      const path = join(DRAFTS_DIR, `${row.slug}.article.json`);
      writeFileSync(path, `${JSON.stringify(authoring, null, 2)}\n`);
      pulled.push({ id: row.id, slug: row.slug, status: row.status, path });
    }
    return { pulled };
  });

  console.log(JSON.stringify({ command: 'pull', ...result }, null, 2));
}

async function commandPromote(articleIds: readonly string[]): Promise<void> {
  if (articleIds.length === 0) throw new Error('at least one article id is required');

  const result = await withDb(async ({ client, dryRun }) => {
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.articles WHERE id = ANY($1::text[])`,
      [[...articleIds]],
    );
    const foundIds = new Set(rows.rows.map((row) => row.id));
    const missing = articleIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new Error(`articles not found: ${missing.join(', ')}`);

    for (const row of rows.rows) {
      const authoring = articleAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: 'published',
      });
      validateArticleOffline(authoring);
      await verifyArticleReferences(client, authoring);
    }

    const promoted: string[] = [];
    for (const id of articleIds) {
      const updated = await client.query<{ id: string }>(
        `UPDATE reference.articles SET status = 'published', row_updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id],
      );
      promoted.push(updated.rows[0]!.id);
    }
    return { promoted, dryRun };
  });

  console.log(JSON.stringify({ command: 'promote', ...result }, null, 2));
}

/** Reference row -> authoring doc shape (no releaseId), for the promote gate. */
async function commandProject(): Promise<void> {
  const result = await withDb(async ({ client, dryRun }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.articles WHERE status = 'published' ORDER BY id`,
    );

    const projected: string[] = [];
    const unchanged: string[] = [];
    for (const row of rows.rows) {
      const authoring = articleAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: 'published',
      });
      validateArticleOffline(authoring);
      await verifyArticleReferences(client, authoring);
      const doc = rowToProjection(row, releaseId);
      const hash = contentHash(doc);
      const upserted = await client.query<{ article_id: string }>(
        `INSERT INTO published.release_articles (
           release_id, article_id, slug, theme_id, published_at, payload, content_hash
         ) VALUES ($1, $2, $3, $4, $5::date, $6::jsonb, $7)
         ON CONFLICT (release_id, article_id) DO UPDATE SET
           slug = EXCLUDED.slug,
           theme_id = EXCLUDED.theme_id,
           published_at = EXCLUDED.published_at,
           payload = EXCLUDED.payload,
           content_hash = EXCLUDED.content_hash
         WHERE published.release_articles.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         RETURNING article_id`,
        [
          releaseId,
          doc.id,
          doc.slug,
          doc.themeId ?? null,
          doc.publishedAt,
          JSON.stringify(doc),
          hash,
        ],
      );
      if (upserted.rows[0]) projected.push(doc.id);
      else unchanged.push(doc.id);
    }

    const stale = await client.query<{ article_id: string }>(
      `DELETE FROM published.release_articles
       WHERE release_id = $1 AND article_id <> ALL($2::text[])
       RETURNING article_id`,
      [releaseId, rows.rows.map((row) => row.id)],
    );

    return {
      releaseId,
      projected,
      unchanged,
      removedStale: stale.rows.map((row) => row.article_id),
      dryRun,
    };
  });

  console.log(JSON.stringify({ command: 'project', ...result }, null, 2));
}

async function commandAudit(): Promise<void> {
  const result = await withDb(async ({ client }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const referenceRows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.articles WHERE status = 'published'`,
    );
    const releaseRows = await client.query<{ article_id: string; content_hash: string }>(
      `SELECT article_id, content_hash FROM published.release_articles WHERE release_id = $1`,
      [releaseId],
    );
    const releaseHashById = new Map(
      releaseRows.rows.map((row) => [row.article_id, row.content_hash]),
    );

    const articles: { article_id: string; state: string }[] = [];
    for (const row of referenceRows.rows) {
      const releaseHash = releaseHashById.get(row.id);
      releaseHashById.delete(row.id);
      if (releaseHash === undefined) {
        articles.push({ article_id: row.id, state: 'published_not_projected' });
      } else if (releaseHash !== contentHash(rowToProjection(row, releaseId))) {
        articles.push({ article_id: row.id, state: 'drifted_since_projection' });
      } else {
        articles.push({ article_id: row.id, state: 'ok' });
      }
    }
    for (const articleId of releaseHashById.keys()) {
      articles.push({ article_id: articleId, state: 'in_release_only' });
    }
    return { releaseId, articles, issues: articles.filter((row) => row.state !== 'ok') };
  });
  console.log(JSON.stringify({ command: 'audit', ...result }, null, 2));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'pull':
      return commandPull(args);
    case 'validate':
      return commandValidate(args);
    case 'apply':
      return commandApply(args);
    case 'promote':
      return commandPromote(args);
    case 'project':
      return commandProject();
    case 'audit':
      return commandAudit();
    default:
      throw new Error(USAGE);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
