/**
 * One-time real (non-dry-run) run of the entity network expansion engine for Audre Lorde, now
 * that she exists in bb_canonical.entities (ent_audre_lorde_001, promoted 2026-07-24). The
 * original repo-xez5.4 pilot (entity-network-expansion.pilot.ts) ran without a canonical
 * entityId and only printed what it WOULD stage — nothing was written. This closes that loop for
 * real, satisfying the epic's acceptance criterion that entity expansion demonstrably surfaces
 * the Audre Lorde network as staged (review-gated) candidates.
 *
 * Usage:
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/operator-cli/src/stage-audre-lorde-network.ts
 */
import { getOpsPostgresPool } from '@repo/data-access';
import { expandEntityNetwork, stageNetworkCandidates, type ExpansionSeed } from './entity-network-expansion.js';

const AUDRE_LORDE: ExpansionSeed = {
  qid: 'Q463319',
  kind: 'person',
  displayName: 'Audre Lorde',
  entityId: 'ent_audre_lorde_001',
};

async function main() {
  const pool = getOpsPostgresPool(process.env);
  const client = await pool.connect();
  try {
    const candidates = await expandEntityNetwork(AUDRE_LORDE, { depth: 1, maxCandidates: 50 });
    console.log(`Surfaced ${candidates.length} candidates for Audre Lorde (Q463319).`);

    const staged = await stageNetworkCandidates(
      AUDRE_LORDE,
      candidates,
      'run_repo_xez5_lorde_network_20260724',
      async (rows) => {
        for (const row of rows) {
          await client.query(
            `INSERT INTO bb_research.landscape_candidates
              (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
               canonical_url, research_lane_only, status, payload, provenance, discovered_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11::jsonb, $12::jsonb, $13)
             ON CONFLICT (id) DO NOTHING`,
            [
              row.id,
              row.run_id,
              row.lane,
              row.source_program_id,
              row.source_item_id,
              row.display_name,
              row.kind,
              row.summary,
              row.canonical_url,
              row.status,
              JSON.stringify(row.payload),
              JSON.stringify(row.provenance),
              row.discovered_at,
            ],
          );
        }
      },
    );

    console.log(`Staged ${staged.length} rows to bb_research.landscape_candidates (lane='wikidata').`);
    for (const row of staged) {
      console.log(`  ${row.display_name} (${row.source_item_id}): ${row.payload.relationship_type} (${row.payload.direction})`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
