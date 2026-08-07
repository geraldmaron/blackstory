/**
 * repo-n7p6.18 — corpus triage sweep.
 *
 * Answers the question every enrichment batch has to ask first: which released records already
 * meet the bar and can be left alone, and which need work and specifically what kind. Without
 * it, enrichment picks targets by lane guesswork and progress is unmeasurable.
 *
 * Runs the deterministic content-expectations evaluator (`@repo/domain`, spec v2 — per-kind
 * floors: places and schools need 2 distinct sources, laws and cases need an impact statement
 * and 2 narrative paragraphs) over every entity in the active release, and records the verdict
 * plus the specific failed checks in the WS2 ledger (bb_research.entity_enrichment).
 *
 * No models and no network — the evaluator is pure, so this is cheap to run and cheap to re-run
 * whenever the spec version changes or records are enriched.
 *
 * Ledger semantics, since `status` is a fixed enum shared with the evidence sweep:
 *   - meets the bar  -> status 'skipped', notes.triage.verdict 'meets_bar'
 *     ("skipped" reads as "deliberately not queued for enrichment", which is what a passing
 *      record is. notes.triage.reason distinguishes it from the sweep's skipped:no-evidence.)
 *   - needs work     -> status 'pending', notes.triage.failedChecks listing exactly what failed
 * A row already marked 'enriched' or 'quarantined' by a later pass is never downgraded here —
 * this audit reports on content, it does not undo another pass's work.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 CONTENT_AUDIT_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/audit-entity-content.ts --limit=0
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  auditProjection,
  summarizeAudits,
  type EntityContentAudit,
} from './lib/entity-content-audit.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/content-audit');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.CONTENT_AUDIT_APPLY === '1';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

/** 0 means every entity in the active release. */
const LIMIT = Number.parseInt(flag('limit', '0'), 10);

type ReleaseRow = {
  readonly entity_id: string;
  readonly projection: Record<string, unknown> | null;
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');

  const pool = new pg.Pool({ ...normalizePgConnectionString(databaseUrl), max: 4 });

  try {
    const release = await pool.query<{ release_id: string }>(
      'SELECT release_id FROM bb_public.active_release LIMIT 1',
    );
    const releaseId = release.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    const rows = await pool.query<ReleaseRow>(
      `SELECT entity_id, projection
         FROM bb_public.release_entities
        WHERE release_id = $1
        ORDER BY entity_id
        ${LIMIT > 0 ? 'LIMIT ' + String(LIMIT) : ''}`,
      [releaseId],
    );

    const audits: EntityContentAudit[] = [];
    const unauditable: string[] = [];
    for (const row of rows.rows) {
      const audit = row.projection === null ? null : auditProjection(row.projection);
      if (audit === null) unauditable.push(row.entity_id);
      else audits.push(audit);
    }

    const summary = summarizeAudits(audits, rows.rows.length);
    console.log(`Active release: ${releaseId}`);
    console.log(
      `Audited ${summary.audited} of ${summary.total} (${summary.unauditable} unauditable)`,
    );
    console.log(
      `  meets bar: ${summary.meetsBar}  needs work: ${summary.needsWork}` +
        `  (${((summary.meetsBar / Math.max(summary.audited, 1)) * 100).toFixed(1)}% passing)`,
    );
    console.log('Failed checks, ranked by how many records they block:');
    for (const failure of summary.failuresByCheck) {
      console.log(`  ${failure.checkId.padEnd(22)} ${failure.count}`);
    }
    console.log('By kind (needs work / meets bar):');
    for (const kind of summary.byKind) {
      console.log(`  ${kind.kind.padEnd(14)} ${kind.needsWork} / ${kind.meetsBar}`);
    }
    if (unauditable.length > 0) {
      console.log(`Unauditable sample: ${unauditable.slice(0, 5).join(', ')}`);
    }

    mkdirSync(REPORT_DIR, { recursive: true });
    const generatedAt = new Date().toISOString();
    const reportPath = join(REPORT_DIR, `content-audit-${generatedAt.replace(/[:.]/gu, '-')}.json`);
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt,
          releaseId,
          summary,
          unauditable,
          audits: audits.map((audit) => ({
            entityId: audit.entityId,
            kind: audit.kind,
            verdict: audit.verdict,
            failedChecks: audit.result.failedCheckIds,
            distinctSourceCount: audit.distinctSourceCount,
          })),
        },
        null,
        2,
      ),
    );
    console.log(`Report: ${reportPath}`);

    if (DRY_RUN || !APPLY) {
      console.log(
        'Dry run — no ledger rows written. Set DRY_RUN=0 CONTENT_AUDIT_APPLY=1 to apply.',
      );
      return;
    }

    const client = await pool.connect();
    let written = 0;
    try {
      await client.query('BEGIN');
      for (const audit of audits) {
        const meets = audit.verdict === 'meets_bar';
        await client.query(
          `INSERT INTO bb_research.entity_enrichment
             (entity_id, status, notes, updated_at)
           VALUES ($1, $2, $3::jsonb, now())
           ON CONFLICT (entity_id) DO UPDATE SET
             -- Never downgrade a row a later pass has already enriched or quarantined; this
             -- audit reports on content, it does not undo another pass's work.
             status = CASE
               WHEN bb_research.entity_enrichment.status IN ('enriched', 'quarantined')
                 THEN bb_research.entity_enrichment.status
               ELSE EXCLUDED.status
             END,
             notes = bb_research.entity_enrichment.notes || EXCLUDED.notes,
             updated_at = now()`,
          [
            audit.entityId,
            meets ? 'skipped' : 'pending',
            JSON.stringify({
              triage: {
                verdict: audit.verdict,
                reason: meets ? 'meets-content-expectations' : 'below-content-expectations',
                specVersion: audit.result.specVersion,
                failedChecks: audit.result.failedCheckIds,
                distinctSourceCount: audit.distinctSourceCount,
                auditedAt: generatedAt,
              },
            }),
          ],
        );
        written += 1;
      }
      await client.query('COMMIT');
      console.log(`Applied: wrote triage verdicts for ${written} entities.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

await main();
