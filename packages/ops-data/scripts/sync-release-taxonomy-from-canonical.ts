/**
 * Sync `bb_public.release_entities.taxonomy` from `bb_canonical.entities.kind_detail` for the
 * active release. Run this:
 *   - once now, to fix the 1,167/1,375 active-release rows whose topicIds/topicTags were dropped
 *     when the release was built (docs/research/entity-completeness-audit.md's #2 gap);
 *   - after any future editorial-enrichment/backfill pass that changes an entity's
 *     kind_detail.classification, so the live release doesn't drift from canonical again;
 *   - as part of any future full or incremental release rebuild, before publishing.
 *
 * Usage:
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/sync-release-taxonomy-from-canonical.ts            # dry-run
 *   DRY_RUN=0 RELEASE_TAXONOMY_SYNC_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/sync-release-taxonomy-from-canonical.ts            # apply
 *
 * Optional: pass --release-id=<id> to target a specific release instead of the active one.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { applyReleaseTaxonomySync, planReleaseTaxonomySync } from './lib/release-taxonomy-sync.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.RELEASE_TAXONOMY_SYNC_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function readReleaseIdArg(): string | undefined {
  const hit = process.argv.find((entry) => entry.startsWith('--release-id='));
  return hit ? hit.slice('--release-id='.length) : undefined;
}

async function resolveReleaseId(client: pg.PoolClient): Promise<string> {
  const explicit = readReleaseIdArg();
  if (explicit) return explicit;
  const result = await client.query<{ release_id: string }>(
    `SELECT release_id FROM bb_public.active_release LIMIT 1`,
  );
  const releaseId = result.rows[0]?.release_id;
  if (!releaseId) throw new Error('No active release found and no --release-id= given');
  return releaseId;
}

async function main() {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const pool = new pg.Pool({ connectionString: cs, ssl });
  const client = await pool.connect();
  try {
    const releaseId = await resolveReleaseId(client);
    const plan = await planReleaseTaxonomySync(client, releaseId);

    console.log(`=== Release taxonomy sync (${releaseId}) ===`);
    console.log(`Scanned: ${plan.scanned}`);
    console.log(`Already in sync: ${plan.unchanged}`);
    console.log(`No canonical topics (real gap, not this bug): ${plan.noCanonicalTopics}`);
    console.log(`Needs update: ${plan.changed.length}`);

    const droppedTotal = plan.changed.reduce(
      (sum, row) => sum + row.droppedInvalidTopicIds.length,
      0,
    );
    if (droppedTotal > 0) {
      console.log(
        `Dropped ${droppedTotal} invalid topicId(s) not in TOPIC_REGISTRY across ${
          plan.changed.filter((r) => r.droppedInvalidTopicIds.length > 0).length
        } entities (sample: ${plan.changed
          .flatMap((r) => r.droppedInvalidTopicIds)
          .slice(0, 10)
          .join(', ')})`,
      );
    }

    for (const row of plan.changed.slice(0, 5)) {
      console.log(
        `  ${row.entityId}: topicIds [${row.beforeTopicIds.join(',')}] -> [${row.afterTopicIds.join(',')}], ` +
          `topicTags [${row.beforeTopicTags.join(',')}] -> [${row.afterTopicTags.join(',')}]`,
      );
    }
    if (plan.changed.length > 5) console.log(`  ...and ${plan.changed.length - 5} more`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no writes made. Set DRY_RUN=0 and RELEASE_TAXONOMY_SYNC_APPLY=1 to apply.',
      );
      return;
    }

    await applyReleaseTaxonomySync(client, releaseId, plan);
    console.log(`\nApplied: updated taxonomy for ${plan.changed.length} entities in ${releaseId}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
