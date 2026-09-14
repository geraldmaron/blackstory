/**
 * repo-2t04.8.1 — manual capture insert for bb_research.entity_evidence. No automated collector in
 * sweep-entity-evidence.ts targets justice.tougaloo.edu (or the ad hoc corroborating sources this
 * wave used), so these rows are inserted directly from research-workflow output, matching the
 * exact INSERT shape sweep-entity-evidence.ts itself uses (id = ev_${sha1(entityId|collector|url)}
 * so re-runs upsert cleanly on the (entity_id, collector, source_url) unique constraint).
 *
 * Default is dry-run (prints the plan only). Production writes require:
 *   DRY_RUN=0 INSERT_SUNDOWN_EVIDENCE_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/insert-sundown-evidence.mts --in=<dir>/evidence-rows.json
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

function flag(name: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= is required`);
  return hit.slice(name.length + 3);
}

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.INSERT_SUNDOWN_EVIDENCE_APPLY === '1';

type EvidenceInsertRow = {
  readonly id: string;
  readonly entity_id: string;
  readonly lane: string;
  readonly collector: string;
  readonly source_url: string;
  readonly source_tier: string;
  readonly title: string | null;
  readonly content_text: string;
  readonly content_hash: string;
  readonly char_count: number;
};

const rows = JSON.parse(readFileSync(flag('in'), 'utf8')) as readonly EvidenceInsertRow[];
console.log(
  `Plan: ${rows.length} evidence row(s) across ${new Set(rows.map((r) => r.entity_id)).size} entit(ies).`,
);
for (const row of rows) {
  console.log(
    `  ${row.entity_id} <- ${row.collector} (${row.source_tier}, ${row.char_count} chars) ${row.source_url}`,
  );
}

if (DRY_RUN || !APPLY) {
  console.log(
    '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 INSERT_SUNDOWN_EVIDENCE_APPLY=1 to apply.',
  );
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const row of rows) {
    await client.query(
      `INSERT INTO bb_research.entity_evidence
         (id, entity_id, lane, collector, source_url, source_tier, title, content_text,
          content_hash, char_count, quality_score, status, provenance, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'captured',$12, now())
       ON CONFLICT (entity_id, collector, source_url) DO UPDATE SET
         content_text = EXCLUDED.content_text,
         content_hash = EXCLUDED.content_hash,
         char_count = EXCLUDED.char_count,
         quality_score = EXCLUDED.quality_score,
         status = 'captured',
         provenance = EXCLUDED.provenance,
         fetched_at = now()`,
      [
        row.id,
        row.entity_id,
        row.lane,
        row.collector,
        row.source_url,
        row.source_tier,
        row.title,
        row.content_text,
        row.content_hash,
        row.char_count,
        row.source_tier === 'tier1' ? 0.85 : 0.65,
        JSON.stringify({ manualCapture: true, wave: 'repo-2t04.8.1-2026-09' }),
      ],
    );
  }
  await client.query('COMMIT');
  console.log(`Applied: ${rows.length} evidence row(s) upserted.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
