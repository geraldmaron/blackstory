/**
 * Read-only comparison of public projection, scalar columns and search facets, plus recomputed
 * inclusion basis and coverage. Copies can agree while all remain stale after a claim edit.
 * Shared divergence logic also runs after publication writes.
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
      // The all mode includes recomputed builder fields. Agreement among stored copies does not
      // establish agreement with the record's current claims.
      scope: 'all' as const,
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
