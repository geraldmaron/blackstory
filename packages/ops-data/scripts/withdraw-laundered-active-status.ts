/**
 * repo-i2st — withdraw the laundered "still operates today" assertion from bb_canonical.
 *
 * derivePlaceLike used to default place-like records to `active` with no evidence. That output
 * was written back into bb_canonical.entities.status_history by a backfill
 * (kind_detail.publication.source = 'active_public_release_backfill'), so a guess re-entered the
 * canonical layer as asserted fact. Because resolveReleaseProjectionStatus is canonical-first, no
 * republish can repair it: the corrected derivation is never reached.
 *
 * WITHDRAW-ONLY. This script may delete an unsupported assertion; it may never substitute a new
 * one. That rule is the whole design, and it comes from measuring the alternative: clearing every
 * laundered row and letting derivation refill it moved 2,336 records, and among them flipped 17
 * cemeteries from `historic` to `active` and derived the Voting Rights Act as `struck_down`
 * (see repo-vlts). So a row qualifies only when all five hold:
 *
 *   1. the canonical status is `active` — the only value the old default could invent;
 *   2. its basisClaimIds resolve to no claim on the record, i.e. it cites nothing;
 *   3. kind_detail.publication.source is the release backfill, i.e. it is laundered, not authored;
 *   4. the CORRECTED derivation independently returns `unknown` — both layers agree there is no
 *      answer, so clearing asserts nothing;
 *   5. it did not arrive via a lane whose source attests present operation (see
 *      OPERATIONAL_ROSTER_LANES).
 *
 * Everything else is untouched: `historic`, `in_force`, `repealed`, `struck_down`, and any
 * `active` the fixed derivation still supports.
 *
 * Reversible: prior values are copied to bb_canonical.status_history_backup_repo_i2st before any
 * update, and dumped to a JSON artifact. Undo is
 *   UPDATE bb_canonical.entities e SET status_history = b.status_history
 *     FROM bb_canonical.status_history_backup_repo_i2st b WHERE b.id = e.id;
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/withdraw-laundered-active-status.ts            # dry run
 *   DRY_RUN=0 CANONICAL_WITHDRAW_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/withdraw-laundered-active-status.ts            # apply
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { deriveCatalogEntityStatus } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const BACKUP_TABLE = 'bb_canonical.status_history_backup_repo_i2st';

/**
 * Ingest lanes whose SOURCE attests present operation, so `active` on them is evidenced even
 * when the record itself is thin.
 *
 * This is the distinction the thin-record test cannot see. A register of historic places attests
 * a listing — the building may be gone. A roster of currently-operating institutions attests
 * operation: an entry in the federal HBCU list is an accredited institution enrolling students
 * now, and the Divine Nine are active national organizations. Both lanes come out thin (single
 * source, no narrative), so the corrected derivation calls them `unknown` and they would
 * otherwise qualify — clearing them would strip a true `active` from Howard, Spelman, Alpha
 * Kappa Alpha and 51 others.
 *
 * Longer-term this belongs in the derivation rather than here (see repo-i2st): source semantics
 * are evidence, and the catalog should carry them as such instead of every consumer re-deriving
 * which rosters mean "still open".
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
            COALESCE((SELECT array_agg(c.id) FROM bb_canonical.claims c WHERE c.entity_id = e.id),
                     ARRAY[]::text[]) AS claim_ids,
            re.projection, lc.lane
       FROM bb_canonical.entities e
       LEFT JOIN bb_research.landscape_candidates lc ON lc.id = e.id
       LEFT JOIN bb_public.release_entities re
         ON re.entity_id = e.id
        AND re.release_id = (SELECT release_id FROM bb_public.active_release WHERE id='active')
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
      summary: projection.summary as string | undefined,
      historicalContext: projection.historicalContext as string | undefined,
      eraBuckets: projection.eraBuckets as readonly string[] | undefined,
      researchCoverage: projection.researchCoverage as string | undefined,
      claims: (
        (projection.claims as { id?: string; predicate?: string; object?: string }[]) ?? []
      ).map((claim) => ({ id: claim.id, predicate: claim.predicate, object: claim.object })),
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
         SELECT id, status_history FROM bb_canonical.entities WHERE id = ANY($1::text[])
         ON CONFLICT (id) DO NOTHING`,
        [ids],
      );
      const updated = await client.query(
        // Empty array, not NULL: the column is NOT NULL, and canonicalHasAssertedStatus keys off
        // length, so `[]` is exactly "asserts nothing" without fighting the constraint.
        `UPDATE bb_canonical.entities SET status_history = '[]'::jsonb, updated_at = now()
          WHERE id = ANY($1::text[])`,
        [ids],
      );
      await client.query('COMMIT');
      console.log(`\nAPPLIED: backed up ${backup.rowCount} rows, cleared ${updated.rowCount}.`);
      console.log(`Undo: UPDATE bb_canonical.entities e SET status_history = b.status_history`);
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
