/**
 * Adds one controlled topic id to a named set of entities, in `bb_canonical` where topics are
 * authored, and leaves propagation to `sync-release-taxonomy-from-canonical.ts`.
 *
 * WHY THIS EXISTS (repo-92n2.37). A topic added to `packages/domain/src/taxonomy/topics.ts` is
 * inert until records carry it. `redlining` and `sundown-towns` were added in 4a5a558d and then
 * carried by ZERO records, so the Theme facet offered two subjects it could never filter to and
 * the archive's own sundown cohort — 122 records whose ids start `sundown_` and whose canonical
 * keywords already say "sundown town" — stayed findable only by prose.
 *
 * WHY CANONICAL AND NOT THE RELEASE. `bb_canonical.entities.kind_detail.classification` is where
 * topics are authored; the release copy is derived. Writing the release directly would be undone
 * by the next taxonomy sync, which reads canonical and treats it as the truth.
 *
 * `topicIds` and `topicTags` are both written. They are mirrored on every row this targets, the
 * release build carries tags onto the projection, and `searchTopicsFromProjection` prefers a
 * non-empty tag list — so writing ids alone would leave the new topic out of `search_index.topics`
 * and therefore out of topic browse (repo-ttlce).
 *
 * Idempotent: an entity that already carries the topic is counted and skipped, so a re-run after a
 * partial failure is safe.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   TOPIC_ID=sundown-towns IDS_FILE=/tmp/ids.txt node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-topic-id.ts
 *
 * Apply:
 *   TOPIC_ID=sundown-towns IDS_FILE=/tmp/ids.txt DRY_RUN=0 BACKFILL_TOPIC_ID_APPLY=1 \
 *     node --conditions development --import tsx packages/ops-data/scripts/backfill-topic-id.ts
 *
 * THEN PROPAGATE — writing canonical does not move the release:
 *   DRY_RUN=0 RELEASE_TAXONOMY_SYNC_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/sync-release-taxonomy-from-canonical.ts
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { isValidTopicId } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_TOPIC_ID_APPLY === '1';

function readIds(): readonly string[] {
  const file = process.env.IDS_FILE?.trim();
  const inline = process.env.IDS?.trim();
  const raw = file ? readFileSync(file, 'utf8') : (inline ?? '');
  return [
    ...new Set(
      raw
        .split(/[\s,]+/u)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

async function main(): Promise<void> {
  const topicId = process.env.TOPIC_ID?.trim();
  if (!topicId) {
    console.error('TOPIC_ID is required');
    process.exit(2);
  }
  // Fail closed on an unregistered topic. `resolveReleaseEntityReferences` rejects one at build
  // time, so writing it here would only move the failure to the next publish.
  if (!isValidTopicId(topicId)) {
    console.error(`TOPIC_ID "${topicId}" is not in the controlled taxonomy (topics.ts)`);
    process.exit(2);
  }
  const ids = readIds();
  if (ids.length === 0) {
    console.error('Pass IDS_FILE=<path> or IDS=<comma-separated ids>');
    process.exit(2);
  }
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }

  const { connectionString: cs, ssl } = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();
  try {
    const rows = (
      await client.query<{
        id: string;
        topic_ids: unknown;
        topic_tags: unknown;
      }>(
        `SELECT id,
                kind_detail->'classification'->'topicIds'  AS topic_ids,
                kind_detail->'classification'->'topicTags' AS topic_tags
           FROM bb_canonical.entities
          WHERE id = ANY($1::text[])
          ORDER BY id`,
        [ids],
      )
    ).rows;

    const found = new Set(rows.map((row) => row.id));
    const missing = ids.filter((id) => !found.has(id));
    const asArray = (v: unknown): readonly string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

    const already = rows.filter((row) => asArray(row.topic_ids).includes(topicId));
    const toWrite = rows.filter((row) => !asArray(row.topic_ids).includes(topicId));

    console.log(`=== Backfill topic "${topicId}" onto bb_canonical classification ===`);
    console.log(`  ids requested:            ${ids.length}`);
    console.log(`  canonical rows found:     ${rows.length}`);
    console.log(
      `  no canonical row:         ${missing.length}${missing.length ? ` (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''})` : ''}`,
    );
    console.log(`  already carry the topic:  ${already.length}`);
    console.log(`  would write:              ${toWrite.length}`);
    // Reported because a row with no classification object is the case that used to fail silently.
    const noClassification = rows.filter(
      (row) => row.topic_ids === null && row.topic_tags === null,
    );
    if (noClassification.length > 0) {
      console.log(
        `  (of those, ${noClassification.length} have NO classification object yet and get one: ` +
          `${noClassification
            .slice(0, 5)
            .map((r) => r.id)
            .join(', ')}${noClassification.length > 5 ? ', ...' : ''})`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        `\nDry run only. Set DRY_RUN=0 BACKFILL_TOPIC_ID_APPLY=1 to apply, then run ` +
          `sync-release-taxonomy-from-canonical.ts to propagate into the release.`,
      );
      return;
    }

    let written = 0;
    await client.query('BEGIN');
    try {
      for (const row of toWrite) {
        // Appended, not replaced: these records carry real authored topics already, and the
        // whole point is to add one subject rather than restate their classification.
        const nextIds = [...asArray(row.topic_ids), topicId];
        const nextTags = [...asArray(row.topic_tags), topicId];
        /*
         * Merged with `||` rather than set with `jsonb_set`. `jsonb_set` creates only the LAST
         * key in its path, so on a row whose `kind_detail` has no `classification` object at all
         * it returns the input unchanged — a silent no-op that still counts as an updated row.
         * One of the first eleven rows this script was written for (a research-case entity with
         * `classification: null`) was skipped exactly that way while the script reported success.
         */
        const updated = await client.query(
          `UPDATE bb_canonical.entities
              SET kind_detail = COALESCE(kind_detail, '{}'::jsonb)
                    || jsonb_build_object(
                         'classification',
                         COALESCE(kind_detail->'classification', '{}'::jsonb)
                           || jsonb_build_object('topicIds', $2::jsonb, 'topicTags', $3::jsonb)
                       ),
                  updated_at = now()
            WHERE id = $1
              AND NOT COALESCE(kind_detail->'classification'->'topicIds', '[]'::jsonb) @> $4::jsonb
        RETURNING id`,
          [row.id, JSON.stringify(nextIds), JSON.stringify(nextTags), JSON.stringify([topicId])],
        );
        written += updated.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`\nWrote ${written} canonical rows.`);
    if (written !== toWrite.length) {
      console.log(
        `  NOTE: ${toWrite.length - written} row(s) reported no update. The WHERE clause skips a ` +
          'row that already carries the topic, so a re-run is safe; anything else needs a look.',
      );
    }
    console.log(
      'NOT DONE YET — the release still has the old taxonomy. Run:\n' +
        '  DRY_RUN=0 RELEASE_TAXONOMY_SYNC_APPLY=1 node --conditions development --import tsx \\\n' +
        '    packages/ops-data/scripts/sync-release-taxonomy-from-canonical.ts',
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
