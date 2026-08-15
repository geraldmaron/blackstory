/**
 * Rebuild bb_public.release_graph_* for the active release from canonical relationships
 * and release entity projections (publish-time graph surfaces).
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *
 *   # Dry-run (default) — audit only, no writes
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/rebuild-release-graph.ts
 *
 * Apply:
 *   DRY_RUN=0 RELEASE_GRAPH_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/rebuild-release-graph.ts
 *
 * Relax decade coverage gate (measure only, no floor enforced):
 *   ENFORCE_DECADE_COVERAGE=0 DRY_RUN=0 RELEASE_GRAPH_APPLY=1 ...
 *
 * Accept a specific floor below the 90% default (stays fail-closed, just at a stated number):
 *   DRY_RUN=0 RELEASE_GRAPH_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/rebuild-release-graph.ts --min-decade-coverage=55
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  formatReleaseGraphAuditLog,
  rebuildReleaseGraphForRelease,
} from './lib/release-graph-publish.ts';
import {
  runPublishRegressionGates,
  publishRegressionFailureMessage,
} from './lib/publish-regression-gates.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_PATH = join(REPO_ROOT, '.cache/landscape-intake/release-graph-rebuild-report.json');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.RELEASE_GRAPH_APPLY === '1';
const ENFORCE_COVERAGE = process.env.ENFORCE_DECADE_COVERAGE !== '0';

const ACTIVE_RELEASE_SQL = `SELECT release_id FROM bb_public.active_release LIMIT 1`;

/**
 * The decade-coverage floor this rebuild accepts, mirroring
 * publish-release-entities-incremental.ts's --min-decade-coverage. Without this, the only way
 * to get an already-committed entity apply's graph step past a below-90% but honest coverage
 * number was ENFORCE_DECADE_COVERAGE=0, which drops the floor entirely rather than stating one —
 * the gate this script exists to keep (see assertReleaseGraphAuditOrThrow).
 */
function readMinDecadeCoverage(): number | undefined {
  const raw = process.argv.find((arg) => arg.startsWith('--min-decade-coverage='));
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw.slice('--min-decade-coverage='.length));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    console.error(`--min-decade-coverage must be a percentage between 0 and 100 (got "${raw}")`);
    process.exit(2);
  }
  return parsed;
}

const MIN_DECADE_COVERAGE = readMinDecadeCoverage();

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required');
    process.exit(2);
  }

  const generatedAt = new Date().toISOString();
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    max: 2,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });

  const client = await pool.connect();
  try {
    const activeRes = await client.query<{ release_id: string }>(ACTIVE_RELEASE_SQL);
    const releaseId = activeRes.rows[0]?.release_id;
    if (!releaseId) {
      throw new Error('no active release pointer in bb_public.active_release');
    }

    const regression = runPublishRegressionGates();
    if (regression.hasErrors) {
      throw new Error(publishRegressionFailureMessage(regression));
    }

    const built = await rebuildReleaseGraphForRelease(client, {
      releaseId,
      generatedAt,
      dryRun: DRY_RUN || !APPLY,
      enforceCoverage: ENFORCE_COVERAGE,
      ...(MIN_DECADE_COVERAGE !== undefined ? { minDecadeCoveragePct: MIN_DECADE_COVERAGE } : {}),
    });

    const report = {
      generatedAt,
      dryRun: DRY_RUN || !APPLY,
      releaseId,
      audit: built.audit,
      persisted: built.persisted ?? null,
      decadeCoverageFloorPct: MIN_DECADE_COVERAGE ?? 90,
      decadeCoverageFloorAcknowledged: MIN_DECADE_COVERAGE !== undefined,
      regressionWarnings: regression.findings.filter((finding) => finding.severity === 'warn'),
    };

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

    console.log('=== Release graph rebuild ===');
    console.log(`Active release: ${releaseId}`);
    for (const line of formatReleaseGraphAuditLog(built.audit)) {
      console.log(line);
    }
    if (built.persisted) {
      console.log(
        `Persisted adjacency=${built.persisted.adjacencyRows} decades=${built.persisted.decadeRows}`,
      );
    }
    console.log(`Report: ${REPORT_PATH}`);

    if (DRY_RUN) {
      console.log(
        'DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 RELEASE_GRAPH_APPLY=1 to apply.',
      );
      return;
    }
    if (!APPLY) {
      console.error('Refusing to write: set RELEASE_GRAPH_APPLY=1 with DRY_RUN=0');
      process.exit(2);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
