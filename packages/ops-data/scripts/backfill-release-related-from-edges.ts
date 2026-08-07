/**
 * repo-n7p6.6 item 4 — populate empty related[] on active-release entities from canonical
 * relationship edges (the relationship-inference lane's promoted output).
 *
 * For every active-release entity whose related is [] , derive entries from
 * bb_canonical.entity_relationships (workflow_status='accepted' AND
 * publication_status='published' only) where the OTHER endpoint is also in the active release —
 * an edge to an unreleased entity never renders and would dead-link. Writes the same
 * { id, type, direction } shape the release builder emits, to BOTH the top-level related jsonb
 * and projection.related (hydrate-via-event-neighbors.ts precedent). Entities whose related is
 * already populated are never touched.
 *
 * After applying, rebuild the release graph tables (they derive from projection.related):
 *   node --conditions development --import tsx packages/ops-data/scripts/rebuild-release-graph.ts
 *
 * Default dry-run. Apply:
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   DRY_RUN=0 BACKFILL_RELATED_FROM_EDGES_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-release-related-from-edges.ts
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_RELATED_FROM_EDGES_APPLY === '1';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type RelatedEntry = {
  readonly id: string;
  readonly type: string;
  readonly direction: 'outgoing' | 'incoming';
};

type TargetRow = {
  readonly release_id: string;
  readonly entity_id: string;
  readonly projection: Record<string, unknown>;
  readonly entries: RelatedEntry[];
};

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const { rows } = await client.query<{
      release_id: string;
      entity_id: string;
      projection: Record<string, unknown>;
      other_id: string;
      relationship_type: string;
      direction: 'outgoing' | 'incoming';
    }>(
      `WITH ar AS (SELECT release_id FROM bb_public.v_active_release_id),
       released AS (
         SELECT re.release_id, re.entity_id, re.projection
         FROM bb_public.release_entities re JOIN ar ON ar.release_id = re.release_id
       ),
       edges AS (
         SELECT er.from_entity_id AS eid, er.to_entity_id AS other_id,
                er.relationship_type, 'outgoing'::text AS direction
         FROM bb_canonical.entity_relationships er
         WHERE er.workflow_status = 'accepted' AND er.publication_status = 'published'
         UNION ALL
         SELECT er.to_entity_id, er.from_entity_id, er.relationship_type, 'incoming'
         FROM bb_canonical.entity_relationships er
         WHERE er.workflow_status = 'accepted' AND er.publication_status = 'published'
       )
       SELECT r.release_id, r.entity_id, r.projection,
              e.other_id, e.relationship_type, e.direction
       FROM released r
       JOIN edges e ON e.eid = r.entity_id
       JOIN released r2 ON r2.entity_id = e.other_id
       WHERE r.projection->'related' = '[]'::jsonb OR r.projection->'related' IS NULL
       ORDER BY r.entity_id, e.other_id, e.relationship_type`,
    );

    const targets = new Map<string, TargetRow>();
    for (const row of rows) {
      let target = targets.get(row.entity_id);
      if (!target) {
        target = {
          release_id: row.release_id,
          entity_id: row.entity_id,
          projection: row.projection,
          entries: [],
        };
        targets.set(row.entity_id, target);
      }
      // Dedup: one entry per neighbor, first (alphabetically stable) edge wins.
      if (!target.entries.some((entry) => entry.id === row.other_id)) {
        target.entries.push({
          id: row.other_id,
          type: row.relationship_type,
          direction: row.direction,
        });
      }
    }

    console.log('=== Backfill release related[] from canonical edges ===');
    console.log(`Entities with empty related and published in-release edges: ${targets.size}`);
    for (const target of [...targets.values()].slice(0, 15)) {
      console.log(
        `  ${target.entity_id}: ${target.entries.length} entr(ies) — ` +
          target.entries.map((entry) => `${entry.direction === 'outgoing' ? '→' : '←'}${entry.id}`).join(', '),
      );
    }
    if (targets.size > 15) console.log(`  ...and ${targets.size - 15} more`);

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 BACKFILL_RELATED_FROM_EDGES_APPLY=1 to apply.');
      return;
    }

    let updated = 0;
    await client.query('BEGIN');
    try {
      for (const target of targets.values()) {
        const relatedJson = JSON.stringify(target.entries);
        const nextProjection = JSON.stringify({ ...target.projection, related: target.entries });
        const result = await client.query(
          `UPDATE bb_public.release_entities
             SET related = $3::jsonb,
                 projection = $4::jsonb
           WHERE release_id = $1 AND entity_id = $2
             AND (projection->'related' = '[]'::jsonb OR projection->'related' IS NULL)`,
          [target.release_id, target.entity_id, relatedJson, nextProjection],
        );
        updated += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`\nApplied: ${updated} release_entities row(s) updated.`);
    console.log('Now rebuild the release graph: rebuild-release-graph.ts');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
