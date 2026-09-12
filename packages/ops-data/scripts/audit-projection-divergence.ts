/**
 * How many published records serve one answer to readers and hold a different one in the copies
 * nobody reads?
 *
 * `bb_public.release_entities.projection` is the only store the public read path touches. The
 * columns beside it on the same row and the `bb_public.search_index` row are derived copies,
 * written from the same build at publish time and then updated independently by backfills. Every
 * backfill that writes one store and not the other leaves readers stale while the operator who
 * reads the column back sees the corrected value and calls the work done — the drift is invisible
 * from both ends, which is why it has recurred.
 *
 * This measures it per field, so a resync can be aimed rather than applied blind, and so a
 * "divergence is zero" claim is a number somebody ran rather than an assumption. The comparison
 * itself lives in `lib/projection-divergence.ts` and is shared with the post-write check the
 * publisher calls, so an audit result and a gate verdict cannot drift apart.
 *
 * READ-ONLY: SELECT only, no write path, no `--apply`.
 *
 * EXIT CODE is 1 when any field diverges, so this can stand in a check suite. `--allow` reports
 * the same numbers and exits 0, for a run that is measuring rather than gating.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/audit-projection-divergence.ts \
 *     [--ids=ent_a,ent_b] [--release=rel_...] [--samples=10] [--json=<path>] [--allow]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  auditProjectionDivergence,
  formatProjectionDivergenceReport,
  DEFAULT_DIVERGENCE_SAMPLE_LIMIT,
} from './lib/projection-divergence.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const DEFAULT_REPORT_PATH = join(REPO_ROOT, '.cache/projection-divergence/audit.json');

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const RELEASE = flag('release', '');
const SAMPLES = Number.parseInt(flag('samples', String(DEFAULT_DIVERGENCE_SAMPLE_LIMIT)), 10);
const JSON_OUT = flag('json', DEFAULT_REPORT_PATH);
const ALLOW = hasFlag('allow');
const IDS = flag('ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  try {
    const report = await auditProjectionDivergence(pool, {
      ...(RELEASE.length > 0 ? { releaseId: RELEASE } : {}),
      ...(IDS.length > 0 ? { ids: IDS } : {}),
      ...(Number.isFinite(SAMPLES) && SAMPLES > 0 ? { sampleLimit: SAMPLES } : {}),
    });

    console.log('=== PROJECTION vs DERIVED COPIES ===');
    if (IDS.length > 0) console.log(`Scoped to ${IDS.length} requested id(s).`);
    for (const line of formatProjectionDivergenceReport(report)) console.log(line);
    if (report.fields.length === 0) {
      console.log('  no field diverges — every derived copy matches the projection.');
    }

    if (JSON_OUT.length > 0) {
      mkdirSync(dirname(JSON_OUT), { recursive: true });
      writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
      console.log('');
      console.log(`Report: ${JSON_OUT}`);
    }

    if (report.totalDivergences > 0 && !ALLOW) {
      console.error('');
      console.error(
        `FAIL: ${report.divergentRows} row(s) diverge from the projection readers serve. ` +
          'Resync both stores, or re-run with --allow to record the number without failing.',
      );
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
