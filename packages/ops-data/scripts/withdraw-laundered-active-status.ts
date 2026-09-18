/**
 * Withdraw unsupported active status only when its claim ids resolve to nothing, its provenance
 * is active_public_release_backfill, corrected derivation returns unknown and its lane is not
 * an operational roster. Never substitute a new assertion. Apply preserves prior values in the
 * backup table and emits affected ids. Default dry-run; writes require DRY_RUN=0 and
 * CANONICAL_WITHDRAW_APPLY=1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { deriveCatalogEntityStatus } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const BACKUP_TABLE = 'canonical.status_history_backup_repo_i2st';

/**
 * Exempt explicitly identified operational-roster lanes from this withdrawal pass. This
 * exemption preserves their existing status; it does not prove continuing operation or replace
 * claim-level evidence and source-date review.
 */
const OPERATIONAL_ROSTER_LANES = new Set(['hbcu', 'divine-nine']);
const apply = process.env.DRY_RUN === '0' && process.env.CANONICAL_WITHDRAW_APPLY === '1';

const databaseUrl = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

type Row = {
  readonly id: string;
  readonly kind: string;
  readonly display_name: string;
  readonly status_history: readonly {
    readonly status?: string;
    readonly basisClaimIds?: string[];
  }[];
  readonly claim_ids: readonly string[];
  readonly projection: Record<string, unknown> | null;
  readonly lane: string | null;
};

const conn = normalizePgConnectionString(databaseUrl);
const pool = new pg.Pool({
  connectionString: conn.connectionString,
  max: 2,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
const client = await pool.connect();

try {
  const { rows } = await client.query<Row>(
    `SELECT e.id, e.kind, e.display_name, e.status_history,
            COALESCE((SELECT array_agg(c.id) FROM canonical.claims c WHERE c.entity_id = e.id),
                     ARRAY[]::text[]) AS claim_ids,
            re.projection, lc.lane
       FROM canonical.entities e
       LEFT JOIN research.landscape_candidates lc ON lc.id = e.id
       LEFT JOIN published.release_entities re
         ON re.entity_id = e.id
        AND re.release_id = (SELECT release_id FROM published.active_release WHERE id='active')
      WHERE e.status_history IS NOT NULL
        AND jsonb_array_length(e.status_history) > 0
        AND e.kind_detail #>> '{publication,source}' = 'active_public_release_backfill'`,
  );

  const qualifying: { id: string; name: string; kind: string; was: string }[] = [];
  const rejected: Record<string, number> = {};
  const reject = (why: string) => {
    rejected[why] = (rejected[why] ?? 0) + 1;
  };

  for (const row of rows) {
    const history = row.status_history ?? [];
    const statuses = new Set(history.map((entry) => entry.status));
    if (statuses.size !== 1 || !statuses.has('active')) {
      reject('canonical status is not active');
      continue;
    }
    if (row.lane !== null && OPERATIONAL_ROSTER_LANES.has(row.lane)) {
      reject(`lane ${row.lane} attests present operation`);
      continue;
    }
    const claimIds = new Set(row.claim_ids ?? []);
    const basis = history.flatMap((entry) => entry.basisClaimIds ?? []);
    if (basis.length === 0 || basis.some((id) => claimIds.has(id))) {
      reject('basis is empty or actually resolves');
      continue;
    }
    const projection = row.projection;
    if (!projection) {
      reject('not in the active release');
      continue;
    }
    const derived = deriveCatalogEntityStatus({
      id: row.id,
      kind: row.kind,
      displayName: row.display_name,
      ...(projection.summary !== undefined ? { summary: projection.summary as string } : {}),
      ...(projection.historicalContext !== undefined
        ? { historicalContext: projection.historicalContext as string }
        : {}),
      ...(projection.eraBuckets !== undefined
        ? { eraBuckets: projection.eraBuckets as readonly string[] }
        : {}),
      ...(projection.researchCoverage !== undefined
        ? { researchCoverage: projection.researchCoverage as string }
        : {}),
      claims: (
        (projection.claims as { id?: string; predicate?: string; object?: string }[]) ?? []
      ).map((claim) => ({
        ...(claim.id !== undefined ? { id: claim.id } : {}),
        ...(claim.predicate !== undefined ? { predicate: claim.predicate } : {}),
        ...(claim.object !== undefined ? { object: claim.object } : {}),
      })),
    });
    if (derived.status !== 'unknown') {
      reject(`corrected derivation still says ${derived.status ?? '(none)'}`);
      continue;
    }
    qualifying.push({ id: row.id, name: row.display_name, kind: row.kind, was: 'active' });
  }

  console.log(`backfilled canonical rows with a status_history: ${rows.length}`);
  console.log(`QUALIFYING for withdrawal: ${qualifying.length}\n`);
  console.log('rejected, by reason:');
  for (const [why, n] of Object.entries(rejected).sort((a, b) => b[1] - a[1])) {
    console.log(String(n).padStart(6), why);
  }
  const byKind: Record<string, number> = {};
  qualifying.forEach((q) => {
    byKind[q.kind] = (byKind[q.kind] ?? 0) + 1;
  });
  console.log('\nqualifying by kind:', byKind);
  console.log('samples:');
  qualifying.slice(0, 5).forEach((q) => console.log(`  - ${q.id} (${q.kind}) ${q.name}`));

  const artifactDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../.cache/canonical-corrections',
  );
  mkdirSync(artifactDir, { recursive: true });
  const artifact = join(artifactDir, 'repo-i2st-withdraw-laundered-active.json');
  writeFileSync(
    artifact,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        applied: apply,
        qualifying: qualifying.length,
        rejected,
        ids: qualifying.map((q) => q.id),
      },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${artifact}`);

  if (!apply) {
    console.log('DRY RUN: no database writes. Set DRY_RUN=0 CANONICAL_WITHDRAW_APPLY=1 to apply.');
  } else if (qualifying.length === 0) {
    console.log('Nothing qualifies; no writes performed.');
  } else {
    const ids = qualifying.map((q) => q.id);
    await client.query('BEGIN');
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
           id text PRIMARY KEY,
           status_history jsonb NOT NULL,
           withdrawn_at timestamptz NOT NULL DEFAULT now()
         )`,
      );
      const backup = await client.query(
        `INSERT INTO ${BACKUP_TABLE} (id, status_history)
         SELECT id, status_history FROM canonical.entities WHERE id = ANY($1::text[])
         ON CONFLICT (id) DO NOTHING`,
        [ids],
      );
      const updated = await client.query(
        // Empty array, not NULL: the column is NOT NULL, and canonicalHasAssertedStatus keys off
        // length, so `[]` is exactly "asserts nothing" without fighting the constraint.
        `UPDATE canonical.entities SET status_history = '[]'::jsonb, updated_at = now()
          WHERE id = ANY($1::text[])`,
        [ids],
      );
      await client.query('COMMIT');
      console.log(`\nAPPLIED: backed up ${backup.rowCount} rows, cleared ${updated.rowCount}.`);
      console.log(`Undo: UPDATE canonical.entities e SET status_history = b.status_history`);
      console.log(`        FROM ${BACKUP_TABLE} b WHERE b.id = e.id;`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
