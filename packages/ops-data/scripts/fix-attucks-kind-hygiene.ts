/**
 * Fix disc_crispus_attucks_q288241 kind hygiene (person modeled as event, corrupted
 * topicTags) and run catalog-wide kind-hygiene validation.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-attucks-kind-hygiene.ts
 *
 * Apply Attucks fix:
 *   DRY_RUN=0 FIX_ATTUCKS_KIND_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-attucks-kind-hygiene.ts
 */
import pg from 'pg';
import { isValidTopicId } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  kindHygieneLintFailureMessage,
  lintKindHygiene,
  mergeKindHygieneLintReports,
} from './lib/kind-hygiene-linter.ts';

const ATTUCKS_ID = 'disc_crispus_attucks_q288241';
const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_ATTUCKS_KIND_APPLY === '1';

const ATTUCKS_TOPIC_IDS = ['abolition'] as const;

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function loadCatalogForLint(client: pg.Client) {
  const { rows } = await client.query<{
    id: string;
    kind: string;
    display_name: string;
    entity_class: string | null;
    living_status: string;
    classification: Record<string, unknown> | null;
  }>(`
    SELECT
      e.id,
      e.kind,
      e.display_name,
      e.entity_class,
      e.living_status,
      e.kind_detail -> 'classification' AS classification
    FROM bb_canonical.entities e
    ORDER BY e.id
  `);
  return rows;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== Attucks kind hygiene + catalog validation ===');

    const attucksBefore = await client.query(
      `SELECT kind, entity_class, kind_detail FROM bb_canonical.entities WHERE id = $1`,
      [ATTUCKS_ID],
    );
    console.log('Attucks before:', JSON.stringify(attucksBefore.rows[0] ?? null));

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run for Attucks fix. Set DRY_RUN=0 FIX_ATTUCKS_KIND_APPLY=1 to apply.');
    } else {
      await client.query('BEGIN');
      try {
        await client.query(
          `UPDATE bb_canonical.entities
           SET
             kind = 'person',
             entity_class = 'person',
             living_status = 'deceased',
             kind_detail = jsonb_set(
               jsonb_set(
                 kind_detail,
                 '{classification,topicIds}',
                 $2::jsonb,
                 true
               ),
               '{classification,topicTags}',
               $2::jsonb,
               true
             ),
             updated_at = now()
           WHERE id = $1`,
          [ATTUCKS_ID, JSON.stringify([...ATTUCKS_TOPIC_IDS])],
        );

        const activeRelease = await client.query<{ release_id: string }>(
          `SELECT release_id FROM bb_public.active_release LIMIT 1`,
        );
        const releaseId = activeRelease.rows[0]?.release_id;
        if (releaseId) {
          await client.query(
            `UPDATE bb_public.release_entities
             SET
               projection = jsonb_set(
                 jsonb_set(
                   jsonb_set(projection, '{kind}', '"person"'::jsonb, true),
                   '{status}',
                   '"deceased"'::jsonb,
                   true
                 ),
                 '{topicIds}',
                 $3::jsonb,
                 true
               ),
               taxonomy = jsonb_set(
                 jsonb_set(
                   COALESCE(taxonomy, '{}'::jsonb),
                   '{topicIds}',
                   $3::jsonb,
                   true
                 ),
                 '{topicTags}',
                 $3::jsonb,
                 true
               )
             WHERE release_id = $1 AND entity_id = $2`,
            [releaseId, ATTUCKS_ID, JSON.stringify([...ATTUCKS_TOPIC_IDS])],
          );

          await client.query(
            `UPDATE bb_public.search_index
             SET kind = 'person', status = 'deceased'
             WHERE release_id = $1 AND entity_id = $2`,
            [releaseId, ATTUCKS_ID],
          );
        }

        await client.query('COMMIT');
        console.log('Attucks fix applied.');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    const attucksAfter = await client.query(
      `SELECT kind, entity_class, living_status, kind_detail->'classification' AS classification
       FROM bb_canonical.entities WHERE id = $1`,
      [ATTUCKS_ID],
    );
    console.log('Attucks after:', JSON.stringify(attucksAfter.rows[0] ?? null));

    const catalog = await loadCatalogForLint(client);
    const reports = catalog.map((row) => {
      const classification = row.classification ?? {};
      const topicTags = Array.isArray(classification.topicTags)
        ? classification.topicTags.filter((v): v is string => typeof v === 'string')
        : [];
      const topicIds = Array.isArray(classification.topicIds)
        ? classification.topicIds.filter((v): v is string => typeof v === 'string')
        : [];
      return lintKindHygiene({
        entityId: row.id,
        kind: row.kind,
        displayName: row.display_name,
        entityClass: row.entity_class,
        livingStatus: row.living_status,
        topicTags,
        topicIds,
      });
    });

    const merged = mergeKindHygieneLintReports(reports);
    const errors = merged.findings.filter((finding) => finding.severity === 'error');
    console.log(`\nCatalog kind-hygiene errors: ${errors.length}`);
    for (const finding of errors.slice(0, 20)) {
      console.log(`  ${finding.entityId}: ${finding.code} — ${finding.message}`);
    }
    if (errors.length > 20) console.log(`  ...and ${errors.length - 20} more`);

    const invalidTopicIds = catalog.flatMap((row) => {
      const classification = row.classification ?? {};
      const topicIds = Array.isArray(classification.topicIds)
        ? classification.topicIds.filter((v): v is string => typeof v === 'string')
        : [];
      return topicIds.filter((id) => !isValidTopicId(id)).map((id) => ({ entityId: row.id, id }));
    });
    if (invalidTopicIds.length > 0) {
      console.log(`\nInvalid topicIds (not in registry): ${invalidTopicIds.length}`);
      for (const entry of invalidTopicIds.slice(0, 10)) {
        console.log(`  ${entry.entityId}: ${entry.id}`);
      }
    }

    if (errors.length > 0 && APPLY) {
      console.error('\n' + kindHygieneLintFailureMessage(merged));
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
