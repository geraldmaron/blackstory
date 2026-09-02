/**
 * Alert when the expensive public reads start costing real egress again.
 *
 * WHY THIS EXISTS. Between 2026-07-21 and 2026-08-09, `SELECT projection FROM
 * bb_public.release_entities` ran 49,226 times for 140.6M rows: roughly 253GB of egress and
 * about 80% of all query time on the project. Every instance re-pulled the whole ~7MB catalog
 * every 5 minutes because it was too big for Next's data cache. The causes are fixed
 * (dd7d71e5, 8aa98eeb, 3b38bae0). The reason it ran for 20 days is not: nothing was watching,
 * and it was found by hand after the bill.
 *
 * This is the same shape as `.github/workflows/canonical-convergence-monitor.yml`, and for the
 * same stated reason: a scheduled check that FAILS on breach, because GitHub notifies watchers
 * of scheduled-workflow failures by default. It is read-only apart from its own watermark row,
 * and it never changes application behaviour.
 *
 * HOW IT DECIDES. pg_stat_statements counters are cumulative since `stats_reset`, so a
 * threshold on raw totals cannot distinguish a spike today from one three weeks ago. Each run
 * stores its reading in `bb_ops.public_read_egress_watermark` and compares against the previous
 * one, projecting the delta to a per-day rate. Counter resets are detected and re-baselined
 * rather than read as "no traffic" — see lib/public-read-egress-budget.ts.
 *
 * Statements are matched by SQL fingerprint, not by `queryid`: queryid is a hash of the
 * normalized text and changes on any edit to the SQL, which would silently re-baseline to zero
 * during an unrelated refactor and hide the exact regression this watches for.
 *
 * Usage — manual run:
 *   cd apps/web && set -a && . ./.env.local && set +a && cd ../../ && \
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/check-public-read-egress.ts
 *
 * Scheduled run: .github/workflows/public-read-egress-monitor.yml (daily).
 *
 * Env: DATABASE_URL (or APP_DATABASE_URL). DRY_RUN=1 reports without writing the watermark,
 * so a manual look never disturbs the scheduled baseline.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  evaluateEgress,
  formatBytes,
  type EgressReading,
  type EgressWatermark,
} from './lib/public-read-egress-budget.ts';

const DRY_RUN = process.env.DRY_RUN === '1';

/**
 * The reads worth watching, with a per-row size measured from the live active release on
 * 2026-08-09 and a budget set from what each one actually costs when healthy.
 *
 * Budgets are deliberately generous. This is a smoke alarm for a return to the incident's order
 * of magnitude (the catalog pull alone was ~12GB/day), not a performance regression detector.
 * A monitor tuned so tight that it fires on ordinary cold-start variance gets muted, and a muted
 * monitor is worse than none because it looks like coverage.
 */
type WatchedRead = {
  readonly label: string;
  readonly description: string;
  /**
   * Matched with LIKE against pg_stat_statements.query. Every matching statement is summed,
   * which is the right answer for "how many bytes did reads of this shape send".
   *
   * Anchor these on the select list, not just the table name. `%FROM bb_public.release_entities%`
   * looks specific and is not: it also matches the ops scripts' DELETE and the projection-shaped
   * variants against the same table, so the monitor would silently be measuring a different
   * population than the one it names. The first draft of this file made exactly that mistake on
   * two of the three reads, plus a third where `%...search_index%name_lower%` required
   * `name_lower` to appear AFTER the FROM clause when it is in the select list before it — that
   * one matched a 1-call statement instead of the 3,860-call pull it was meant to watch.
   */
  readonly fingerprint: string;
  readonly bytesPerRow: number;
  readonly budgetBytesPerDay: number;
};

const GB = 1024 ** 3;

const WATCHED_READS: readonly WatchedRead[] = [
  {
    label: 'release_entities_full_catalog',
    description: 'Full entity catalog pull (the 2026-08-07 incident query)',
    fingerprint: 'SELECT projection%FROM bb_public.release_entities%ORDER BY entity_id%',
    // 7,382 kB across 4,092 rows on the active release.
    bytesPerRow: 1_847,
    // Healthy is a handful of cold starts per day (single-digit GB is already far above that).
    // The incident ran at ~12GB/day.
    budgetBytesPerDay: 2 * GB,
  },
  {
    label: 'search_index_full',
    description: 'Full search index pull',
    fingerprint: 'SELECT id, release_id, entity_id, name, name_lower%FROM bb_public.search_index%',
    // ~2.09MB across ~4,092 docs.
    bytesPerRow: 512,
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'release_graph_adjacency_full',
    description: 'Full graph adjacency pull',
    fingerprint: 'SELECT entity_id, adjacency%FROM bb_public.release_graph_adjacency%',
    // 656 kB across 4,092 rows.
    bytesPerRow: 164,
    budgetBytesPerDay: 1 * GB,
  },
  // The three below were added 2026-09-02. pg_stat_statements since 2026-07-20 showed them at
  // 478k, 515k and 960k calls respectively: small rows, but read on every dynamic request with
  // only per-request memoisation, so they are the calls-blow-up alarm rather than the bytes one.
  // Per-row sizes measured on the active release the same day.
  {
    label: 'release_articles_full',
    description: 'Full article list pull (article index, cites edge, story lead)',
    // Anchored on the ORDER BY so the by-slug point read (`WHERE articles.slug = $1`) is not
    // counted as a full pull.
    fingerprint:
      'SELECT articles.payload%FROM bb_public.release_articles%ORDER BY articles.published_at%',
    // 222,633 bytes across 48 rows.
    bytesPerRow: 4_638,
    // Healthy is one pull per instance per 30m (the release-scoped cache TTL); 1GB/day is
    // ~4,700 full pulls, an order of magnitude above that.
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'release_theme_impact_packets',
    description: 'Theme-impact packet reads (all shapes: full, by theme, by packet id)',
    fingerprint: 'SELECT packets.payload%FROM bb_public.release_theme_impact_packets%',
    // 106,791 bytes across 13 rows.
    bytesPerRow: 8_215,
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'active_release_pointer',
    description: 'Active-release pointer read (one tiny row; this is a call-count alarm)',
    // The select list and FROM are on separate lines in the source, so `%` between them.
    fingerprint:
      'SELECT release_id, activated_at, search_index_version, manifest_hash%FROM bb_public.active_release%',
    // 171 bytes, one row per call.
    bytesPerRow: 171,
    // ~600k calls/day. The pointer is memoised for 30s per instance and per request, so a
    // healthy day is a few thousand calls; this only fires if the memo is bypassed wholesale.
    budgetBytesPerDay: 100 * 1024 * 1024,
  },
];

type StatementRow = {
  readonly calls: string;
  readonly rows: string;
  readonly statements: string;
  readonly stats_since: Date;
};

type WatermarkRow = {
  readonly calls: string;
  readonly rows_returned: string;
  readonly stats_since: Date;
  readonly captured_at: Date;
  readonly fingerprint: string | null;
};

function requireEnv(...names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing required env: one of ${names.join(', ')}`);
}

async function readCurrent(
  client: pg.Client,
  read: WatchedRead,
): Promise<EgressReading | undefined> {
  const result = await client.query<StatementRow>(
    `SELECT sum(s.calls)::bigint AS calls,
            sum(s.rows)::bigint  AS rows,
            count(*)::bigint     AS statements,
            i.stats_reset        AS stats_since
       FROM pg_stat_statements s
       CROSS JOIN pg_stat_statements_info i
      WHERE s.query LIKE $1
      GROUP BY i.stats_reset`,
    [read.fingerprint],
  );
  const row = result.rows[0];
  if (!row || row.calls === null) return undefined;

  // Matching several statements is expected, not an error: ad-hoc queries of the same shape
  // (a LIMITed spot-check, a variant select list) register as separate pg_stat_statements
  // entries, and summing them is the more correct answer for "how many bytes did reads of this
  // shape send". Writes cannot distort the budget because it is computed from rows returned,
  // and an INSERT/DELETE returns none — which is also why the fingerprints anchor on the select
  // list rather than the table name. The count is surfaced so a fingerprint that has quietly
  // gone broad is visible in the log rather than only in the number.
  const statements = Number(row.statements);
  if (statements > 1) {
    console.log(`  (${read.label}: ${statements} statements of this shape, summed)`);
  }

  return {
    calls: Number(row.calls),
    rowsReturned: Number(row.rows),
    statsSince: row.stats_since,
  };
}

async function readWatermark(
  client: pg.Client,
  label: string,
): Promise<EgressWatermark | undefined> {
  const result = await client.query<WatermarkRow>(
    `SELECT calls, rows_returned, stats_since, captured_at, fingerprint
       FROM bb_ops.public_read_egress_watermark
      WHERE label = $1`,
    [label],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    calls: Number(row.calls),
    rowsReturned: Number(row.rows_returned),
    statsSince: row.stats_since,
    capturedAt: row.captured_at,
    fingerprint: row.fingerprint,
  };
}

async function writeWatermark(
  client: pg.Client,
  label: string,
  reading: EgressReading,
  now: Date,
  fingerprint: string,
): Promise<void> {
  await client.query(
    `INSERT INTO bb_ops.public_read_egress_watermark
       (label, calls, rows_returned, stats_since, captured_at, fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (label) DO UPDATE
       SET calls = EXCLUDED.calls,
           rows_returned = EXCLUDED.rows_returned,
           stats_since = EXCLUDED.stats_since,
           captured_at = EXCLUDED.captured_at,
           fingerprint = EXCLUDED.fingerprint`,
    [label, reading.calls, reading.rowsReturned, reading.statsSince, now, fingerprint],
  );
}

async function main(): Promise<void> {
  const raw = requireEnv('DATABASE_URL', 'APP_DATABASE_URL');
  const { connectionString, ssl } = normalizePgConnectionString(raw);
  const client = new pg.Client({ connectionString, ...(ssl ? { ssl } : {}) });
  await client.connect();

  const breaches: string[] = [];
  const now = new Date();

  try {
    for (const read of WATCHED_READS) {
      const current = await readCurrent(client, read);
      if (current === undefined) {
        // Not an alert. A statement absent from pg_stat_statements has not run since the last
        // reset, which for these reads is the good outcome, not a broken monitor.
        console.log(`· ${read.label}: not present in pg_stat_statements (no calls since reset)`);
        continue;
      }

      const previous = await readWatermark(client, read.label);
      const verdict = evaluateEgress({
        previous,
        current,
        now,
        bytesPerRow: read.bytesPerRow,
        budgetBytesPerDay: read.budgetBytesPerDay,
        fingerprint: read.fingerprint,
      });

      if (verdict.kind === 'first-run') {
        console.log(`· ${read.label}: baseline recorded (no comparable previous reading)`);
      } else if (verdict.kind === 'fingerprint-changed') {
        console.log(`· ${read.label}: fingerprint changed since last run; re-baselining`);
      } else if (verdict.kind === 'counters-reset') {
        console.log(`· ${read.label}: counters reset since last run; re-baselining`);
      } else {
        const line =
          `${read.label}: ${verdict.callsDelta} calls, ${verdict.rowsDelta} rows, ` +
          `${formatBytes(verdict.estimatedBytes)} over ${verdict.elapsedHours.toFixed(1)}h ` +
          `→ ${formatBytes(verdict.projectedBytesPerDay)}/day ` +
          `(budget ${formatBytes(read.budgetBytesPerDay)}/day)`;
        if (verdict.overBudget) {
          console.error(`✗ ${line}`);
          breaches.push(`${line}\n    ${read.description}`);
        } else {
          console.log(`✓ ${line}`);
        }
      }

      if (!DRY_RUN) await writeWatermark(client, read.label, current, now, read.fingerprint);
    }
  } finally {
    await client.end();
  }

  if (DRY_RUN) console.log('\nDRY_RUN=1: watermark not advanced.');

  if (breaches.length > 0) {
    console.error(
      `\nPublic-read egress is over budget:\n\n${breaches.map((b) => `  - ${b}`).join('\n')}\n\n` +
        'This is the pattern that produced ~253GB of egress over 20 days in the 2026-08-07\n' +
        'incident. Check, in order:\n' +
        '  1. Is APP_PUBLIC_RELEASE_ARTIFACT_BASE_URL still set on Vercel (all environments)?\n' +
        '     Without it the artifact read-through is skipped and every cold start hits Postgres.\n' +
        '  2. Are the artifacts current? A releaseId mismatch makes consumers fall back silently.\n' +
        '     apps/web/src/lib/public-data/release-artifacts.ts logs the specific reason.\n' +
        '  3. Did a route lose its cache posture, or did the catalog cache TTL get shortened?\n',
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nPublic-read egress within budget.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
