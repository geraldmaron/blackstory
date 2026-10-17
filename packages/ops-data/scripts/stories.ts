/**
 * Story lifecycle CLI — the long-form /stories publication surface.
 *
 * Stories are canonical in reference.stories (Supabase) — the database is
 * the source of truth, not files in git. To edit, `pull` a story into a
 * local draft (JSON, gitignored), edit it, `validate`, `apply` it back, then
 * `promote` (which re-runs every gate against the DB row) and `project` into
 * published.release_stories for the active release. Mirrors the theme-impact
 * packet CLI (packages/ops-data/scripts/theme-packets.ts).
 *
 * Usage (repo root; DATABASE_URL required for every command except validate):
 *   node --conditions development --import tsx packages/ops-data/scripts/stories.ts \
 *     pull <storyId|slug ...>                # DB -> packages/ops-data/drafts/<slug>.story.json
 *   ... stories.ts validate <draft.json|module.ts ...>  # offline gates on a draft
 *   ... stories.ts apply <draft.json|module.ts ...>     # upsert at declared status
 *   ... stories.ts promote <storyId ...>    # gate the DB row + flip to published
 *   ... stories.ts project                    # published -> active release
 *   ... stories.ts rehash                     # recompute content_hash for every released story
 *   ... stories.ts audit                      # drift check: release vs reference
 *
 * All write commands run inside a transaction and honor DRY_RUN=1 (rollback).
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { publicStoryProjectionSchema } from '@repo/schemas';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  storyAuthoringSchema,
  type StoryAuthoring,
  type StoryRow,
  UPSERT_SQL,
  REFERENCE_COLUMNS,
  upsertParams,
  rowToProjection,
  rowToProjectionAuthoring,
  contentHash,
  validateStoryOffline,
  verifyStoryReferences,
  gateDoiCitations,
  gateReferenceUrls,
  gateCollectionPositions,
  countProseWords,
  resolveActiveReleaseId,
} from './lib/story-lifecycle.js';

const USAGE = 'usage: stories.ts <pull|validate|apply|promote|project|rehash|audit> [args...]';

/** Authoring shape: the projection doc minus the release-assigned id, plus status. */
function isStoryLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { slug?: unknown }).slug === 'string' &&
    Array.isArray((value as { body?: unknown }).body)
  );
}

async function loadFixtureStories(paths: readonly string[]): Promise<readonly StoryAuthoring[]> {
  if (paths.length === 0) throw new Error('at least one fixture module path is required');
  const stories = new Map<string, StoryAuthoring>();
  for (const path of paths) {
    const module: Record<string, unknown> = path.endsWith('.json')
      ? { draft: JSON.parse(readFileSync(resolve(path), 'utf8')) as unknown }
      : await import(pathToFileURL(resolve(path)).href);
    let found = 0;
    for (const exported of Object.values(module)) {
      const candidates = Array.isArray(exported) ? exported : [exported];
      for (const candidate of candidates) {
        if (!isStoryLike(candidate)) continue;
        found += 1;
        const story = storyAuthoringSchema.parse(candidate);
        const prior = stories.get(story.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(story)) {
          throw new Error(`story ${story.id} defined twice with different content`);
        }
        stories.set(story.id, story);
      }
    }
    if (found === 0) {
      throw new Error(`${path}: no Story exports found (export a story object or an array)`);
    }
  }
  return [...stories.values()];
}

/**
 * Source-quality gate (consults the shared tier registry, not a parallel list — same
 * rule theme-packets.ts's gateSourceTiers enforces for packet observations): every
 * reference's url is classified into a trust tier. T4 (untrusted, unclassified) is a
 * hard error on published stories and a surfaced warning otherwise.
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
  const stories = await loadFixtureStories(paths);
  for (const story of stories) validateStoryOffline(story);
  gateCollectionPositions(stories);

  // DB-binding gate: when DATABASE_URL is present, transitively resolve every
  // figure/stat/primaryDocument/timeline refId against its published packet's
  // rows (and mapInset entities against the release), so a validate that passes
  // with DB access proves the story's citations actually exist. Skipped when
  // offline (CI-safe); offline still runs schema + inline-citation integrity.
  let bound: 'db-verified' | 'offline-skipped' = 'offline-skipped';
  if (process.env.DATABASE_URL?.trim()) {
    await withDb(async ({ client }) => {
      for (const story of stories)
        if (story.status === 'published') await verifyStoryReferences(client, story);
    });
    bound = 'db-verified';
  }

  let doiChecked = false;
  if (process.env.CHECK_DOIS === '1') {
    for (const story of stories) await gateDoiCitations(story);
    doiChecked = true;
  }

  let urlsChecked = false;
  if (process.env.CHECK_URLS === '1') {
    for (const story of stories) await gateReferenceUrls(story);
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
        stories: stories.map((a) => ({
          id: a.id,
          slug: a.slug,
          format: a.format ?? 'chapter',
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
  const stories = await loadFixtureStories(paths);
  for (const story of stories) validateStoryOffline(story);
  gateCollectionPositions(stories);

  const result = await withDb(async ({ client, dryRun }) => {
    const applied: { id: string; status: string }[] = [];
    for (const story of stories) {
      if (story.status === 'published') await verifyStoryReferences(client, story);
      const row = await client.query<{ id: string; status: string }>(
        UPSERT_SQL,
        upsertParams(story) as unknown[],
      );
      applied.push(row.rows[0]!);
    }
    return { applied, dryRun };
  });

  console.log(JSON.stringify({ command: 'apply', ...result }, null, 2));
}

const DRAFTS_DIR = resolve('packages/ops-data/drafts');

/**
 * DB -> local draft. Exports reference.stories rows (matched by id or slug)
 * as authoring JSON into packages/ops-data/drafts/, which is gitignored: drafts
 * are working copies for an edit session, never a second source of truth.
 */
async function commandPull(idsOrSlugs: readonly string[]): Promise<void> {
  if (idsOrSlugs.length === 0) throw new Error('at least one story id or slug is required');

  const result = await withDb(async ({ client }) => {
    const rows = await client.query<StoryRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.stories
       WHERE id = ANY($1::text[]) OR slug = ANY($1::text[])`,
      [[...idsOrSlugs]],
    );
    const matched = new Set(rows.rows.flatMap((row) => [row.id, row.slug]));
    const missing = idsOrSlugs.filter((key) => !matched.has(key));
    if (missing.length > 0) throw new Error(`stories not found: ${missing.join(', ')}`);

    mkdirSync(DRAFTS_DIR, { recursive: true });
    const pulled: { id: string; slug: string; status: string; path: string }[] = [];
    for (const row of rows.rows) {
      const authoring = storyAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: row.status,
      });
      const path = join(DRAFTS_DIR, `${row.slug}.story.json`);
      writeFileSync(path, `${JSON.stringify(authoring, null, 2)}\n`);
      pulled.push({ id: row.id, slug: row.slug, status: row.status, path });
    }
    return { pulled };
  });

  console.log(JSON.stringify({ command: 'pull', ...result }, null, 2));
}

async function commandPromote(storyIds: readonly string[]): Promise<void> {
  if (storyIds.length === 0) throw new Error('at least one story id is required');

  const result = await withDb(async ({ client, dryRun }) => {
    const rows = await client.query<StoryRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.stories WHERE id = ANY($1::text[])`,
      [[...storyIds]],
    );
    const foundIds = new Set(rows.rows.map((row) => row.id));
    const missing = storyIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new Error(`stories not found: ${missing.join(', ')}`);

    for (const row of rows.rows) {
      const authoring = storyAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: 'published',
      });
      validateStoryOffline(authoring);
      await verifyStoryReferences(client, authoring);
    }

    const promoted: string[] = [];
    for (const id of storyIds) {
      const updated = await client.query<{ id: string }>(
        `UPDATE reference.stories SET status = 'published', row_updated_at = now()
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
    const rows = await client.query<StoryRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.stories WHERE status = 'published' ORDER BY id`,
    );

    const projected: string[] = [];
    const unchanged: string[] = [];
    for (const row of rows.rows) {
      const authoring = storyAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: 'published',
      });
      validateStoryOffline(authoring);
      await verifyStoryReferences(client, authoring);
      const doc = rowToProjection(row, releaseId);
      const hash = contentHash(doc);
      const upserted = await client.query<{ story_id: string }>(
        `INSERT INTO published.release_stories (
           release_id, story_id, slug, theme_id, published_at, payload, content_hash
         ) VALUES ($1, $2, $3, $4, $5::date, $6::jsonb, $7)
         ON CONFLICT (release_id, story_id) DO UPDATE SET
           slug = EXCLUDED.slug,
           theme_id = EXCLUDED.theme_id,
           published_at = EXCLUDED.published_at,
           payload = EXCLUDED.payload,
           content_hash = EXCLUDED.content_hash
         WHERE published.release_stories.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         RETURNING story_id`,
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

    const stale = await client.query<{ story_id: string }>(
      `DELETE FROM published.release_stories
       WHERE release_id = $1 AND story_id <> ALL($2::text[])
       RETURNING story_id`,
      [releaseId, rows.rows.map((row) => row.id)],
    );

    return {
      releaseId,
      projected,
      unchanged,
      removedStale: stale.rows.map((row) => row.story_id),
      dryRun,
    };
  });

  console.log(JSON.stringify({ command: 'project', ...result }, null, 2));
}

async function commandAudit(): Promise<void> {
  const result = await withDb(async ({ client }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const referenceRows = await client.query<StoryRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM reference.stories WHERE status = 'published'`,
    );
    const releaseRows = await client.query<{ story_id: string; content_hash: string }>(
      `SELECT story_id, content_hash FROM published.release_stories WHERE release_id = $1`,
      [releaseId],
    );
    const releaseHashById = new Map(
      releaseRows.rows.map((row) => [row.story_id, row.content_hash]),
    );

    const stories: { story_id: string; state: string }[] = [];
    for (const row of referenceRows.rows) {
      const releaseHash = releaseHashById.get(row.id);
      releaseHashById.delete(row.id);
      if (releaseHash === undefined) {
        stories.push({ story_id: row.id, state: 'published_not_projected' });
      } else if (releaseHash !== contentHash(rowToProjection(row, releaseId))) {
        stories.push({ story_id: row.id, state: 'drifted_since_projection' });
      } else {
        stories.push({ story_id: row.id, state: 'ok' });
      }
    }
    for (const storyId of releaseHashById.keys()) {
      stories.push({ story_id: storyId, state: 'in_release_only' });
    }
    return { releaseId, stories, issues: stories.filter((row) => row.state !== 'ok') };
  });
  console.log(JSON.stringify({ command: 'audit', ...result }, null, 2));
}

/**
 * Recomputes `content_hash` for every released story in every release. The hash is sha256 over
 * the application's JSON.stringify of the parsed projection (key order matters), so a migration
 * that rewrites payload keys cannot recompute it in SQL; run this straight after one.
 */
async function commandRehash(): Promise<void> {
  const result = await withDb(async ({ client }) => {
    const rows = await client.query<{
      release_id: string;
      story_id: string;
      payload: unknown;
      content_hash: string;
    }>(
      `SELECT release_id, story_id, payload, content_hash FROM published.release_stories ORDER BY release_id, story_id`,
    );
    let updated = 0;
    for (const row of rows.rows) {
      const hash = contentHash(publicStoryProjectionSchema.parse(row.payload));
      if (hash === row.content_hash) continue;
      await client.query(
        `UPDATE published.release_stories SET content_hash = $3 WHERE release_id = $1 AND story_id = $2`,
        [row.release_id, row.story_id, hash],
      );
      updated += 1;
    }
    return { rows: rows.rows.length, updated };
  });
  console.log(JSON.stringify({ command: 'rehash', ...result }, null, 2));
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
    case 'rehash':
      return commandRehash();
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
