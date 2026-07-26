/**
 * Article lifecycle CLI — the long-form /articles publication surface.
 *
 * Articles are authored as fixture modules, applied to bb_reference.articles at
 * any lifecycle status, promoted to published behind the publish gate, and
 * projected into bb_public.release_articles for the active release. Mirrors the
 * theme-impact packet CLI (packages/ops-data/scripts/theme-packets.ts).
 *
 * Usage (repo root; DATABASE_URL required for every command except validate):
 *   node --conditions development --import tsx packages/ops-data/scripts/articles.ts \
 *     validate packages/ops-data/fixtures/articles/buying-a-home.ts
 *   ... articles.ts apply <fixture.ts ...>     # upsert at declared status
 *   ... articles.ts promote <articleId ...>    # gate + flip to published
 *   ... articles.ts project                    # published -> active release
 *   ... articles.ts audit                      # drift check: release vs reference
 *
 * All write commands run inside a transaction and honor DRY_RUN=1 (rollback).
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  assertArticleCitationIntegrity,
  publicArticleProjectionSchema,
} from '@repo/schemas';
import { z } from 'zod';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const USAGE = 'usage: articles.ts <validate|apply|promote|project|audit> [args...]';

/** Authoring shape: the projection doc minus the release-assigned id, plus status. */
const articleAuthoringSchema = publicArticleProjectionSchema
  .omit({ releaseId: true })
  .extend({ status: z.enum(['draft', 'review', 'published']) });
type ArticleAuthoring = z.infer<typeof articleAuthoringSchema>;

const REFERENCED_PACKET_BLOCKS = new Set(['figure', 'stat', 'primaryDocument', 'timeline']);

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
    const module: Record<string, unknown> = await import(pathToFileURL(resolve(path)).href);
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

/** Offline gates: schema (via loader) + inline-citation integrity. */
function validateArticleOffline(article: ArticleAuthoring): void {
  assertArticleCitationIntegrity(article);
}

type PacketRow = {
  readonly id: string;
  readonly observations: readonly { readonly observationId: string }[];
  readonly derived: readonly { readonly derivedId: string }[];
  readonly artifacts: readonly { readonly artifactId: string; readonly dated?: string }[];
};
type PacketRefRows = {
  readonly observationIds: ReadonlySet<string>;
  readonly derivedIds: ReadonlySet<string>;
  readonly artifactIds: ReadonlySet<string>;
  readonly hasDatedArtifact: boolean;
};

/**
 * Publish gate: every figure/stat/primaryDocument/timeline block must resolve
 * against a *published* theme-impact packet's rows, and every map-inset entity
 * must exist in the release entity set.
 */
async function verifyArticleReferences(
  client: pg.PoolClient,
  article: ArticleAuthoring,
): Promise<void> {
  const packetIds = new Set<string>();
  const entityIds = new Set<string>();
  for (const block of article.body) {
    if (block.type === 'mapInset') entityIds.add(block.entityId);
    if (REFERENCED_PACKET_BLOCKS.has(block.type) && 'packetId' in block && block.packetId) {
      packetIds.add(block.packetId);
    }
  }

  const problems: string[] = [];

  const packetsById = new Map<string, PacketRefRows>();
  if (packetIds.size > 0) {
    const rows = await client.query<PacketRow>(
      `SELECT id, observations, derived, artifacts FROM bb_reference.theme_impact_packets
       WHERE id = ANY($1::text[]) AND status = 'published'`,
      [[...packetIds]],
    );
    for (const row of rows.rows) {
      packetsById.set(row.id, {
        observationIds: new Set((row.observations ?? []).map((o) => o.observationId)),
        derivedIds: new Set((row.derived ?? []).map((d) => d.derivedId)),
        artifactIds: new Set((row.artifacts ?? []).map((a) => a.artifactId)),
        hasDatedArtifact: (row.artifacts ?? []).some((a) => Boolean(a.dated)),
      });
    }
    for (const id of packetIds) {
      if (!packetsById.has(id)) problems.push(`packet "${id}" is not a published packet`);
    }
  }

  for (const block of article.body) {
    if (!('packetId' in block) || !block.packetId) continue;
    const packet = packetsById.get(block.packetId);
    if (!packet) continue; // already reported as missing
    if (block.type === 'stat') {
      const ids = block.kind === 'observation' ? packet.observationIds : packet.derivedIds;
      if (!ids.has(block.refId)) {
        problems.push(`stat refId "${block.refId}" not found on packet "${block.packetId}"`);
      }
    } else if (block.type === 'primaryDocument') {
      if (!packet.artifactIds.has(block.refId)) {
        problems.push(`primaryDocument refId "${block.refId}" not on packet "${block.packetId}"`);
      }
    } else if (block.type === 'timeline') {
      if (!packet.hasDatedArtifact) {
        problems.push(`timeline packet "${block.packetId}" has no dated artifacts`);
      }
    }
  }

  if (entityIds.size > 0) {
    const releaseId = await resolveActiveReleaseId(client);
    const rows = await client.query<{ id: string }>(
      `SELECT id FROM bb_public.release_entities WHERE release_id = $1 AND id = ANY($2::text[])`,
      [releaseId, [...entityIds]],
    );
    const found = new Set(rows.rows.map((row) => row.id));
    for (const id of entityIds) {
      if (!found.has(id)) problems.push(`mapInset entity "${id}" not in the active release`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`article "${article.slug}" reference gate failed:\n  ${problems.join('\n  ')}`);
  }
}

const UPSERT_SQL = `
INSERT INTO bb_reference.articles (
  id, slug, title, summary, theme_id, era_label, place_label, published_at, updated_at,
  hero_image, body, "references", related_entity_ids, status, row_updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date,
  $10::jsonb, $11::jsonb, $12::jsonb, $13::text[], $14, now()
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  theme_id = EXCLUDED.theme_id,
  era_label = EXCLUDED.era_label,
  place_label = EXCLUDED.place_label,
  published_at = EXCLUDED.published_at,
  updated_at = EXCLUDED.updated_at,
  hero_image = EXCLUDED.hero_image,
  body = EXCLUDED.body,
  "references" = EXCLUDED."references",
  related_entity_ids = EXCLUDED.related_entity_ids,
  status = EXCLUDED.status,
  row_updated_at = now()
RETURNING id, status;
`;

const REFERENCE_COLUMNS = `id, slug, title, summary, theme_id, era_label, place_label,
  published_at, updated_at, hero_image, body, "references", related_entity_ids, status`;

type ArticleRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly theme_id: string | null;
  readonly era_label: string;
  readonly place_label: string;
  readonly published_at: string | Date;
  readonly updated_at: string | Date | null;
  readonly hero_image: unknown;
  readonly body: unknown;
  readonly references: unknown;
  readonly related_entity_ids: readonly string[];
  readonly status: string;
};

function dateString(value: string | Date | null): string | undefined {
  if (value === null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** Rebuild the public projection doc from a reference row + release id. */
function rowToProjection(row: ArticleRow, releaseId: string) {
  const doc = {
    id: row.id,
    releaseId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...(row.hero_image ? { heroImage: row.hero_image } : {}),
    publishedAt: dateString(row.published_at)!,
    ...(dateString(row.updated_at) ? { updatedAt: dateString(row.updated_at) } : {}),
    eraLabel: row.era_label,
    placeLabel: row.place_label,
    ...(row.theme_id ? { themeId: row.theme_id } : {}),
    body: row.body,
    references: row.references ?? [],
    relatedEntityIds: row.related_entity_ids ?? [],
  };
  return publicArticleProjectionSchema.parse(doc);
}

function upsertParams(article: ArticleAuthoring): readonly unknown[] {
  return [
    article.id,
    article.slug,
    article.title,
    article.summary,
    article.themeId ?? null,
    article.eraLabel,
    article.placeLabel,
    article.publishedAt,
    article.updatedAt ?? null,
    article.heroImage ? JSON.stringify(article.heroImage) : null,
    JSON.stringify(article.body),
    JSON.stringify(article.references),
    [...article.relatedEntityIds],
    article.status,
  ];
}

type DbContext = { readonly pool: pg.Pool; readonly client: pg.PoolClient; readonly dryRun: boolean };

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
    await client.query('BEGIN');
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

async function resolveActiveReleaseId(client: pg.PoolClient): Promise<string> {
  const active = await client.query<{ release_id: string }>(
    `SELECT release_id FROM bb_public.active_release WHERE id = 'active'`,
  );
  const releaseId = active.rows[0]?.release_id;
  if (!releaseId) throw new Error('no active release configured in bb_public.active_release');
  return releaseId;
}

function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function commandValidate(paths: readonly string[]): Promise<void> {
  const articles = await loadFixtureArticles(paths);
  for (const article of articles) validateArticleOffline(article);
  console.log(
    JSON.stringify(
      {
        command: 'validate',
        ok: true,
        articles: articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          status: a.status,
          blocks: a.body.length,
          references: a.references.length,
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

async function commandPromote(articleIds: readonly string[]): Promise<void> {
  if (articleIds.length === 0) throw new Error('at least one article id is required');

  const result = await withDb(async ({ client, dryRun }) => {
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM bb_reference.articles WHERE id = ANY($1::text[])`,
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
        `UPDATE bb_reference.articles SET status = 'published', row_updated_at = now()
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
function rowToProjectionAuthoring(row: ArticleRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...(row.hero_image ? { heroImage: row.hero_image } : {}),
    publishedAt: dateString(row.published_at)!,
    ...(dateString(row.updated_at) ? { updatedAt: dateString(row.updated_at) } : {}),
    eraLabel: row.era_label,
    placeLabel: row.place_label,
    ...(row.theme_id ? { themeId: row.theme_id } : {}),
    body: row.body,
    references: row.references ?? [],
    relatedEntityIds: row.related_entity_ids ?? [],
  };
}

async function commandProject(): Promise<void> {
  const result = await withDb(async ({ client, dryRun }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM bb_reference.articles WHERE status = 'published' ORDER BY id`,
    );

    const projected: string[] = [];
    const unchanged: string[] = [];
    for (const row of rows.rows) {
      const doc = rowToProjection(row, releaseId);
      const hash = contentHash(doc);
      const upserted = await client.query<{ article_id: string }>(
        `INSERT INTO bb_public.release_articles (
           release_id, article_id, slug, theme_id, published_at, payload, content_hash
         ) VALUES ($1, $2, $3, $4, $5::date, $6::jsonb, $7)
         ON CONFLICT (release_id, article_id) DO UPDATE SET
           slug = EXCLUDED.slug,
           theme_id = EXCLUDED.theme_id,
           published_at = EXCLUDED.published_at,
           payload = EXCLUDED.payload,
           content_hash = EXCLUDED.content_hash
         WHERE bb_public.release_articles.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         RETURNING article_id`,
        [releaseId, doc.id, doc.slug, doc.themeId ?? null, doc.publishedAt, JSON.stringify(doc), hash],
      );
      if (upserted.rows[0]) projected.push(doc.id);
      else unchanged.push(doc.id);
    }

    const stale = await client.query<{ article_id: string }>(
      `DELETE FROM bb_public.release_articles
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
      `SELECT ${REFERENCE_COLUMNS} FROM bb_reference.articles WHERE status = 'published'`,
    );
    const releaseRows = await client.query<{ article_id: string; content_hash: string }>(
      `SELECT article_id, content_hash FROM bb_public.release_articles WHERE release_id = $1`,
      [releaseId],
    );
    const releaseHashById = new Map(releaseRows.rows.map((row) => [row.article_id, row.content_hash]));

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

await main();
