/**
 * Checks expensive public reads using pg_stat_statements deltas and a persisted watermark.
 * Detects counter resets and estimates daily request/egress rates from the observation
 * interval. Writes only its own watermark. Runs explicitly through the CLI or manual workflow;
 * no schedule is installed.
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
 * Approximate bytes per row and alarm budgets for full-catalog read regressions. Re-measure
 * sizes and healthy traffic before changing thresholds; these estimates are not billing
 * measurements.
 */
type WatchedRead = {
  readonly label: string;
  readonly description: string;
  /**
   * Matched with LIKE against pg_stat_statements.query. Every matching statement is summed,
   * which is the right answer for "how many bytes did reads of this shape send".
   *
   * Anchor these on the select list, not just the table name. `%FROM published.release_entities%`
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
    fingerprint: 'SELECT projection%FROM published.release_entities%ORDER BY entity_id%',
    // 7,382 kB across 4,092 rows on the active release.
    bytesPerRow: 1_847,
    // Healthy is a handful of cold starts per day (single-digit GB is already far above that).
    // The incident ran at ~12GB/day.
    budgetBytesPerDay: 2 * GB,
  },
  {
    label: 'search_index_full',
    description: 'Full search index pull',
    fingerprint: 'SELECT id, release_id, entity_id, name, name_lower%FROM published.search_index%',
    // ~2.09MB across ~4,092 docs.
    bytesPerRow: 512,
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'release_graph_adjacency_full',
    description: 'Full graph adjacency pull',
    fingerprint: 'SELECT entity_id, adjacency%FROM published.release_graph_adjacency%',
    // 656 kB across 4,092 rows.
    bytesPerRow: 164,
    budgetBytesPerDay: 1 * GB,
  },
  // Small pointer/policy reads are monitored for excessive call volume even when their byte
  // totals are small.
  {
    label: 'release_articles_full',
    description: 'Full article list pull (article index, cites edge, story lead)',
    // Anchored on the ORDER BY so the by-slug point read (`WHERE articles.slug = $1`) is not
    // counted as a full pull.
    fingerprint:
      'SELECT articles.payload%FROM published.release_articles%ORDER BY articles.published_at%',
    // 222,633 bytes across 48 rows.
    bytesPerRow: 4_638,
    // Healthy is one pull per instance per 30m (the release-scoped cache TTL); 1GB/day is
    // ~4,700 full pulls, an order of magnitude above that.
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'release_theme_impact_packets',
    description: 'Theme-impact packet reads (all shapes: full, by theme, by packet id)',
    fingerprint: 'SELECT packets.payload%FROM published.release_theme_impact_packets%',
    // 106,791 bytes across 13 rows.
    bytesPerRow: 8_215,
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'active_release_pointer',
    description: 'Active-release pointer read (one tiny row; this is a call-count alarm)',
    // The select list and FROM are on separate lines in the source, so `%` between them.
    fingerprint:
      'SELECT release_id, activated_at, search_index_version, manifest_hash%FROM published.active_release%',
    // 171 bytes, one row per call.
    bytesPerRow: 171,
    // ~600k calls/day. The pointer is memoised for 30s per instance and per request, so a
    // healthy day is a few thousand calls; this only fires if the memo is bypassed wholesale.
    budgetBytesPerDay: 100 * 1024 * 1024,
  },
  // Legal and materialized-snapshot reads should be amortized by their release-scoped caches.
  {
    label: 'release_legal_snapshots_full',
    description: 'Full legal snapshot list pull (/law)',
    // Anchored on the select list and ORDER BY so the release_id-only count/exists probes
    // elsewhere are not counted as a full pull.
    fingerprint: 'SELECT payload%FROM published.release_legal_snapshots%ORDER BY slug%',
    // 26,696 bytes across 12 rows on the active release.
    bytesPerRow: 2_225,
    // Healthy is one pull per instance per 30m (the release-scoped cache TTL).
    budgetBytesPerDay: 1 * GB,
  },
  {
    label: 'materialized_snapshots_point',
    description: 'Materialized snapshot point read by name (/books, /data, demographics)',
    fingerprint: 'SELECT payload%FROM published.materialized_snapshots%WHERE name = $1%',
    // 69,259 bytes across 6 snapshots on the active release.
    bytesPerRow: 11_543,
    // Healthy is one pull per name per instance per 30m (the release-scoped cache TTL).
    budgetBytesPerDay: 1 * GB,
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
       FROM ops.public_read_egress_watermark
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
    `INSERT INTO ops.public_read_egress_watermark
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
        '     packages/domain/src/publication/release-artifact-fetch.ts logs the specific reason.\n' +
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
